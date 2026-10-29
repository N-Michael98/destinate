"use client";
import { useEffect, useState, useCallback } from "react";

/**
 * Offene Capital.com-Positionen ansehen und schliessen (28.10. entkernt).
 *
 * ── WAS HIER BIS ZUM 28.10. STAND UND WARUM ES WEG IST ──────────────────────
 *
 * Diese Ansicht hatte eine „Execution Queue" mit einem GO-Knopf, der echte
 * Capital.com-Orders platzierte. Drei Befunde, alle nachgemessen:
 *
 *  1. DER KNOPF WAR NIE KLICKBAR. Gelesen wurde `queue.queue` und
 *     `queue.queuedTrades`; `/api/execution-queue-position-sync` liefert aber
 *     `items` und `totalItems`. `queue?.queue?.length` war also IMMER
 *     `undefined` → der Leer-Zweig lief immer → kein einziger Eintrag, kein
 *     Knopf. Dieselbe Feldnamen-Fehlerklasse wie am 30.09., diesmal eine
 *     Ebene tiefer: die Messung vom 22.10. prüfte `d.report`, nicht die
 *     Felder DARIN.
 *
 *  2. ES WAR DIE FALSCHE ROUTE. Die erwarteten Namen (`queue`,
 *     `queuedTrades`, `rank`, `adaptiveConfidence`, `riskPerTradePercent`)
 *     gehören zu `/api/execution-queue-engine` — und die ruft **niemand** auf.
 *
 *  3. „KORRIGIEREN" WÄRE FALSCH GEWESEN. Beide Queue-Module erklären sich
 *     selbst als nicht-live (`liveTradingEnabled: false` bzw.
 *     `liveExecutionBlocked: true`, Modus `SIMULATION | READ_ONLY |
 *     PAPER_MODE`) und tragen **keinen Stop**. Die Route zu korrigieren hätte
 *     eine Simulations-Queue an den echten Broker gehängt — ohne Stop.
 *
 * Dazu lag ein Schalter „Auto-Execute GO Signale" hier, der ausschliesslich
 * sich selbst einfärbte: `autoExec` wurde nirgends gelesen ausser für seine
 * eigene Darstellung. Ein grünes „AN", das nichts tut — dieselbe Klasse wie
 * die falschen Killswitch-Texte (27.09.) und die IC-keep-alive-Zeile (25.10.).
 *
 * Für manuelles Ausführen gibt es `MarketScannerPanel` — das schickt Stop und
 * Ziel mit. Und seit dem 28.10. hält `ordersRiegel()` in
 * `capital-com-execution.ts` ohnehin jede Order ohne Stop auf.
 *
 * ÜBRIG BLEIBT, was nachweislich funktioniert: die offenen Positionen aus
 * `/api/capital-com/positions` (`d.positions`, am 22.10. einzeln geprüft) und
 * der Schliessen-Knopf.
 *
 * NACHGEPRÜFT, nicht angenommen: `/api/execution-queue-position-sync` bleibt
 * in Gebrauch — `ExecutionQueuePositionSyncPanel.tsx:111` ruft sie weiter auf
 * (eingebunden über `ForwardTestingCenter.tsx:289`, Tab „position-sync") und
 * liest `d.report` korrekt. Hier stand kurzzeitig das Gegenteil; die Suche
 * hatte nur diese Datei im Blick.
 */

/**
 * Eine LEERE Broker-Zeit ergibt "Invalid Date" (28.10.).
 *
 * `brokerZeitNachUtc()` gibt bei fehlender Zonenangabe bewusst eine LEERE
 * Zeichenkette zurueck statt `new Date()` zu raten (Regel vom 22.09.,
 * `capital-com-client.ts:965`). `new Date("")` ist dann Invalid Date, und
 * `toLocaleTimeString()` schreibt das woertlich in die Zeile.
 *
 * Unbekannt bleibt unbekannt — aber als "—", nicht als Fehlertext.
 */
function zeit(wert: string | null | undefined): string {
  if (typeof wert !== "string" || wert.trim() === "") return "—";
  const d = new Date(wert);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleTimeString();
}

interface OpenPosition {
  dealId: string;
  symbol: string;
  direction: "BUY" | "SELL";
  size: number;
  openLevel: number;
  profitLoss: number;
  currency: string;
  createdDate: string;
}

export default function LiveExecutionMonitor() {
  const [positions, setPositions] = useState<OpenPosition[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [capitalConnected, setCapitalConnected] = useState(false);
  // Nur Anzeige: der Wert kommt vom Broker. Das frühere Eingabefeld speiste
  // ausschliesslich die Ordergrösse des entfernten GO-Knopfs — ein Feld, das
  // nichts mehr beeinflusst, wäre dieselbe Lüge wie der Schalter oben.
  const [accountBalance, setAccountBalance] = useState<number | null>(null);

  // Echten Capital.com-Status und Kontostand holen — alle 20 s
  const fetchCapitalStatus = useCallback(() => {
    fetch("/api/capital-com").then(r => r.json()).then(d => {
      setCapitalConnected(!!d.connected);
      // KEIN `> 0`. Die Quelle ist `balance: session?.balance ?? null`
      // (`app/api/capital-com/route.ts`), also ist `null` = nicht abrufbar
      // und eine Zahl = gemessen. Ein echter Stand von 0 als "unbekannt"
      // auszugeben waere die Regel vom 22.09. in der falschen Richtung:
      // aus einer Messung wird dann "unbekannt".
      setAccountBalance(
        d.connected && typeof d.balance === "number" && Number.isFinite(d.balance)
          ? d.balance : null,
      );
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetchCapitalStatus();
    const iv = setInterval(fetchCapitalStatus, 20000);
    return () => clearInterval(iv);
  }, [fetchCapitalStatus]);

  const loadPositions = useCallback(async () => {
    const r = await fetch("/api/capital-com/positions").catch(() => null);
    if (!r?.ok) return;
    const d = await r.json().catch(() => null);
    if (d?.positions) setPositions(d.positions);
  }, []);

  const loadAll = useCallback(async () => {
    setRefreshing(true);
    await loadPositions();
    setRefreshing(false);
  }, [loadPositions]);

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 15000);
    return () => clearInterval(interval);
  }, [loadAll]);

  const closePosition = async (dealId: string) => {
    const r = await fetch(`/api/capital-com/positions?dealId=${dealId}`, { method: "DELETE" }).catch(() => null);
    const d = r ? await r.json().catch(() => null) : null;
    if (d?.ok) await loadPositions();
  };

  const totalPnL = positions.reduce((sum, p) => sum + p.profitLoss, 0);

  return (
    <div style={{ padding: "24px", fontFamily: "monospace", color: "#e2e8f0" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "20px", fontWeight: 700, color: "#f1f5f9" }}>⚡ Offene Positionen</span>
            <span style={{
              padding: "2px 10px", borderRadius: "4px", fontSize: "11px", fontWeight: 700,
              background: capitalConnected ? "rgba(16,201,109,0.15)" : "rgba(100,116,139,0.15)",
              color: capitalConnected ? "#10c96d" : "#64748b",
              border: `1px solid ${capitalConnected ? "rgba(16,201,109,0.3)" : "rgba(100,116,139,0.2)"}`,
            }}>
              {capitalConnected ? "● Capital.com DEMO verbunden" : "○ nicht verbunden"}
            </span>
          </div>
          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
            Ansehen und Schliessen · Eröffnet wird hier nicht — das macht der Handelszyklus
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button onClick={loadAll} disabled={refreshing}
            style={{ padding: "7px 14px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer", background: "rgba(255,255,255,0.05)", color: "#94a3b8", fontSize: "11px", fontFamily: "monospace" }}>
            {refreshing ? "..." : "↻ Refresh"}
          </button>
        </div>
      </div>

      {/* Kontostand — reine Anzeige, Wert vom Broker */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px", alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: "11px", color: "#64748b" }}>
          Kontostand:{" "}
          <span style={{ color: accountBalance === null ? "#64748b" : "#f1f5f9", fontWeight: 700 }}>
            {accountBalance === null ? "unbekannt" : accountBalance.toFixed(2)}
          </span>
          {accountBalance === null && (
            <span style={{ color: "#475569" }}> — nicht abrufbar, solange keine Sitzung steht</span>
          )}
        </div>
        {!capitalConnected && (
          <div style={{ padding: "6px 12px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "6px", fontSize: "10px", color: "#fbbf24" }}>
            ⚠ Capital.com nicht verbunden — Settings → Broker Connections
          </div>
        )}
      </div>

      {/* Offene Positionen */}
      <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: "10px", border: "1px solid rgba(16,201,109,0.2)", padding: "16px", marginBottom: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "#10c96d" }}>
            📈 Offene Positionen ({positions.length})
          </div>
          {positions.length > 0 && (
            <div style={{ fontSize: "13px", fontWeight: 700, color: totalPnL >= 0 ? "#10c96d" : "#f87171" }}>
              P&L: {(totalPnL ?? 0) >= 0 ? "+" : ""}{(totalPnL ?? 0).toFixed(2)}
            </div>
          )}
        </div>
        {!positions.length ? (
          <div style={{ fontSize: "11px", color: "#475569", padding: "20px 0", textAlign: "center" }}>
            {capitalConnected ? "Keine offenen Positionen" : "Capital.com nicht verbunden"}
          </div>
        ) : (
          positions.map((pos) => (
            <div key={pos.dealId} style={{ background: "rgba(0,0,0,0.2)", borderRadius: "8px", padding: "12px", marginBottom: "8px", border: `1px solid ${pos.profitLoss >= 0 ? "rgba(16,201,109,0.2)" : "rgba(248,113,113,0.2)"}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#f1f5f9" }}>{pos.symbol}</span>
                  <span style={{ padding: "1px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: 700,
                    background: pos.direction === "BUY" ? "rgba(16,201,109,0.15)" : "rgba(248,113,113,0.15)",
                    color: pos.direction === "BUY" ? "#10c96d" : "#f87171" }}>
                    {pos.direction}
                  </span>
                </div>
                <span style={{ fontSize: "14px", fontWeight: 700, color: (pos.profitLoss ?? 0) >= 0 ? "#10c96d" : "#f87171" }}>
                  {(pos.profitLoss ?? 0) >= 0 ? "+" : ""}{(pos.profitLoss ?? 0).toFixed(2)}
                </span>
              </div>
              <div style={{ fontSize: "10px", color: "#64748b", marginBottom: "8px" }}>
                Size: {pos.size} · Entry: {pos.openLevel} · {zeit(pos.createdDate)}
              </div>
              <button
                onClick={() => closePosition(pos.dealId)}
                style={{ padding: "5px 12px", borderRadius: "5px", border: "1px solid rgba(248,113,113,0.3)", cursor: "pointer", background: "rgba(248,113,113,0.1)", color: "#f87171", fontSize: "10px", fontFamily: "monospace" }}>
                ✕ Schliessen
              </button>
            </div>
          ))
        )}
      </div>

      {/* Zusicherung — nachgeprueft, nicht behauptet: `useLiveApi` hat den
          Standardwert false und KEIN Aufrufer uebergibt ihn; alle uebrigen
          Endpunkte sind fest auf DEMO_BASE (capital-com-client.ts). */}
      <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: "8px", fontSize: "10px", color: "#78716c" }}>
        🔒 <strong>Capital.com DEMO:</strong> jede Anfrage geht an die DEMO-API · kein echtes Geld · diese Ansicht eröffnet keine Positionen
      </div>
    </div>
  );
}
