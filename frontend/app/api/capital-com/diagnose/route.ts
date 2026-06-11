import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, string>;
  const { apiKey, identifier, password } = body;
  const steps: Array<{ step: string; ok: boolean; detail: string }> = [];

  // Step 1: Can Node.js reach the internet at all?
  try {
    const ping = await fetch("https://httpbin.org/get", { cache: "no-store", signal: AbortSignal.timeout(5000) });
    steps.push({ step: "Internet (httpbin.org)", ok: ping.ok, detail: `HTTP ${ping.status}` });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    steps.push({ step: "Internet (httpbin.org)", ok: false, detail: msg });
    return NextResponse.json({
      ok: false, steps,
      error: "Node.js kann keine externen HTTPS-Verbindungen herstellen.",
      hint: "Windows Defender Firewall blockiert Node.js. Lösung: Windows Defender Firewall → Node.js zulassen, ODER den Proxy in next.config.js verwenden (empfohlen — weiter unten erklärt).",
      solution: "proxy",
    });
  }

  // Step 2: Can we reach Capital.com domain?
  try {
    const cap = await fetch("https://demo-api-capital.backend.capital/api/v1/time", {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    steps.push({ step: "Capital.com DEMO API erreichbar", ok: cap.ok || cap.status < 500, detail: `HTTP ${cap.status}` });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    steps.push({ step: "Capital.com DEMO API erreichbar", ok: false, detail: msg });

    // httpbin worked but capital.com didn't — ISP/DNS blocking or wrong URL
    return NextResponse.json({
      ok: false, steps,
      error: "Capital.com DEMO API ist nicht erreichbar (aber Internet funktioniert).",
      hint: "Mögliche Ursachen: (1) Windows Firewall blockiert speziell diese Domain, (2) Antivirus/VPN blockiert den Host, (3) Die API-URL hat sich geändert. Versuche einen VPN oder prüfe Firewall-Regeln.",
      solution: "firewall",
    });
  }

  if (!apiKey || !identifier || !password) {
    return NextResponse.json({ ok: false, steps, error: "API Key, E-Mail und Passwort erforderlich" });
  }

  // Step 3: Session with identifier
  try {
    const res = await fetch("https://demo-api-capital.backend.capital/api/v1/session", {
      method: "POST",
      headers: { "X-CAP-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ encryptedPassword: false, identifier, password }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });

    let detail = `HTTP ${res.status}`;
    let errorCode = "";
    try {
      const b = await res.json() as Record<string, string>;
      errorCode = b.errorCode ?? b.errorMessage ?? b.error_code ?? "";
      if (errorCode) detail = `${res.status} — ${errorCode}`;
    } catch { /* ignore */ }

    steps.push({ step: "Session Login (identifier + password)", ok: res.ok, detail });

    if (!res.ok) {
      let hint = "";
      if (res.status === 401 || errorCode.includes("invalid.credentials") || errorCode.includes("credentials")) {
        hint = "Falsches Passwort oder E-Mail. Im Passwort-Feld muss das 'Individual Password' stehen — das Passwort das du beim Erstellen des API Keys in Capital.com gesetzt hast (NICHT dein Login-Passwort für die Website).";
      } else if (res.status === 403 || errorCode.includes("api.key") || errorCode.includes("apikey")) {
        hint = "API Key ungültig oder abgelaufen. Generiere einen neuen Key: Capital.com → Mein Konto → API Management.";
      } else if (res.status === 429) {
        hint = "Zu viele Login-Versuche. Bitte 2 Minuten warten.";
      } else if (errorCode.includes("account.not.confirmed")) {
        hint = "Account noch nicht bestätigt (E-Mail-Verifizierung).";
      } else if (res.status === 400) {
        hint = "Ungültige Anfrage. Prüfe ob API Key, E-Mail und Passwort korrekt eingegeben wurden.";
      }
      return NextResponse.json({ ok: false, steps, error: detail, hint });
    }

    const cst = res.headers.get("CST");
    const secToken = res.headers.get("X-SECURITY-TOKEN");
    const hasTokens = !!(cst && secToken);
    steps.push({ step: "Session Tokens (CST + X-SECURITY-TOKEN)", ok: hasTokens, detail: hasTokens ? "Beide Tokens erhalten ✓" : "Tokens fehlen in Response-Headers" });

    return NextResponse.json({ ok: hasTokens, steps, error: hasTokens ? null : "Keine Session-Tokens erhalten" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Fehler";
    steps.push({ step: "Session Login", ok: false, detail: msg });
    return NextResponse.json({ ok: false, steps, error: msg });
  }
}
