import { NextResponse } from "next/server";

// Diagnose endpoint — tests connectivity to Capital.com API step by step
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, string>;
  const { apiKey, identifier, password } = body;
  const steps: Array<{ step: string; ok: boolean; detail: string }> = [];

  // Step 1: Basic connectivity to Capital.com
  try {
    const ping = await fetch("https://demo-api-capital.backend.capital/api/v1/ping", {
      cache: "no-store",
    });
    steps.push({ step: "DNS + Connectivity", ok: ping.ok || ping.status < 500, detail: `HTTP ${ping.status}` });
  } catch (err) {
    steps.push({ step: "DNS + Connectivity", ok: false, detail: err instanceof Error ? err.message : "Failed" });
    return NextResponse.json({ ok: false, steps, error: "Capital.com ist nicht erreichbar. Prüfe deine Internetverbindung." });
  }

  if (!apiKey || !identifier || !password) {
    return NextResponse.json({ ok: false, steps, error: "API Key, E-Mail und Passwort erforderlich" });
  }

  // Step 2: Session creation with identifier (correct field name)
  try {
    const res = await fetch("https://demo-api-capital.backend.capital/api/v1/session", {
      method: "POST",
      headers: {
        "X-CAP-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ encryptedPassword: false, identifier, password }),
      cache: "no-store",
    });

    let detail = `HTTP ${res.status}`;
    let errorCode = "";
    try {
      const body = await res.json() as Record<string, string>;
      errorCode = body.errorCode ?? body.errorMessage ?? "";
      detail = errorCode ? `${res.status} — ${errorCode}` : detail;
    } catch { /* ignore */ }

    steps.push({ step: "Session Login", ok: res.ok, detail });

    if (!res.ok) {
      let hint = "";
      if (res.status === 401 || errorCode.includes("invalid.credentials")) {
        hint = "E-Mail oder Passwort falsch. Nutze dein Capital.com Login-Passwort (nicht das API-Passwort falls unterschiedlich).";
      } else if (res.status === 403 || errorCode.includes("api.key")) {
        hint = "API Key ungültig. Generiere einen neuen Key in Capital.com → Einstellungen → API Key.";
      } else if (res.status === 429) {
        hint = "Zu viele Versuche. Bitte 1 Minute warten.";
      } else if (errorCode.includes("account.not.confirmed")) {
        hint = "Account noch nicht bestätigt. E-Mail-Verifizierung abschliessen.";
      }
      return NextResponse.json({ ok: false, steps, error: detail, hint });
    }

    // Step 3: Verify session tokens
    const cst = res.headers.get("CST");
    const secToken = res.headers.get("X-SECURITY-TOKEN");
    const hasTokens = !!(cst && secToken);
    steps.push({ step: "Session Tokens (CST + X-SECURITY-TOKEN)", ok: hasTokens, detail: hasTokens ? "Tokens erhalten ✓" : "Keine Tokens in Response-Headers" });

    return NextResponse.json({ ok: hasTokens, steps, error: hasTokens ? null : "Keine Session-Tokens erhalten" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
    steps.push({ step: "Session Login", ok: false, detail: msg });
    return NextResponse.json({ ok: false, steps, error: msg });
  }
}
