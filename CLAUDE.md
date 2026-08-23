# Arbeitsregeln für dieses Repository

Diese Datei wird zu Beginn jeder Sitzung automatisch gelesen. Sie muss nicht
manuell geschickt werden.

## Vor und nach jeder Änderung

```bash
cd frontend && npm run check
```

Braucht keine Installation. **Siebzehn Prüfer**, Rückgabe 0 = grün.
**Rot heisst: nicht committen, erst beheben.**

Mit TypeScript-Prüfung zusammen:

```bash
cd frontend && npm run verify
```

Einzelnen Prüfer laufen lassen: `node scripts/checks/run-all.js epic-tables`

## Was das Netz leistet — und was nicht

Es prüft **Struktur und Konsistenz des Quelltextes**: sind alle Epic-Tabellen
vollständig, sind alle Symbol-Listen deckungsgleich, sind die Stop-Riegel
vorhanden und an der richtigen Stelle, liegt kein Geheimnis im Code, sind die
Sicherheitsnetze verdrahtet. Genau diese Fehlerklasse hat wiederholt zugeschlagen.

Es führt die Handelslogik **nicht** aus. Ein Riegel, der vorhanden, aber subtil
falsch umgebaut wurde, fällt hier nicht auf. Ein grüner Lauf ersetzt also nicht
die Kontrolle am laufenden System — er fängt nur ab, was sich statisch
feststellen lässt.

Jeder Prüfer wurde gegen eine gezielte Sabotage getestet und schlägt nachweislich
an. Wird ein Prüfer erweitert, muss dieser Nachweis erneut erbracht werden — ein
Prüfer, der nie rot wird, ist wertlos.

**Acht Prüfer sind die Ausnahme: sie RECHNEN.** Sie übersetzen die echte
TypeScript-Datei und rufen die echte Funktion auf. Damit fällt dort auch ein
subtil falscher Umbau auf (Kehrwert statt Anteil, vertauschte Schwelle,
fehlender Null-Fall), der strukturell unauffällig bliebe:

| Prüfer | ruft wirklich auf | seit |
|---|---|---|
| `ai-clamp` | `inGrenzen()` | 11.08. |
| `exit-schwellen` | `wirksameSchwellen()` | 10.08. |
| `teilgewinn` | `teilgewinnErlaubt()`, `teilgewinnStand()` | 11.08. |
| `signal-untergrenze` | die Untergrenze der Signalkette | 13.08. |
| `order-bestaetigung` | `ausstiegsgrund()`, `stopAbstandGenug()` | 13.08. |
| `lifecycle-rueckkehr` | `nachzuregistrieren()`, `stammdatenAusNotizen()` | 18.08. |
| `python-ueberwachung` | `meldePythonAufruf()`, `pythonUebergang()` | 19.08. |
| `vola-skalierung` | `getVolatilityAdjustedRisk()` | 23.08. |

Für alle anderen Pfade gilt der Absatz oben weiter.

**Ein Wort im Kommentar ist keine Verwendung.** Diese Fehlerklasse hat 2026
sechsmal zugeschlagen: ein Prüfer suchte nach einem Namen und fand ihn in einem
Kommentar, einer Logzeile oder an einer anderen Aufrufstelle — während die
echte Verdrahtung fehlte. Zuletzt am 18.08. im Sabotage-Lauf von
`lifecycle-rueckkehr`. Wer zählt, ob etwas *benutzt* wird, muss Kommentare und
Zeichenketten vorher entfernen (`ohneKommentareUndTexte()` dort).

## Vorgehen bei Änderungen

1. Bestehenden Code lesen, bevor etwas geändert wird
2. `npm run check` — grün? Sonst zuerst das beheben
3. **Eine** Sache auf einmal ändern
4. `npm run check` erneut, bei kritischen Änderungen zusätzlich `npm run build`
5. Rot → zurückrollen und erklären, nicht weiterbauen

## Dateien mit erhöhtem Risiko

Änderungen hier können Geld kosten. Nicht ohne ausdrückliche Zustimmung anfassen,
und danach immer `npm run check` **und** `npm run build`:

| Datei | Warum |
|---|---|
| `frontend/lib/agents/risk-agent.ts` | Breakeven, Teilgewinn, Trailing, Zeit-Exit |
| `frontend/lib/capital-com/capital-com-execution.ts` | Positionsgrösse, MAX_SIZE-Klemme, Stop-Distanzen |
| `frontend/lib/capital-com/capital-com-client.ts` | Epic-Namen, Orders, Stops beim Broker |
| `frontend/lib/trading-filters/trade-filters.ts` | alle sieben Handelsfilter |
| `frontend/lib/agents/orchestrator-agent.ts` | Watchlist, Schwellen, Duplikat-Schutz |
| `frontend/instrumentation.ts` | alle Schleifen, Killswitch-Sperren, Python-Lifecycle |
| `frontend/lib/killswitch/` | Notaus |
| `frontend/lib/market-scanner/ai-analysis-engine.ts` | GPT-Prompt — bestimmt Richtung, Stop und Ziel |

`.env`-Dateien niemals anzeigen, ändern oder einchecken.

## Wenn ein Epic oder Symbol geändert wird

Ein Epic ist Schlüssel in **acht** Tabellen: `MIN_SIZE`, `PIP_VALUE_PER_UNIT`,
`MAX_SIZE`, `DEFAULT_STOP_BY_STYLE` in drei Handelsstilen sowie
`INSTRUMENT_META` in `orchestrator-agent.ts` und in
`app/api/market-scanner/route.ts`. Alle zusammen ändern oder gar nicht — sonst
greift die Grössen-Klemme für diesen Markt ins Leere. `epic-tables` prüft das.

Eine Symbol-Liste existiert an **sechs** Stellen, inklusive der Watchlist der
Backtest-Engine und der Symbol-Auflösung im Python-Backend. `watchlist-sync`
prüft das.

## Struktur

| Dienst | Ordner | Sprache |
|---|---|---|
| `destinate` (Frontend, Agenten, Broker, Schleifen) | `frontend/` | TypeScript / Next.js |
| `divine-warmth` + `exquisite-rejoicing` (Marktdaten, Indikatoren) | `backend/` | Python / FastAPI |
| `generous-creation` (Backtest, Walk-Forward, News) | `analysis-engine/` | Python / FastAPI |

Die Handelslogik liegt in **TypeScript**, nicht in Python. Es gibt kein
`layers/`-Verzeichnis.

## Belegen statt vermuten

Behauptungen über das Verhalten des Systems gehören mit Beleg versehen — Codestelle,
Messung oder Logzeile. Das Ausbleiben eines Fehlers beweist nichts, solange ein
anderer Fehler denselben Pfad abfangen kann.

## Snapshot kritischer Werte

Der neunte Prüfer hält 296 Zahlen, Schalter und Texte fest, die über Risiko entscheiden:
alle Grössen- und Stop-Tabellen, die Standardwerte der Einstellungen, die
Exit-Schwellen und Haltedauern, die Klemmen des AI Managers, die Prüfsumme des
GPT-Regelteils, die Reihenfolge der Filterkette, die Konstanten des
Struktur-Stops und seit dem 23.08. die Volatilitäts-Skalierung des Risikos.

Letztere war bis dahin von **keinem** Prüfer erfasst. Vorgeführt: die Schwelle
von `3.0` auf `30.0` gezogen — damit greift die 0,4×-Klemme für sehr hohe
Volatilität nie mehr — und alle sechzehn Prüfer blieben grün. Erfasst wird die
Kette jetzt **als Folge mitsamt Vergleichszeichen** (`">3.0=>0.4"`), damit auch
ein gedrehtes Zeichen oder zwei vertauschte Stufen auffallen; beides lässt die
Menge der Zahlen unverändert.

Ein Snapshot **rechnet aber nicht**. Ein Umbau bei gleichen Literalen bliebe
unsichtbar — deshalb prüft `vola-skalierung` dieselbe Funktion zusätzlich durch
Aufrufen. Nachgewiesen am 23.08.: von sieben Sabotagen fingen **fünf nur der
rechnende Prüfer** (`else` entfernt, geteilt statt multipliziert, Ergebnis
verworfen, Datenklemme entfernt, Order bekommt ungekürztes Risiko).

Die übrigen Prüfer sichern **Strukturen** — dass ein Eintrag existiert. Sie
merken nicht, wenn jemand seinen **Wert** ändert. Vorgeführt: `MAX_SIZE` für
BTCUSD von 0.05 auf 5.0, das hundertfache Risiko, und das ganze Netz blieb grün.

Seit dem 10.08. auch **Schalter** (`true`/`false`). Bis dahin hielt der Snapshot
ausschliesslich Zahlen — damit war kein einziger Schalter gesichert:
`pyramidingEnabled`, `blockOverfitMarkets`, `allowMeasuredConsensus`,
`useFullModelsForScan`, `tradeLimitEnabled`, `pauseOnLoss`,
`exitThresholdsRelativeToStop`. Jeder liess sich im Standardwert umdrehen, und
das ganze Netz blieb grün — `tradeLimitEnabled` auf `false` heisst kein
Tageslimit.

Wird ein Wert bewusst geändert, den Snapshot mitziehen:

```bash
node scripts/checks/snapshot.js --update
```

Die Datei `scripts/checks/snapshots/kritische-werte.json` gehört ins Repository.
Eine Änderung daran ist im Diff sichtbar und gehört im Commit begründet — genau
das ist der Zweck. Nie von Hand bearbeiten.

## Vor einer Änderung: wer hängt daran?

```bash
node scripts/checks/system-map.js --impact lib/agents/risk-agent.ts
```

Antwortet mit: wer diese Datei benutzt (direkt und über Umwege), was sie selbst
braucht, und welche Prüfer sie absichern. **Bei Dateien mit erhöhtem Risiko vor
der Änderung ausführen** — genau dort ist wiederholt etwas übersehen worden,
weil eine Abhängigkeit nicht bekannt war.

Die Karte `SYSTEM_MAP.md` wird aus den Importen **erzeugt**, nicht von Hand
gepflegt — statische und dynamische (`await import(...)`, davon gibt es über
neunzig). Der zehnte Prüfer meldet jede neue oder entfernte Abhängigkeit
namentlich. Nach einer beabsichtigten Änderung mitziehen:

```bash
node scripts/checks/system-map.js --update
```

Selbstprüfung des Auflösers (muss 0 offene melden):

```bash
node scripts/checks/system-map.js --audit
```

**Was die Karte nicht kann:** Sie zeigt, wer wen aufruft. Kopplung über
gemeinsame *Werte* (Epic-Namen über acht Tabellen) oder gemeinsame *Ressourcen*
(zwei Systeme schreiben denselben Broker-Stop) sieht sie nicht — dafür sind die
übrigen Prüfer da. Sie ergänzt sie, sie ersetzt sie nicht.
