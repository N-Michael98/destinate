"use client";

import { useEffect, useState } from "react";

// ── Was hier bis zum 03.09. stand ───────────────────────────────────────────
//
// Fünf Arrays auf Modulebene, fünfzehn Kennzahlen, kein einziger `fetch`:
//
//   { label: "Queue Tickets",   value: "11" }
//   { label: "Execution Ready", value: "10/11" }
//   { label: "Limited",         value: "1" }
//
// Nachgeprüft über die System-Karte: `lib/execution-preparation` wird von
// KEINEM Handelspfad erreicht — nur von drei API-Routen. `ExecutionQueue.add()`
// hat genau einen Aufrufer, der selbst nur über Routen erreichbar ist. Die
// Warteschlange ist strukturell IMMER leer; die echte Ausführung läuft über
// `capital-com-execution.ts`. Elf Tickets konnte es also nie geben.
//
// Jetzt kommen die Zahlen aus `/api/execution-status`, das aus den echten
// Zählern des Handelszyklus ableitet: `global.__daily_trades__` (Redis-
// gestützt) und `global.__last_scan_result__`. Fehlt ein Zähler, steht
// "unbekannt" — nicht 0.

interface StilZeile {
  stil: string;
  heute: number;
  grenze: number | null;
}

interface Stand {
  ok: boolean;
  datum?: string | null;
  aktuell?: boolean | null;
  heute?: number | null;
  grenze?: number | null;
  limitAktiv?: boolean;
  jeStil?: StilZeile[];
  letzterScanGefunden?: number | null;
  letzterScanStand?: string | null;
  letzterScanAlterMinuten?: number | null;
  nichtGemessen?: string[];
  updatedAt?: string;
  error?: string;
}

function zeige(wert: number | null | undefined): string {
  return typeof wert === "number" && Number.isFinite(wert) ? String(wert) : "unbekannt";
}

export default function ExecutionCenterPanel() {
  const [stand, setStand] = useState<Stand | null>(null);
  const [laedt, setLaedt] = useState(true);

  useEffect(() => {
    let abgebrochen = false;
    async function laden() {
      try {
        const res = await fetch("/api/execution-status", { cache: "no-store" });
        const daten = (await res.json()) as Stand;
        if (!abgebrochen) setStand(daten);
      } catch (e) {
        if (!abgebrochen) {
          setStand({ ok: false, error: e instanceof Error ? e.message : String(e) });
        }
      } finally {
        if (!abgebrochen) setLaedt(false);
      }
    }
    laden();
    const t = setInterval(laden, 30_000);
    return () => { abgebrochen = true; clearInterval(t); };
  }, []);

  const veraltet = stand?.ok === true && stand.aktuell === false;

  return (
    <section className="rounded-3xl border border-green-500/30 bg-zinc-950/70 p-6 shadow-2xl shadow-green-950/30">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-green-400">
            Execution Center
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">
            Ausführung heute
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-zinc-400">
            Abgeleitet aus den Zählern des Handelszyklus — keine geschätzten
            Werte. Aktualisiert sich alle 30 Sekunden.
          </p>
        </div>

        <div
          className={`rounded-full border px-4 py-2 text-xs font-semibold ${
            stand?.ok
              ? veraltet
                ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                : "border-green-500/40 bg-green-500/10 text-green-300"
              : "border-zinc-600 bg-zinc-800/40 text-zinc-400"
          }`}
        >
          {laedt
            ? "wird geladen …"
            : !stand?.ok
              ? "Stand unbekannt"
              : veraltet
                ? `Zähler vom ${stand.datum} — nicht von heute`
                : `${zeige(stand.heute)} Trades heute`}
        </div>
      </div>

      {stand && !stand.ok && (
        <div className="mb-6 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
          Ausführungs-Stand nicht abrufbar{stand.error ? `: ${stand.error}` : ""}.
          Es wird bewusst nichts angezeigt statt einer Zahl, die nichts misst.
        </div>
      )}

      <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
          <p className="text-xs text-zinc-500">Trades heute</p>
          <p className="mt-2 text-xl font-bold text-white">{zeige(stand?.heute)}</p>
          <p className="mt-1 text-xs text-zinc-500">
            Zähler des Orchestrators
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
          <p className="text-xs text-zinc-500">Tageslimit</p>
          <p className="mt-2 text-xl font-bold text-white">{zeige(stand?.grenze)}</p>
          <p
            className={`mt-1 text-xs ${
              stand?.limitAktiv === false ? "text-amber-400" : "text-zinc-500"
            }`}
          >
            {stand?.limitAktiv === false ? "ABGESCHALTET" : "aktiv"}
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
          <p className="text-xs text-zinc-500">Letzter Scan</p>
          <p className="mt-2 text-xl font-bold text-white">
            {zeige(stand?.letzterScanGefunden)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {stand?.letzterScanAlterMinuten === null ||
            stand?.letzterScanAlterMinuten === undefined
              ? "kein Zeitstempel"
              : `vor ${stand.letzterScanAlterMinuten} Min`}
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
          <p className="text-xs text-zinc-500">Zähler-Datum</p>
          <p className="mt-2 text-xl font-bold text-white">
            {stand?.datum ?? "unbekannt"}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {stand?.aktuell === null || stand?.aktuell === undefined
              ? "kein Zähler vorhanden"
              : stand.aktuell
                ? "heutiger Tag"
                : "VERALTET"}
          </p>
        </div>
      </div>

      {(stand?.jeStil?.length ?? 0) > 0 && (
        <div className="mb-6 rounded-2xl border border-zinc-800 bg-black/40 p-4">
          <h3 className="text-sm font-bold text-green-300">Je Handelsstil</h3>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {stand!.jeStil!.map((s) => (
              <div key={s.stil} className="rounded-xl bg-zinc-900/70 px-3 py-2">
                <p className="text-sm font-semibold text-white">{s.stil}</p>
                <p className="mt-1 text-xs text-zinc-400">
                  {s.heute} heute
                  {s.grenze === null ? " · keine Grenze" : ` von ${s.grenze}`}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {(stand?.nichtGemessen?.length ?? 0) > 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
          <h3 className="text-sm font-bold text-amber-300">
            Was diese Ansicht NICHT misst
          </h3>
          <ul className="mt-3 space-y-2">
            {stand!.nichtGemessen!.map((p) => (
              <li
                key={p}
                className="rounded-xl bg-zinc-900/70 px-3 py-2 text-sm text-zinc-400"
              >
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      {stand?.updatedAt && (
        <p className="mt-4 text-right text-xs text-zinc-600">
          Stand: {new Date(stand.updatedAt).toLocaleString("de-CH")}
        </p>
      )}
    </section>
  );
}
