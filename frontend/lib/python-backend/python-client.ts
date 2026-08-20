/**
 * Python Backend Client
 * Next.js → Python FastAPI Bridge
 * URL via env var: PYTHON_BACKEND_URL (z.B. https://destinate-python.railway.app)
 *
 * Alle Calls sind non-fatal — wenn Python Backend nicht erreichbar ist,
 * läuft das System normal weiter (TypeScript Trade Manager als Fallback).
 */

import { pythonBackendAuthHeader } from "./auth-header";
import { meldePythonAufruf } from "./python-status";

const BASE_URL = process.env.PYTHON_BACKEND_NEW_URL ?? process.env.PYTHON_BACKEND_URL ?? "";

// ZIEL-AUSGABE BEIM ERSTEN AUFRUF — bewusst dauerhaft (02.08., neu bewertet 19.08.).
//
// ANLASS damals: exquisite-rejoicing bekam tagelang alle ~2 Minuten
// POST /api/v1/lifecycle/balance mit 401, während divine-warmth denselben
// Aufruf im selben Takt mit 200 beantwortete. Welche Ziel-URL dieses Modul
// tatsächlich auflöst, war von aussen nicht feststellbar. Die Ursache lag in
// next.config.ts und wurde mit b3981a7 behoben.
//
// WARUM DIE ZEILE BLEIBT, obwohl die damalige Frage beantwortet ist: sie
// beantwortet dieselbe Frage bei JEDEM Start neu, und das ist keine
// Kleinigkeit. Es gibt ZWEI Python-Dienste aus demselben Code, und sie werden
// von verschiedenen Seiten benutzt:
//
//   Frontend (diese Datei)  PYTHON_BACKEND_NEW_URL -> divine-warmth
//   Analysis-Engine         PYTHON_BACKEND_URL     -> exquisite-rejoicing
//                                                    (analysis-engine/README.md)
//
// Am 19.08. war genau diese Zeile der Beleg dafür: als Railway den Deploy von
// exquisite-rejoicing nicht ausrollen konnte, liess sich damit sofort sagen,
// dass der Lifecycle davon NICHT betroffen war. Ohne sie wäre das eine
// Vermutung geblieben. Eine Umgebungsvariable, die still auf den falschen
// Dienst zeigt, ist von aussen nicht sichtbar — diese Zeile macht sie sichtbar.
//
// Rein additiv, ändert kein Verhalten. Der Schlüssel selbst wird NIEMALS
// geloggt, nur ob er vorhanden ist.
let _diagLogged = false;
function logTargetOnce(): void {
  if (_diagLogged) return;
  _diagLogged = true;
  const usedNew = !!process.env.PYTHON_BACKEND_NEW_URL;
  console.log(
    `[py-client] Ziel=${BASE_URL || "(leer)"} | Quelle=${usedNew ? "PYTHON_BACKEND_NEW_URL" : "PYTHON_BACKEND_URL"} | Schlüssel vorhanden=${!!process.env.BACKEND_API_KEY}`
  );
}

function isConfigured(): boolean {
  logTargetOnce();
  return BASE_URL.length > 5;
}

async function post<T = unknown>(path: string, body: unknown): Promise<T | null> {
  if (!isConfigured()) return null;
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...pythonBackendAuthHeader() },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    // Fehlschläge waren bisher völlig still (02.08.) — deshalb fiel niemandem
    // auf, dass ein Ziel dauerhaft mit 401 antwortet. Jetzt sichtbar, ohne das
    // fehlertolerante Verhalten zu ändern (Rückgabe bleibt null).
    if (!res.ok) {
      console.warn(`[py-client] ${res.status} bei POST ${path} -> ${BASE_URL}`);
      meldePythonAufruf(path, false, `HTTP ${res.status}`);
      return null;
    }
    meldePythonAufruf(path, true);
    return res.json() as Promise<T>;
  } catch (e) {
    const grund = e instanceof Error ? e.message : String(e);
    console.warn(`[py-client] POST ${path} fehlgeschlagen -> ${BASE_URL}:`, grund);
    meldePythonAufruf(path, false, grund);
    return null;
  }
}

async function get<T = unknown>(path: string): Promise<T | null> {
  if (!isConfigured()) return null;
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: pythonBackendAuthHeader(),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.warn(`[py-client] ${res.status} bei GET ${path} -> ${BASE_URL}`);
      meldePythonAufruf(path, false, `HTTP ${res.status}`);
      return null;
    }
    meldePythonAufruf(path, true);
    return res.json() as Promise<T>;
  } catch (e) {
    // Bis zum 19.08. war dieser Zweig ein leeres catch — ein Netzfehler beim
    // Lesen verschwand vollstaendig, ohne Logzeile und ohne Zaehlung.
    const grund = e instanceof Error ? e.message : String(e);
    console.warn(`[py-client] GET ${path} fehlgeschlagen -> ${BASE_URL}:`, grund);
    meldePythonAufruf(path, false, grund);
    return null;
  }
}

// ── Lifecycle: Trade registrieren ─────────────────────────────────────────────

export async function pyRegisterTrade(params: {
  tradeId:     string;
  symbol:      string;
  direction:   "BUY" | "SELL";
  entry:       number;
  stopLoss:    number;
  takeProfit:  number;
  size:        number;
  confidence:  number;
  tradingStyle: string;
  broker:      string;
  openedAt?:   string;
  /** Nachtraeglich registrieren, ohne Eroeffnungsmeldung (18.08.). */
  silent?:     boolean;
}): Promise<boolean> {
  const res = await post("/api/v1/lifecycle/register", {
    trade_id:      params.tradeId,
    symbol:        params.symbol,
    direction:     params.direction,
    entry:         params.entry,
    stop_loss:     params.stopLoss,
    take_profit:   params.takeProfit,
    size:          params.size,
    confidence:    params.confidence,
    trading_style: params.tradingStyle,
    broker:        params.broker,
    opened_at:     params.openedAt,
    silent:        params.silent === true,
  });
  return !!res;
}

// ── Lifecycle: Preis-Update + Aktion holen ────────────────────────────────────

export type LifecycleAction =
  | { action: "UPDATE_SL"; new_sl: number }
  | { action: "CLOSE"; reason: string }
  | { action: "PARTIAL_CLOSE"; volume: number }
  | { action: null; progress?: number };

export async function pyPriceUpdate(tradeId: string, currentPrice: number): Promise<LifecycleAction> {
  const res = await post<{ action: LifecycleAction }>("/api/v1/lifecycle/price-update", {
    trade_id:      tradeId,
    current_price: currentPrice,
  });
  return (res as { action?: LifecycleAction })?.action ?? { action: null };
}

// ── Lifecycle: Trade schliessen ───────────────────────────────────────────────

export async function pyCloseTrade(tradeId: string, pnl: number, reason: string): Promise<void> {
  await post("/api/v1/lifecycle/close", { trade_id: tradeId, pnl, reason });
}

// ── Lifecycle: welche Trades kennt Python gerade? ─────────────────────────────

/**
 * Die IDs der Trades, die der Python-Lifecycle im Arbeitsspeicher hat (18.08.).
 *
 * WOZU. `_trades` liegt ausschliesslich im RAM und wird NUR beim Eroeffnen
 * gefuellt. Nach jedem Neustart des Python-Dienstes (jedes Railway-Deploy)
 * kennt er die offenen Positionen nicht mehr: `on_price_update` antwortet
 * still mit `{"action": null}`, waehrend die Schleife weiter meldet, sie
 * habe N Positionen aktualisiert. Der Schutz selbst bleibt — der RiskAgent
 * in TypeScript hat Breakeven, Teilgewinn, Trailing und Zeit-Exit selbst —
 * aber die zweite Schicht faellt lautlos aus.
 *
 * RUECKGABE. Die bekannten IDs, oder **null** wenn die Abfrage fehlschlug.
 * Diese Unterscheidung ist wichtig und darf nicht zu einem leeren Set
 * verkuerzt werden: bei einem Fehler darf NICHTS nachregistriert werden.
 * Ein Blind-Registrieren wuerde `be_set`, `partial_done` und `trail_sl`
 * zuruecksetzen und bei jedem Zyklus eine TRADE_OPENED-Meldung ausloesen.
 */
export async function pyLifecycleTrades(): Promise<Set<string> | null> {
  const res = await get<{ trades?: Array<{ trade_id?: string }> }>("/api/v1/lifecycle/trades");
  if (!res || !Array.isArray(res.trades)) return null;
  return new Set(res.trades.map((t) => String(t?.trade_id ?? "")).filter(Boolean));
}

// ── Lifecycle: Balance Update ─────────────────────────────────────────────────

export async function pyUpdateBalance(balance: number): Promise<void> {
  await post("/api/v1/lifecycle/balance", { balance });
}

// ENTFERNT AM 19.08.: pyAnalyzeSymbol(), pyAnalyzeMulti(), pyGetEventStats(),
// pyHealthCheck() samt dem nur dort verwendeten Typ PyIntelligenceResult.
//
// Alle vier waren korrekt geschrieben — die Backend-Routen dazu gibt es
// weiterhin (@router.get("/analyze/{symbol}"), @router.post("/analyze/multi"),
// @router.get("/stats")). Aufgerufen hat sie NIEMAND, keine einzige Stelle im
// ganzen Repository. Sie standen seit ihrer Entstehung ungenutzt hier.
//
// pyHealthCheck() ist ausserdem inhaltlich abgeloest: seit dem 19.08. zaehlt
// python-status.ts jeden echten Aufruf mit und meldet einen Ausfall ueber den
// Diagnostics-Agent. Ein zusaetzlicher Health-Ping waere Last ohne Erkenntnis
// — gehen die echten Aufrufe durch, ist der Dienst erreichbar.
//
// Wer sie zurueckholen will, findet sie in der Historie. Toter Code hat heute
// zweimal echte Befunde verdeckt; das ist der Grund fuer die Entfernung.

export { isConfigured as isPythonBackendConfigured };
