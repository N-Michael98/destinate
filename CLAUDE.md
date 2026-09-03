# Arbeitsregeln für dieses Repository

Diese Datei wird zu Beginn jeder Sitzung automatisch gelesen. Sie muss nicht
manuell geschickt werden.

## Vor und nach jeder Änderung

```bash
cd frontend && npm run check
```

Braucht keine Installation. **Dreiundzwanzig Prüfer**, Rückgabe 0 = grün.
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

**Vierzehn Prüfer sind die Ausnahme: sie RECHNEN.** Sie übersetzen die echte
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
| `lifecycle-rueckkehr` | `nachzuregistrieren()`, `stammdatenAusNotizen()`, `notizenBefund()`, `positionenOhneStammdaten()` | 18.08. |
| `python-ueberwachung` | `meldePythonAufruf()`, `pythonUebergang()` | 19.08. |
| `vola-skalierung` | `getVolatilityAdjustedRisk()` | 23.08. |
| `kurs-riegel` | `checkPriceAvailable()` | 24.08. |
| `lern-quelle` | `echteGeschlosseneTrades()`, `runLearningCycle()` | 24.08. |
| `preis-cache` | `preiseUebernehmen()`, `priceCache`, `marketHealth` | 26.08. |
| `einstellungen-ausfall` | `loadFromDB()`, `get()` bei DB-Ausfall | 01.09. |
| `prompt-zahlen` | `promptZahl()`, `promptVerstoesse()` | 01.09. |
| `menue-ansichten` | `brokerZustand()`, `ausfuehrungsStand()` | 03.09. |

Für alle anderen Pfade gilt der Absatz oben weiter.

## Modul-scoped Zustand ist in diesem Projekt ein Fehler

Wird ein Zustand vom **Handelszyklus geschrieben** und von einer **API-Route
gelesen** (oder umgekehrt), gehört er auf `global`. Eine modul-scoped
`let`/`private` reicht nicht: API-Routen und die Loops in `instrumentation.ts`
sehen verschiedene Kopien desselben Moduls.

Das ist keine Vermutung. Am **28.07.** hat genau das den Killswitch
ausgehebelt — die Begründung steht in `killswitch-engine.ts:12`. Am **26.08.**
stand derselbe Fehler im Preis-Cache und hätte den Fix dort wirkungslos
gemacht: die Route hätte weiter eine leere Kopie gesehen, und die Anzeige hätte
repariert ausgesehen, ohne es zu sein.

Bewährt: `global.__killswitch_state__`, `global.__capital_session__`,
`global.__icmarkets_session__`, `global.__last_scan_result__`,
`global.__price_cache__`, `global.__daily_trades__`.

Der Prüfer `preis-cache` bildet den Fall nach: er lädt das Modul **zweimal**,
schreibt über die eine Instanz und liest über die andere. Wer einen neuen
geteilten Zustand baut, prüft ihn genauso — eine Struktur-Prüfung sieht diesen
Fehler nicht.

## Das Dashboard ist EINE Seite, kein Satz von Seiten

`app/page.tsx` hält oben `navGroups` (die Menüeinträge) und 3500 Zeilen weiter
unten die Kette `if (activeView === "…") return <X />;`. Beide Listen müssen
deckungsgleich sein — der Prüfer `menue-ansichten` erzwingt das in beide
Richtungen.

Am **26.08.** waren sie es nicht: „Live Prep" stand im Menü ohne Render-Zeile,
als einziger von 29. Der Klick fiel auf `CenterPlaceholder` durch, und der
meldete dort **„Status: Prepared"** in Grün samt „bewusst aus dem Hauptdashboard
ausgelagert". Es gab die Ansicht nie.

Der Durchfall bleibt bestehen — ein vergessener Eintrag soll eine erklärende
Seite ergeben statt einer leeren. Er sagt jetzt **„Nicht gebaut"**.

Wer eine Ansicht hinzufügt, braucht **beides**: Menüeintrag und Render-Zeile.

## Ohne Kurs kein Regime — und kein „Live" ohne Beleg

`priceCache` (`lib/market-data-engine/`) hatte bis zum 26.08. **keinen
Schreiber**. Drei Ansichten lasen daraus, eine davon im Dashboard alle 20
Sekunden. Jetzt füllt ihn `fetchMarkets()` am Ende jedes Handelszyklus mit der
Marktliste, die es ohnehin schon beim Broker geholt hat — reiner Nebeneffekt in
`try/catch`, keine zusätzliche Broker-Anfrage, `supplemented` bleibt unberührt.

Der Cache **verfällt nach 10 Minuten** (`CACHE_MAX_ALTER_MS`). Ein
stehengebliebener Zyklus soll keine stundenalten Kurse als aktuell ausgeben —
derselbe Fehler wie am 02.08., nur eine Schicht höher. Ein unlesbarer
Zeitstempel gilt als **abgelaufen**, nicht als frisch.

`previousBid`/`previousAsk` kommen aus dem **vorherigen** Cache-Eintrag. Ohne
sie meldet `detectTrend()` für jedes Symbol für immer `RANGING`/50.

`market-health.ts` **leitet ab statt zu behaupten**. Dort standen feste Zeilen:
TradingView „verbunden, 20 ms" (dieses Programm holt von dort keine Kurse — es
gibt nur ein Chart-Widget) und Capital.com „nicht verbunden" (es *ist* der
Live-Broker). `latencyMs` ist ersatzlos entfallen: hier wird keine Latenz
gemessen, und eine ungemessene Zahl auszugeben ist genau der Fehler.

**Ein Wort im Kommentar ist keine Verwendung.** Diese Fehlerklasse hat 2026
sechsmal zugeschlagen: ein Prüfer suchte nach einem Namen und fand ihn in einem
Kommentar, einer Logzeile oder an einer anderen Aufrufstelle — während die
echte Verdrahtung fehlte. Zuletzt am 18.08. im Sabotage-Lauf von
`lifecycle-rueckkehr`. Wer zählt, ob etwas *benutzt* wird, muss Kommentare und
Zeichenketten vorher entfernen (`ohneKommentareUndTexte()` dort).

## Gelernt wird aus echten Trades, nicht aus Simulationen

`runLearningCycle()` in `lib/learning/trade-feedback-engine.ts` las bis zum
24.08. **ausschliesslich die Papierhandels-Historie**. Der Zyklus lernte also
aus Simulationen, während die echten geschlossenen Trades in der
`Trade`-Tabelle danebenlagen — und dem Bericht sah man das nicht an.

Jetzt: `echteGeschlosseneTrades()` liest `status != "OPEN"` aus der Datenbank,
Standardquelle ist `"echt"`, und die Quelle steht **im Bericht**
(`quelle: "echt" | "papier" | "beide"`).

Beide Quellen werden **nicht vermischt**. Papier ist Simulation, echt ist echt;
ein gemeinsamer Topf ergäbe eine Kennzahl, der man nicht ansieht, wie viel
davon erfunden ist. `"beide"` bleibt möglich, muss aber verlangt werden.

Ausgeschlossen werden: **offene** Trades (ihr `profitLoss` ist ein
Zwischenstand, kein Ergebnis) und Zeilen **ohne Markt** (sie landeten sonst als
Symbol `UNKNOWN` mit eigener Win-Rate in der Lerntabelle). Beides wird gemeldet,
nicht still verworfen.

**Was das NICHT tut:** am Handel ändert sich nichts. `getLearningAdjustmentFactor()`
wird nur von `strategy-evolution/evolution-engine.ts` gelesen, und das läuft in
keiner Schleife. Der Weg vom Gelernten zum Handel ist eine eigene, bewusste
Entscheidung — und gehört erst gegangen, wenn gemessen ist, dass das Lernsignal
etwas taugt.

**Zweiter Lernstrang, weiterhin schlafend:**
`lib/learning-feedback-integration/` und `lib/outcome-learning-auto-update/`
rechnen mit fest eingebauten Mock-Daten und haben **gar keinen** Konsumenten.
Ins Dashboard gelangt daraus nur `learning: READY`, keine erfundenen Zahlen.
Entscheidung offen: verdrahten oder entfernen.

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
| `frontend/lib/trading-filters/trade-filters.ts` | die ganze Filterkette (neun Stufen, siehe `filterReihenfolge` im Snapshot) |
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

Der neunte Prüfer hält 298 Zahlen, Schalter und Texte fest, die über Risiko entscheiden:
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

**Fehlende Daten kürzen jetzt ebenfalls** (24.08.). Bis dahin gab die Funktion
bei fehlendem ATR oder Preis das Grundrisiko **ungekürzt** zurück: bekannt hohe
Volatilität bekam 40 %, gar keine Information 100 % — die falsche Richtung.
Erreichbar über `taSignals: undefined` (`ai-analysis-engine.ts`), bei einem
Python-Ausfall für **alle** Symbole gleichzeitig. Jetzt greift
`RISIKO_OHNE_VOLA_DATEN = 0.4`, der kleinste Faktor der Tabelle, weil sich das
oberste Band nicht ausschliessen lässt.

Belegt ungefährlich: `capital-com-execution.ts` klemmt die Grösse mit
`Math.max(min, …)` auf `MIN_SIZE` **hoch** — ein kleineres Risiko kann die
Position nur verkleinern, nie einen Nullauftrag erzeugen. 70 018 Fälle alt
gegen neu gerechnet: 70 000 identisch, 18 anders (ausnahmslos die entarteten
Eingaben), **null** Änderungen bei gültigen Daten, **null** Fälle mit
steigendem Risiko.

## Ohne Kurs wird nicht gehandelt

Die Filterkette prüfte, ob der Kurs **frisch** ist — aber nicht, ob es ihn
überhaupt gibt. `checkLiquidity` gab bei `bid <= 0` sogar ausdrücklich
`allowed: true` zurück: ohne Preis lässt sich kein Spread-Anteil rechnen, also
wurde durchgewunken. Ohne Preis ist aber auch die Positionsgrösse, der Einstieg
und jede Verlustgrenze geraten.

Seit dem 24.08. steht `checkPriceAvailable()` als **erster** Schritt der Kette,
vor der Frische-Prüfung und ohne Einstellung, die ihn abschalten könnte
(`blockedBy: "PRICE_MISSING"`).

**Ehrlich eingeordnet:** über den Livepfad war der Fall nicht erreichbar — der
Scanner filtert `markets.filter((m) => m.bid > 0)` und baut die Gelegenheiten
aus genau dieser Liste. Nachgeprüft, nicht angenommen. Es ist also eine
Zusicherung an der Stelle, an der sie gilt, kein geschlossenes Loch. Sie gehört
trotzdem dorthin: `runAllFilters` gibt ein Versprechen, das nicht davon abhängen
darf, dass ein Aufrufer zwei Module weiter vorsichtig war.

`Number.isFinite` steht dort mit Absicht: `NaN <= 0` ist **false**, ein
NaN-Preis käme sonst durch. Genau das fing im Sabotage-Lauf **nur** der
rechnende Prüfer — von sieben Sabotagen fünf, darunter auch ein zu STRENGER
Riegel, der gültige Kurse blockt hätte.

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
