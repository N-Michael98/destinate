// Woher kommen die Stimmen der Konsens-Ansicht? (21.11.)
//
// `/api/consensus/decision` fragt GPT-Analyst und Claude-Risiko ueber eine
// INTERNE Anfrage an — ohne Anmelde-Cookie. `proxy.ts` weist jede `/api/`-
// Anfrage ohne Cookie mit 401 ab, bevor ein Modell gerufen wird. Die Route
// meldet das ehrlich (`sources.gpt/claude = "UNAVAILABLE"`) und rechnet dann
// mit ERSATZWERTEN weiter:
//
//   GPT fehlt     -> Richtung aus dem Python-Trend, Confidence 70
//   Claude fehlt  -> Freigabe ja, Risiko 40 (MEDIUM)
//   Python fehlt  -> Regime RANGING, keine Marktdaten
//
// Die Ansicht zeigte `sources` nirgends an. Die Entscheidungen sahen damit
// aus wie ein Konsens aus drei Stimmen, obwohl zwei davon erfunden waren —
// "ein Ausfall darf sich nicht als Ergebnis ausgeben".
//
// Rein, ohne Importe, damit `safety-nets` es AUSFUEHREN kann: in der
// Seiten-Datei waere es nur strukturell pruefbar.

export interface KonsensQuellen {
  gpt?: unknown;
  claude?: unknown;
  python?: unknown;
}

export interface KonsensQuellenLage {
  /** true nur, wenn ALLE drei Stimmen echt gemessen wurden */
  echt: boolean;
  /** je nicht echter Quelle eine Zeile — leer, wenn `echt` */
  zeilen: string[];
}

export function konsensQuellenLage(q: KonsensQuellen | null | undefined): KonsensQuellenLage {
  // Fehlt die Angabe ganz, ist die Herkunft UNBEKANNT — nicht "in Ordnung".
  if (q === null || q === undefined || typeof q !== "object") {
    return { echt: false, zeilen: ["Quellenangabe fehlt in der Antwort — Herkunft der Stimmen unbekannt"] };
  }

  const zeilen: string[] = [];

  // Auch die regelbasierten Rueckfaelle liefern dem Konsens KEINE Richtung und
  // KEINE Confidence (`GPTAnalystManager.createTradeIdea` traegt nur `bias`,
  // die feste 80 ist seit dem 15.09. entfernt) bzw. KEINEN riskScore
  // (`ClaudeRiskManager.assess`). Die Ersatzwerte greifen dort also genauso.
  if (q.gpt !== "GPT_REAL") {
    zeilen.push(
      (q.gpt === "GPT_ANALYST_LIVE"
        ? "GPT: regelbasierter Rückfall, kein GPT gefragt"
        : "GPT: nicht erreichbar")
      + " — Ersatzwerte: Richtung aus dem Python-Trend, Confidence 70"
    );
  }

  if (q.claude !== "CLAUDE_REAL") {
    zeilen.push(
      q.claude === "CLAUDE_RISK_LIVE"
        ? "Claude: regelbasierter Rückfall, kein Claude gefragt — Freigabe aus Regeln, Risiko 40 als Ersatzwert"
        : "Claude: nicht erreichbar — Ersatzwerte: Freigabe ja, Risiko 40 (MEDIUM)"
    );
  }

  if (q.python !== "LIVE") {
    zeilen.push("Python: keine Indikatoren — Regime RANGING, keine Marktdaten");
  }

  return { echt: zeilen.length === 0, zeilen };
}
