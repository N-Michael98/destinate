"use client";

import { useEffect, useState } from "react";

// ── Was hier bis zum 03.09. stand ───────────────────────────────────────────
//
// Vier Arrays auf Modulebene, fünfzehn Kennzahlen, kein einziger `fetch`:
//
//   { label: "Connected",                value: "10" }
//   { label: "Broker Modules",           value: "12" }
//   { label: "Routing Tickets",          value: "11" }
//   { label: "Healthy Sync Tickets",     value: "10" }
//   brokerDistribution: Dual Broker 6, Capital.com 2, IC Markets 3
//
// Es gibt ZWEI Broker in diesem Programm. "Connected: 10" war keine veraltete
// Zahl, sondern eine erfundene — und sie sah aus wie ein Live-Zustand.
//
// Dazu eine Liste von zwölf "Broker Stack Modules", jedes mit einem grünen
// ACTIVE daneben. Gemessen über die System-Karte: von diesen Modulen wird
// KEINES vom Handelspfad benutzt, und ihre API-Routen haben null Aufrufer.
// Ein grünes ACTIVE an einem Modul, das niemand ruft, ist die gleiche
// Fehlerklasse wie "Status: Prepared" bei einer Ansicht, die es nie gab.
//
// Jetzt kommt alles aus `/api/broker-status`, das den Zustand aus den beiden
// Sitzungen ABLEITET (`global.__capital_session__`, `__icmarkets_session__`).
// Kein Broker-Aufruf, nichts zu erfinden — und was diese Ansicht NICHT misst,
// steht ausdrücklich darunter.

interface BrokerZeile {
  broker: string;
  name: string;
  rolle: string;
  verbunden: boolean;
  kontoId: string | null;
  kontoArt: string | null;
  saldo: number | null;
  eigenkapital: number | null;
  waehrung: string | null;
  verbundenSeit: string | null;
  stundenVerbunden: number | null;
  hinweis: string;
}

interface Zustand {
  ok: boolean;
  broker?: BrokerZeile[];
  verbunden?: number;
  gesamt?: number;
  nichtGemessen?: string[];
  updatedAt?: string;
  error?: string;
}

/** Ein fehlender Wert wird als "unbekannt" gezeigt, NICHT als 0. */
function zeigeZahl(wert: number | null, waehrung: string | null): string {
  if (wert === null || !Number.isFinite(wert)) return "unbekannt";
  return `${wert.toFixed(2)}${waehrung ? ` ${waehrung}` : ""}`;
}

export default function BrokerCenterPanel() {
  const [zustand, setZustand] = useState<Zustand | null>(null);
  const [laedt, setLaedt] = useState(true);

  useEffect(() => {
    let abgebrochen = false;
    async function laden() {
      try {
        const res = await fetch("/api/broker-status");
        const daten = (await res.json()) as Zustand;
        if (!abgebrochen) setZustand(daten);
      } catch (e) {
        if (!abgebrochen) {
          setZustand({ ok: false, error: e instanceof Error ? e.message : String(e) });
        }
      } finally {
        if (!abgebrochen) setLaedt(false);
      }
    }
    laden();
    const t = setInterval(laden, 30_000);
    return () => { abgebrochen = true; clearInterval(t); };
  }, []);

  const broker = zustand?.broker ?? [];
  const verbunden = zustand?.verbunden ?? null;
  const gesamt = zustand?.gesamt ?? null;

  return (
    <section className="rounded-3xl border border-blue-500/30 bg-zinc-950/70 p-6 shadow-2xl shadow-blue-950/30">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-400">
            Broker Center
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">
            Broker-Verbindungen
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-zinc-400">
            Abgeleitet aus den laufenden Sitzungen — kein Broker-Aufruf, keine
            geschätzten Werte. Aktualisiert sich alle 30 Sekunden.
          </p>
        </div>

        <div
          className={`rounded-full border px-4 py-2 text-xs font-semibold ${
            verbunden === null
              ? "border-zinc-600 bg-zinc-800/40 text-zinc-400"
              : verbunden === gesamt
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : "border-amber-500/40 bg-amber-500/10 text-amber-300"
          }`}
        >
          {laedt
            ? "wird geladen …"
            : verbunden === null
              ? "Zustand unbekannt"
              : `${verbunden} von ${gesamt} verbunden`}
        </div>
      </div>

      {zustand && !zustand.ok && (
        <div className="mb-6 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
          Broker-Zustand nicht abrufbar{zustand.error ? `: ${zustand.error}` : ""}.
          Es wird bewusst nichts angezeigt statt einer Zahl, die nichts misst.
        </div>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        {broker.map((b) => (
          <div
            key={b.broker}
            className={`rounded-2xl border p-4 ${
              b.verbunden
                ? "border-emerald-500/30 bg-black/40"
                : "border-zinc-800 bg-black/40"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-bold text-white">{b.name}</p>
                <p className="mt-1 text-xs text-zinc-500">{b.rolle}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                  b.verbunden
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "bg-zinc-700/40 text-zinc-400"
                }`}
              >
                {b.verbunden ? "verbunden" : "nicht verbunden"}
              </span>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-zinc-500">Saldo</dt>
                <dd className="font-semibold text-white">
                  {zeigeZahl(b.saldo, b.waehrung)}
                </dd>
              </div>
              {b.eigenkapital !== null && (
                <div>
                  <dt className="text-xs text-zinc-500">Eigenkapital</dt>
                  <dd className="font-semibold text-white">
                    {zeigeZahl(b.eigenkapital, b.waehrung)}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-zinc-500">Konto</dt>
                <dd className="font-mono text-xs text-zinc-300">
                  {b.kontoId ?? "unbekannt"}
                  {b.kontoArt ? ` (${b.kontoArt})` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">verbunden seit</dt>
                <dd className="text-xs text-zinc-300">
                  {b.stundenVerbunden === null
                    ? "unbekannt"
                    : `${b.stundenVerbunden} h`}
                </dd>
              </div>
            </dl>

            <p className="mt-3 text-xs text-zinc-500">{b.hinweis}</p>
          </div>
        ))}
      </div>

      {(zustand?.nichtGemessen?.length ?? 0) > 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
          <h3 className="text-sm font-bold text-amber-300">
            Was diese Ansicht NICHT misst
          </h3>
          <p className="mt-1 text-xs text-zinc-500">
            Ausdrücklich benannt, damit das Fehlen erklärt ist statt unbemerkt
            zu bleiben.
          </p>
          <ul className="mt-3 space-y-2">
            {zustand!.nichtGemessen!.map((p) => (
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

      {zustand?.updatedAt && (
        <p className="mt-4 text-right text-xs text-zinc-600">
          Stand: {new Date(zustand.updatedAt).toLocaleString("de-CH")}
        </p>
      )}
    </section>
  );
}
