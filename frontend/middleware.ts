export const runtime = "nodejs";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import type { SecurityEventType } from "@/lib/security-watchdog/security-event-logger";

// Honeypot paths — no legitimate request should ever hit these
const HONEYPOT_PATHS = [
  "/.env", "/.env.local", "/.git", "/wp-admin", "/wp-login.php",
  "/phpMyAdmin", "/phpmyadmin", "/admin.php", "/config.php",
  "/xmlrpc.php", "/shell.php", "/cmd.php", "/eval.php",
];

// SQL injection / XSS patterns (simple, fast — no heavy regex)
const SQLI_PATTERNS = ["' or ", "1=1", "union select", "drop table", "exec(", "xp_cmdshell"];
const XSS_PATTERNS = ["<script", "javascript:", "onerror=", "onload=", "alert("];
const TRAVERSAL_PATTERNS = ["../", "..\\", "%2e%2e", "%252e"];

// Suspicious user-agents (scanners, bots)
const BAD_UA_PATTERNS = ["nikto", "sqlmap", "nmap", "masscan", "zgrab", "gobuster", "dirbuster", "nuclei"];

function detectSuspicious(request: NextRequest): { type: SecurityEventType; payload?: string } | null {
  const { pathname } = request.nextUrl;
  const pathLower = pathname.toLowerCase();
  const ua = (request.headers.get("user-agent") ?? "").toLowerCase();
  const query = request.nextUrl.search.toLowerCase();

  if (HONEYPOT_PATHS.some((h) => pathLower.startsWith(h.toLowerCase()))) {
    return { type: "HONEYPOT_ACCESS" };
  }

  if (BAD_UA_PATTERNS.some((p) => ua.includes(p))) {
    return { type: "SUSPICIOUS_UA", payload: ua.slice(0, 100) };
  }

  const fullInput = `${pathLower}${query}`;
  if (SQLI_PATTERNS.some((p) => fullInput.includes(p))) {
    return { type: "SQL_INJECTION", payload: fullInput.slice(0, 120) };
  }
  if (XSS_PATTERNS.some((p) => fullInput.includes(p))) {
    return { type: "XSS_ATTEMPT", payload: fullInput.slice(0, 120) };
  }
  if (TRAVERSAL_PATTERNS.some((p) => fullInput.includes(p))) {
    return { type: "PATH_TRAVERSAL", payload: fullInput.slice(0, 120) };
  }

  return null;
}

function getClientIP(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "ai-trading-system-secret-change-in-production-32chars"
);

const PUBLIC_PATHS = ["/login", "/register", "/verify-email", "/api/auth/login", "/api/auth/register", "/api/auth/verify-email"];

// Brute-force tracker — IP → { count, firstSeen }  (in-memory, resets on redeploy)
const bruteForceMap = new Map<string, { count: number; firstSeen: number }>();
const BRUTE_WINDOW_MS = 60_000; // 1 minute
const BRUTE_THRESHOLD = 8;      // 8+ requests from same IP in 1 min = suspicious

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = getClientIP(request);

  // ── IP Blocklist — geblockte IPs sofort ablehnen ─────────────────────────
  if (ip !== "unknown") {
    const { isIPBlocked } = await import("./lib/security-watchdog/ip-blocklist");
    if (await isIPBlocked(ip)) {
      console.log(`[middleware] 🚫 Geblockte IP abgewiesen: ${ip} | ${pathname}`);
      return new NextResponse("Access denied", { status: 403 });
    }
  }

  // ── Security event detection ─────────────────────────────────────────────
  const detected = detectSuspicious(request);

  // Brute force check — track all IPs, flag if over threshold
  const now = Date.now();
  const bfEntry = bruteForceMap.get(ip) ?? { count: 0, firstSeen: now };
  if (now - bfEntry.firstSeen > BRUTE_WINDOW_MS) {
    // Reset window
    bruteForceMap.set(ip, { count: 1, firstSeen: now });
  } else {
    bfEntry.count++;
    bruteForceMap.set(ip, bfEntry);
  }

  const eventType = detected?.type ?? (bfEntry.count >= BRUTE_THRESHOLD ? "BRUTE_FORCE" : null);

  if (eventType) {
    console.log(`[middleware] Security event detected: ${eventType} | IP: ${ip} | Path: ${pathname}`);
  }

  if (eventType) {
    // Direct Redis log — Node.js runtime has full access
    import("./lib/security-watchdog/security-event-logger").then(({ logSecurityEvent }) => {
      logSecurityEvent({
        type: eventType,
        ip,
        path: pathname,
        ua: request.headers.get("user-agent") ?? undefined,
        payload: detected?.payload,
        ts: now,
      }).catch(() => {});
    }).catch(() => {});
  }

  // Force HTTPS (Railway sets x-forwarded-proto)
  const proto = request.headers.get("x-forwarded-proto");
  if (proto === "http") {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    return NextResponse.redirect(url, { status: 301 });
  }

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }
  // Allow static files and Next.js internals
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }
  const token = request.cookies.get("auth_token")?.value;

  const isApiRoute = pathname.startsWith("/api/");

  if (!token) {
    if (isApiRoute) return new NextResponse("Unauthorized", { status: 401 });
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    await jwtVerify(token, SECRET);
    return NextResponse.next();
  } catch {
    if (isApiRoute) return new NextResponse("Unauthorized", { status: 401 });
    const res = NextResponse.redirect(new URL("/login", request.url));
    res.cookies.set("auth_token", "", { maxAge: 0, path: "/" });
    return res;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
