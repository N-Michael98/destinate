# Arbeitsregeln für dieses Repository

Diese Datei wird zu Beginn jeder Sitzung automatisch gelesen. Sie muss nicht
manuell geschickt werden.

## Vor und nach jeder Änderung

```bash
cd frontend && npm run check
```

Läuft in rund 2,5 Sekunden, braucht keine Installation. Sieben Prüfer, Rückgabe
0 = grün. **Rot heisst: nicht committen, erst beheben.**

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

**Eine Ausnahme seit dem 10.08.:** der elfte Prüfer `exit-schwellen` **rechnet**.
Er übersetzt `risk-agent.ts` und ruft `wirksameSchwellen()` wirklich auf — 29
Rechnungen über fünf gemessene Märkte. Damit fällt dort auch ein subtil falscher
Umbau auf (Kehrwert statt Anteil, vertauschte Schwelle), der strukturell
unauffällig bliebe. Für alle anderen Pfade gilt der Absatz oben weiter.

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

Der neunte Prüfer hält 289 Zahlen, Schalter und Texte fest, die über Risiko entscheiden:
alle Grössen- und Stop-Tabellen, die Standardwerte der Einstellungen, die
Exit-Schwellen und Haltedauern, die Klemmen des AI Managers, die Prüfsumme des
GPT-Regelteils, die Reihenfolge der Filterkette und die Konstanten des
Struktur-Stops.

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
