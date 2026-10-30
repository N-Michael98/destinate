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

**Fünfzehn Prüfer sind die Ausnahme: sie RECHNEN.** Sie übersetzen die echte
TypeScript-Datei und rufen die echte Funktion auf. Damit fällt dort auch ein
subtil falscher Umbau auf (Kehrwert statt Anteil, vertauschte Schwelle,
fehlender Null-Fall), der strukturell unauffällig bliebe:

| Prüfer | ruft wirklich auf | seit |
|---|---|---|
| `ai-clamp` | `inGrenzen()` | 11.08. |
| `exit-schwellen` | `wirksameSchwellen()` | 10.08. |
| `teilgewinn` | `teilgewinnErlaubt()`, `teilgewinnStand()` | 11.08. |
| `signal-untergrenze` | die Untergrenze der Signalkette; seit 15.09. auch `wirksameApproveSchwelle()` und `rrVerteilung()`; seit 17.09. `stilGrenze()` — ein fehlendes Stil-Tageslimit heisst nicht mehr „unbegrenzt" | 13.08. |
| `order-bestaetigung` | `ausstiegsgrund()`, `stopAbstandGenug()` | 13.08. |
| `lifecycle-rueckkehr` | `nachzuregistrieren()`, `stammdatenAusNotizen()`, `notizenBefund()`, `positionenOhneStammdaten()` | 18.08. |
| `python-ueberwachung` | `meldePythonAufruf()`, `pythonUebergang()` | 19.08. |
| `vola-skalierung` | `getVolatilityAdjustedRisk()` | 23.08. |
| `kurs-riegel` | `checkPriceAvailable()` | 24.08. |
| `lern-quelle` | `echteGeschlosseneTrades()`, `runLearningCycle()` | 24.08. |
| `preis-cache` | `preiseUebernehmen()`, `priceCache`, `marketHealth` | 26.08. |
| `einstellungen-ausfall` | `loadFromDB()`, `get()` und der SCHREIBpfad beider Speicher (Einstellungen + AI-Konfiguration) bei DB-Ausfall | 01.09. |
| `prompt-zahlen` | `promptZahl()`, `promptVerstoesse()`; seit 15.09. auch `normalisiereStil()` — ein unbekannter Handelsstil wird WAIT, nicht geraten | 01.09. |
| `menue-ansichten` | `brokerZustand()`, `ausfuehrungsStand()` | 03.09. |
| `safety-nets` | `isWithinTradingSession()` — das Tor fuer JEDEN neuen Trade; seit 15.09. auch `alarmEntscheidung()` (Zyklus-Absturz), `watchdogDarfStarten()`, `eskalationsEntscheidung()` und den echten Ereignis-Speicher (gleichzeitige Ereignisse, Obergrenze), dazu ein Riegel, der jeden `fs`-Import im Programm ohne Freigabe rot werden lässt; seit 17.09. ein Prüfstand für den Diagnose-Agenten (EIN Bus, ZWEI Modulkopien, echte Ereignisse, gezählte Telegram-Alarme) und die Bus-Verdrahtung; seit 22.09. `brokerZeitNachUtc()` (Ortszeit → UTC, inklusive Winterzeit), `ageInMinutes()` (eine Zukunft ist nicht „frisch") und `fetchStrategySignals()` — gegen einen **echten HTTP-Server** auf 127.0.0.1, der 502/401/200 spielt, mit gezählten Anfragen | 07.09. |

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

**Am 25.10. wurde genau diese Regel dreimal übergangen — von mir.** An einem
Tag kamen drei neue geteilte Zustände dazu (`__journal_sync_lage__`,
`__capital_reconnect_lage__`, `__telegram_lage__`), und keiner wurde so
geprüft. Dass sie `global.` benutzen, steht im Quelltext — **ob der Zustand
zwischen zwei Modulkopien wirklich geteilt wird, sieht man dort nicht.**

Die Folge wäre nicht theoretisch: die Schleifen laufen aus
`instrumentation.ts`, die Routen in `app/api` sehen eine **andere** Kopie. Wäre
der Zustand modul-scoped, drosselte jede Kopie für sich — statt einer Zeile
alle 30 Minuten kämen zwei, und bei einem Dauerausfall wäre das Log wieder
zugemüllt.

`safety-nets` hält das jetzt für alle drei (458 → **473** Prüfungen): zwei
Modulkopien, melden über A, prüfen über B, plus die Gegenprobe nach der
Drosselzeit. **3 von 3 Sabotagen** — jede ersetzt `global.` durch eine
Modulvariable, also wörtlich den Fehler vom 28.07.

### Und die SPERRE gehört mit auf `global` (17.09.)

Der Zustand kann richtig auf `global` liegen und der Fehler trotzdem bleiben —
wenn die **Anmeldesperre** modul-scoped bleibt.

`diagnostics-agent.ts` hatte seinen Zustand seit dem 16.09. auf
`global.__diagnose_zustand__`, aber daneben stand weiter `let initialized =
false`. Aufrufer sind `instrumentation.ts` (Start) und
`app/api/diagnostics-agent/route.ts` (erster Request) — zwei Modulkopien, jede
mit eigener Sperre, **beide melden sich an**.

Bis zum 16.09. folgenlos, weil jede Kopie auch ihren eigenen Bus hatte. Seit
der Bus auf `global` liegt, hängen beide Empfänger am **selben** Bus: jedes
Ereignis wird doppelt verarbeitet. Gemessen im Prüfstand: ein Ereignis, `count`
2 statt 1, derselbe Fehler zweimal im Speicher, die Alarmschwelle nach zwei
statt drei echten Ereignissen — und `systemStatus: DEGRADED` geht in die
Entscheidung der Orchestrator-KI ein.

Regel: **Wer einen geteilten Zustand baut, legt die Sperre dorthin.** So macht
es `bilanzAbonnieren()` (`zyklus-bilanz.ts`), so macht es jetzt
`initDiagnosticsAgent()`. `safety-nets` lädt das Modul **zweimal**, meldet
beide an und zählt die Empfänger.

### Ein Abo am Bus ohne Sender ist ein Fehler (17.09.)

Drei tote Verdrahtungen, gefunden beim Abgleich aller Sende- und Abo-Stellen:
der Diagnose-Agent hörte auf `EXECUTION:TRADE_CLOSED` (sendet niemand — der
einzige Sender war bis zum 16.09. eine falsch benannte KI-Ablehnung) und auf
`DIAGNOSTICS:HEALTH_CHECK` (sendet niemand), und antwortete darauf mit
`DIAGNOSTICS:ALERT` (hört niemand). Dazu sendete der Orchestrator denselben
„Alarm" beim pausierten Zyklus. **`getRecentEvents` hat null Aufrufer** — ein
Ereignis ohne Empfänger geht wirklich ins Leere.

`safety-nets` hält das jetzt: jedes `.subscribe` ohne Sendestelle wird rot, und
die Nutzlast-**Schlüssel**, die die Zyklus-Bilanz liest (`scan`, `ausgang`,
`symbol`+`direction`, `symbol`+`grund`), werden gegen die Sendestellen
gehalten. Sonst meldet die Tagesbilanz eines Tages stumm „Broker-Fehler:
EURUSD: ".

**Zwei eigene Messfehler dabei**, beide gehören zur Methode: ein Regex bis zum
Zeilenende übersah jede **einzeilige** Sendestelle (vier Ereignisse galten
fälschlich als senderlos) — jetzt ein Klammerzähler mit Selbstprüfung gegen
zehn bekannte Stellen. Und die Schlüssel-Erkennung zählte auch **Werte**: bei
`direction: req.direction` galt der Wert als Schlüssel, eine Umbenennung wäre
grün geblieben.

### Und die Kehrseite: ein Lesepfad darf ihn nicht ANLEGEN (07.09.)

Der Zustand kann korrekt auf `global` liegen und trotzdem verlorengehen — wenn
zwei Stellen ihn **erstmalig anlegen** und die eine dabei weniger weiss als die
andere. Wer zuerst anlegt, gewinnt.

Belegt an `global.__daily_trades__`. Der Orchestrator stellt den Zähler nach
einem Neustart aus Redis wieder her, aber nur unter einer Bedingung
(`orchestrator-agent.ts:511`):

```ts
if (!global.__daily_trades__ || global.__daily_trades__.date !== today) {
  global.__daily_trades__ = { date: today, count: redisDailyRaw?.count ?? 0, … };
}
```

Der **Statusbericht** `GET /api/auto-execute` legte denselben Zähler per
`ensureDailyTrades()` mit `count: 0` an — ohne Redis zu fragen. Er läuft alle
60 Sekunden (`MarketScannerPanel` bei Auto-Scan), der Orchestrator alle 5
Minuten. Nach jedem Deploy mit geöffnetem Dashboard sah der Orchestrator also
einen vorhandenen Eintrag mit heutigem Datum, übersprang die Wiederherstellung
— und `maxTradesPerDay` begann von vorn. Redeploys sind hier Routine.

Regel: **Ein Lesepfad schreibt gemeinsamen Zustand nicht.** Braucht er einen
Wert, den es noch nicht gibt, liest er dieselbe Quelle wie der Besitzer (hier
Redis) und meldet, was er findet. Der Prüfer `order-bestaetigung` sichert genau
das ab.

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

## Ein Netz, das nur in eine Richtung greift, ist keines

Am **07.09.** wurde der Scan auf das konfigurierte Modell umgestellt. OpenAI
antwortete mit `403 — Project … does not have access to model gpt-4o`, und der
Scanner lieferte in **jedem** Zyklus null Gelegenheiten.

Das Netz dagegen existierte. Der Kommentar darüber lautete wörtlich „eine
Modell-Sperre darf nie die komplette Analyse schwärzen". Die Bedingung war:

```ts
if (raw === null && scanGptModel !== ai.openai.model)
```

Sie feuert nur, wenn das **günstige** Modell benutzt wurde. Nach der Umstellung
sind beide gleich — **das Netz war genau im Ernstfall abgeschaltet**. Für
Anthropic gab es gar keines.

Wer einen Rückfall baut, prüft **beide** Richtungen. Und wenn der Rückfall
greift, gehört das ins Log: sonst steht oben „nutzt die konfigurierten Modelle"
und man glaubt es.

## Ein Ausfall darf sich nicht als Ergebnis ausgeben

Dieselbe Runde, eine Stufe weiter. Antwortete Claude nicht:

```ts
const riskScore = parsed.riskScore ?? 50;    // erfundene 50
approved: riskScore < 60 && parsedRR >= 1.5  // 50 < 60 ist WAHR
source: "CLAUDE_REAL"                        // obwohl nichts kam
```

Das Risiko-Tor fiel **still** weg — die Freigabe hing nur noch am R/R — und das
Ergebnis trug trotzdem das Etikett einer echten Beurteilung. Exakt die Lüge,
die am 01.09. eine Zeile weiter unten für `simulateClaude` behoben wurde; im
Zweig daneben stand sie noch.

Ein Rückfallwert (`?? 50`) an einer Stelle, die über Geld entscheidet, ist fast
immer falsch: er macht aus „unbekannt" eine Messung. Jetzt führt der Ausfall auf
`simulateClaude` — abgeleitet statt erfunden, ehrlich benannt
(`CLAUDE_SIMULATED`) und **strenger** als der Rückfall vorher.

Dieselbe Fehlerklasse in der Konfiguration: `ai-config-store.ts` speicherte
einen Lesefehler bedingungslos zwischen, und seine Standardwerte lauten
`gpt-4o-mini` / `claude-haiku-4-5`. Ein Aussetzer beim Start hätte das Modell
für die ganze Laufzeit auf die billige Variante geklemmt — und der Scan hätte
dazu „nutzt die konfigurierten Modelle" gemeldet. Behoben am 07.09., abgesichert
in `einstellungen-ausfall`.

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

**Zweiter Lernstrang — ERLEDIGT, die Entscheidung ist gefallen (15.09.).**
Hier stand bis heute: „`lib/learning-feedback-integration/` und
`lib/outcome-learning-auto-update/` rechnen mit fest eingebauten Mock-Daten und
haben gar keinen Konsumenten. Entscheidung offen: verdrahten oder entfernen."

**Beide Ordner gibt es nicht mehr** — entfernt in `e3afcf8` („Das Dashboard
zeigte die Gesundheit erfundener Trades — jetzt die echte"). Die Anweisung
beschrieb also seit Wochen eine offene Entscheidung, die längst getroffen war.
Nachgeprüft, nicht vermutet: `ls frontend/lib` kennt beide Namen nicht, und
`git log` nennt den Commit.

Das ist die Fehlerklasse „ein Wort im Kommentar ist keine Verwendung", eine
Ebene höher: **eine Anweisung, die etwas beschreibt, das es nicht mehr gibt.**
Wer sie liest, sucht nach Arbeit, die keine ist.

Noch vorhanden sind drei ähnlich benannte Module —
`broker-execution-quality-learning`, `outcome-learning-evolution-feedback-sync`
und `performance-outcome-learning-sync`. Sie sind **nicht** dasselbe: keine
Mock-Spuren, und sie hängen aneinander bzw. an einer API-Route. Sie gehören zum
toten Bereich auf Routen-Ebene (siehe unten), nicht zu den entfernten
Mock-Modulen.

## Der tote Bereich liegt bei den ROUTEN, nicht bei den Modulen

Die Reichweiten-Rechnung auf Modul-Ebene sagt „erreichbar", sobald **irgendeine**
API-Route ein Modul importiert. Sie fragt nicht, ob diese Route je gerufen wird.
Genau dort liegt der tote Bereich.

Gemessen am **15.09.** über alle Routen, gesucht ausschliesslich im Quelltext
(`tsconfig.tsbuildinfo` und `.next` enthalten jeden Dateipfad und haben in
dieser Sitzung zweimal tote Routen „benutzt" aussehen lassen):

**149 API-Routen, 67 ohne jeden Aufrufer** (Stand 15.09. abends; hier stand
65, eine zweite Messung am Mittag ergab 64, kommentarbereinigt waren es 68 —
davon wurde `/api/validation-agent` entfernt).

**`/api/validation-agent` gibt es nicht mehr.** Sie war der einzige
Dateizugriff im ganzen Programm: sie las Dateien nach Namen aus dem
Anfrage-Rumpf (`.env.local` wäre durchgekommen), rief `git diff` per exec, und
ihre dynamischen Pfade liessen Turbopack das **ganze Projekt** ins
`standalone`-Bündel verfolgen — gemessen 331 Quelldateien samt `CLAUDE.md` im
Railway-Image. Nach dem Entfernen: 0 Build-Warnungen, 0 Quelldateien im Bündel,
Prisma-Engine weiter enthalten. `safety-nets` lässt jeden neuen `fs`-Import
rot werden, solange er nicht namentlich freigegeben ist.

Dabei drei Fehler in der eigenen Messung gefunden und behoben — alle gehören
zur Methode, nicht zum Code:
- **Kommentare wurden mitgezählt.** `/api/validation-agent`, `/api/ai-health`,
  `/api/debug-pnl` und `/api/icmarkets/symbols` galten als benutzt, weil ihr
  Name in einem Kommentar steht („Nutzung: … via /api/validation-agent").
  Genau die Fehlerklasse aus dem Abschnitt oben — diesmal in der Messung, die
  sie aufdecken sollte. Erst kommentarbereinigt sind es 68.
- Routen mit dynamischem Segment (`/api/trades/[id]`) werden als
  `` `/api/trades/${id}` `` gerufen; der literale Pfad steht nirgends. Sie
  müssen über ihren **statischen Anfang** gesucht werden, sonst gelten sie zu
  Unrecht als tot (betraf `/api/trades/[id]` und `/api/python/[...path]`).
- Ein Gefahren-Regex auf `.create(` traf `openai.responses.create(` und machte
  aus `/api/chat` fälschlich einen Datenbank-Schreiber.

**Das wichtigste Ergebnis ist ein negatives:** von den 65 kann **keine** eine
Order platzieren, schliessen oder einen Stop verschieben. Genau **zwei** Routen
im ganzen Programm platzieren Orders — `/api/capital-com/execute` und
`/api/icmarkets/execute` — und beide haben einen Aufrufer.

Damit das so bleibt, hält `safety-nets` jetzt eine **Positivliste**: kommt eine
dritte Route dazu, die Orders platziert, wird sie rot — egal ob sie gerufen
wird. Genau das hätte `/api/auto-execute` am 07.09. von selbst gefunden.

Der Telegram-Webhook schliesst Positionen (Notfall-Befehl) und ist die einzige
gewollte Ausnahme — abgesichert durch Chat-ID-Liste **und** Admin-Passwort vor
jedem zustandsändernden Befehl.

## Vorgehen bei Änderungen

1. Bestehenden Code lesen, bevor etwas geändert wird
2. `npm run check` — grün? Sonst zuerst das beheben
3. **Eine** Sache auf einmal ändern
4. `npm run check` erneut, bei kritischen Änderungen zusätzlich `npm run build`
5. Rot → zurückrollen und erklären, nicht weiterbauen

## Erst zeigen, dann bauen — und wann nicht (27.09.)

Damit nicht jede Kleinigkeit eine Rückfrage braucht und trotzdem nichts
Teures ohne Zustimmung passiert, gilt eine **Schwelle**:

**Plan zeigen und auf ein ausdrückliches Ja warten** — immer bei:
- den acht Dateien mit erhöhtem Risiko (Tabelle unten),
- allem, was eine Order, eine Grösse, einen Stop oder ein Limit berührt,
- Änderungen an `.env`-Umgebung, Schlüsseln, Rechten oder Deploy-Konfiguration,
- einem `git push` (er deployt sofort auf das Live-System),
- dem Entfernen von Code, der heute läuft.

Der Plan nennt: **welche Datei**, **was genau sich ändert**, **was es NICHT
tut**, und **wie es geprüft wird**.

**Direkt machen und danach zeigen** — bei Prüfern, Sabotage-Nachweisen,
Logzeilen, Kommentaren, Dokumentation und allem, was `npm run check` selbst
absichert. Eine Rückfrage zu einem Kommentar kostet mehr, als sie schützt.

**Immer, ohne Ausnahme:** `npm run check` vor **und** nach der Änderung, eine
Sache auf einmal, und bei Rot zurückrollen statt weiterbauen.

## Wenn etwas bricht: erst stoppen, dann zurückrollen (27.09.)

Git ist hier **nicht** der schnellste Rückweg. Ein Revert plus Railway-Deploy
braucht Minuten — in denen das System weiterhandelt. Deshalb diese Reihenfolge.

### Schritt 1 — Blutung stoppen (Sekunden)

Es gibt **zwei** Killswitches, und sie tun **nicht dasselbe**. Nachgelesen im
Code, nicht vermutet:

| | Dashboard: Security Center | Telegram `/killswitch` bzw. `/ks` |
|---|---|---|
| Neue Trades | gestoppt | gestoppt |
| Broker-Verbindung | getrennt, Reconnect gesperrt | getrennt |
| **Offene Positionen** | **bleiben offen** — `ordersCancelled: 0, // bewusst 0`, geschützt nur durch die Broker-seitigen SL/TP | **werden geschlossen** (`executeFullShutdown`) |
| Zugang | Anmeldung am Dashboard (JWT über `proxy.ts`) | nur aus der Chat-ID in `TELEGRAM_CHAT_ID`, danach Admin-Passwort (`KILLSWITCH_PASSWORD`), 60 Sekunden Zeitfenster |

**Welchen wann:**
- Das Programm entscheidet falsch, die offenen Positionen sind in Ordnung →
  **Dashboard**. Die Positionen behalten ihre Stops beim Broker.
- Die offenen Positionen sind selbst das Problem → **Telegram `/killswitch`**.
  Das ist auch der schnellste Weg ohne Laptop.

`/status` zeigt, ob er aktiv ist. Der Zustand liegt auf
`global.__killswitch_state__` **und** in Redis (`killswitch:state`, 30 Tage);
`instrumentation.ts:200` stellt ihn beim Start wieder her — **er überlebt
einen Deploy**. Ein Redeploy ist also kein Reset.

**Voraussetzung, die im Ernstfall zu spät auffällt:** ist
`KILLSWITCH_PASSWORD` in Railway nicht gesetzt, antwortet der Bot mit
„KILLSWITCH_PASSWORD nicht in Railway gesetzt" und tut **nichts**
(`webhook/route.ts:176`). Dasselbe gilt für `TELEGRAM_CHAT_ID`: ist sie leer,
passt keine Chat-ID, und jede Nachricht wird abgewiesen. Beides gehört
**einmal im Ruhezustand geprüft** — ein Killswitch, den man erst im Notfall
testet, ist keiner.

### Schritt 2 — Ursache feststellen, bevor irgendetwas zurückgeht

Railway-Log des betroffenen Dienstes lesen. `destinate` und `divine-warmth`
sind getrennte Dienste mit getrennten Logs — am 22.09. stand die Ursache
eines Fehlers ausschliesslich im Log des **anderen** Dienstes.

### Schritt 3 — Zurückrollen

```bash
git log --oneline -10          # welcher Commit war der letzte gute?
git revert <hash>              # erzeugt einen NEUEN Commit
npm run check                  # muss grün sein
git push                       # Railway deployt automatisch
```

**`git revert`, nicht `reset` und nicht `checkout <hash>`.** `main` ist
gepusht und wird deployt: `reset` bräuchte einen Force-Push und würde die
Historie umschreiben, `checkout <hash>` ergibt einen abgekoppelten HEAD, in
dem jede weitere Arbeit verlorengeht. Ein Revert ist ein ganz normaler
Commit — nachvollziehbar und selbst wieder umkehrbar.

Nur **uncommittete** Änderungen verwirft man mit `git checkout -- <datei>`
(gezielt) oder `git restore .` — beides ist endgültig, vorher `git status`
lesen.

### Am 27.09. live geprüft — und dabei zwei falsche Texte gefunden

Der Notaus wurde einmal im Ruhezustand ausgelöst und zurückgesetzt
(19:12:10 → 19:12:45). **Er funktioniert**, `KILLSWITCH_PASSWORD` ist gesetzt,
und `/reset` reicht. Drei Belege aus dem Log:

```
19:12:41  [position-monitor] 🔴 Killswitch aktiv — Zyklus übersprungen
19:12:44  [killswitch]       🟢 ZURÜCKGESETZT — Trading wieder freigegeben
19:14:45  [position-monitor] 2min Zyklus gestartet
```

Dabei fielen zwei `details`-Texte auf, die etwas behaupteten, das der Code
nicht tut — beide korrigiert und jetzt durch `safety-nets` an das Verhalten
gebunden:

- **„Trading-Loops … gestoppt" war falsch.** Es gibt im ganzen Programm
  **kein** `clearInterval`. Die Schleifen laufen durch und fragen bei jedem
  Durchlauf `isKillswitchActive()` ab — die erste Logzeile oben ist der
  Beweis. Der Unterschied ist nicht kosmetisch: wer „gestoppt" liest,
  zweifelt im Ernstfall, ob `/reset` genügt. Es genügt, **gerade weil** nichts
  gestoppt wurde.
- **„Credentials bleiben gespeichert" gilt nur für Capital.com.** Bei IC
  Markets **ist** der Redis-Token der Zugang, und `clearICMarketsSession()`
  löscht ihn. Es gibt keine zweiten Zugangsdaten — deshalb meldet `/reset`
  dort „Token nicht in Redis — bitte manuell verbinden".

**Und der Keep-Alive holt ihn NICHT zurück.** Nachgeprüft, nicht vermutet:
`global.__icmarkets_session__` wird an genau drei Stellen gesetzt —
`setICMarketsSession()`, `clearICMarketsSession()` (auf `null`) und
`restoreICMarketsSessionFromRedis()` (nur beim Serverstart, und Redis ist
leer). `keepAliveICMarkets()` ruft `autoReconnectICMarkets()` **nur, wenn
`icGetAccount()` fehlschlägt** — und die MCP-Schicht meldet sich bei HTTP 404
selbst neu an, sodass der Aufruf gelingt. Damit greift die Wiederherstellung
nie, und die Zeile `[IC Markets] keep-alive ✅` erscheint trotzdem, während
die Anwendung IC als getrennt führt.

**Heute ohne Handelsfolge:** `icMarketsExecutionEnabled` steht auf `false`
(`settings-store.ts:19`, im Snapshot gesichert), und `/api/icmarkets/execute`
ruft nur ein Knopf im Dashboard.

**Der Widerspruch im Log ist am 25.10. behoben.** Die Ursache war eine Klammer:
die `✅`-Zeile stand **ausserhalb** von `if (global.__icmarkets_session__)`.
Ist die Sitzung `null`, wird nichts aktualisiert — und trotzdem stand alle zwei
Minuten `keep-alive ✅` im Log, während die Anwendung IC als **getrennt** führt.
Dieselbe Fehlerklasse wie die zwei falschen Killswitch-Texte: eine Meldung, die
etwas behauptet, das der Code nicht tut.

Jetzt steht die Erfolgsmeldung **im** Zweig, und der andere Fall sagt, was Sache
ist: *„Konto erreichbar, aber KEINE Sitzung in der Anwendung"* — denn
`icGetAccount()` gelingt auch ohne unsere Sitzung (die MCP-Schicht meldet sich
bei 404 selbst neu an), die Abfrage sagt also **nichts** darüber, ob die
Anwendung verbunden ist. Dazu verschluckt das `catch` seine Fehler nicht mehr
still. **3 von 3 Sabotagen**, 473 → **477** Prüfungen.

### Eine Drawdown-Grenze kann „verloren" nicht von „abgehoben" unterscheiden (29.09.)

Am 28.09. meldete der Bot **„-84.63 % (Limit -15 %), Höchststand 10000.00,
Aktueller Stand 1536.53"** und sperrte jeden neuen Trade.

**Die Ursache war kein Verlust und kein Fehler im Handel.** Der Nutzer hatte
das Capital.com-**Demokonto** vor längerer Zeit selbst von 10000 auf 2000
gesenkt, um zu sehen, wie das Programm mit kleinen Summen handelt. Der
Höchststand von 10000 war **echt** — er stammte aus der Zeit davor.

Eine Grenze, die vom höchsten je gesehenen Kontostand misst, liest eine
**Auszahlung** als Verlust. Sie kann die beiden nicht trennen, weil sie nur
einen Kontostand sieht und keine Buchung.

**Warum ausgerechnet diese Grenze zur Sackgasse wurde**, die anderen zwei
aber nicht — nachgesehen, nicht vermutet:

| Grenze | Schlüssel | heilt sich selbst? |
|---|---|---|
| Tagesverlust | `day_start_balance:<Datum>`, 48 h TTL | **ja, jeden Tag neu** |
| Wochenverlust | `week_start_balance:<ISO-Woche>`, 8 Tage | **ja, jeden Montag** |
| **Gesamt-Drawdown** | `peak_balance`, **1 Jahr**, ein fester Schlüssel | **nie** |

Die ersten beiden setzen ihren Bezugspunkt von selbst neu. Der dritte nicht —
deshalb war er der einzige, der nach einer manuellen Kontoänderung dauerhaft
sperrte. Genau dafür gibt es jetzt `/peakreset`.

**Der Fund hatte trotzdem sein Gutes:** die Suche nach der Ursache hat drei
echte Löcher aufgedeckt, die mit diesem Tag nichts zu tun hatten (siehe
`7bc3d95`) — eine Anmeldung ohne Kontostand, zwei erfundene `10000` und eine
Sperre, die beim nächsten Mal stumm geblieben wäre. Der Verdacht war falsch,
die Funde sind es nicht.

### Der Gesamt-Drawdown war eine Sackgasse — jetzt gibt es `/peakreset` (29.09.)

Er misst vom **höchsten je gesehenen** Kontostand, und der liegt ein **Jahr**
in Redis. Bis heute gab es aus einer Sperre genau zwei Auswege: den Kontostand
über den Höchststand heben oder die Grenze hochziehen. Nach einem
Demokonto-Reset — oder nach einem Höchststand, der **gar nicht echt war** —
ist das keiner.

```
/peakreset          → nennt den gespeicherten Höchststand und den Kontostand
<Admin-Passwort>    → löscht ihn (60-Sekunden-Fenster, wie /killswitch)
```

Der nächste Zyklus setzt den Höchststand dann auf den **aktuellen**
Kontostand — derselbe Weg, den der allererste Lauf ohnehin geht, kein
Sonderfall. **Die Einstellung „Max Total Drawdown" bleibt unverändert**, nur
der Bezugspunkt wird neu gesetzt.

Der Befehl **senkt den Schutz**, deshalb: dasselbe Admin-Passwort wie der
Killswitch, der alte Wert steht in der Bestätigung, und der Vollzug geht als
eigene Meldung in den Kanal. Ein stiller Reset wäre schlimmer als gar keiner.

`safety-nets` führt die Kette **aus**: Sperre → Reset → nächster Zyklus nimmt
den aktuellen Stand → Sperre weg → Schutz greift sofort wieder vom neuen
Bezugspunkt. Dazu: der Schlüssel `peak_balance` darf **genau einmal** im
Programm als Zeichenkette vorkommen (`PEAK_SCHLUESSEL`), und ein
Redis-Ausfall darf nicht als Erfolg durchgehen.

### Ein Admin-Passwort gehört nirgends echot (29.09.)

Die Fehlmeldung bei falschem Passwort lautete:

```ts
Eingabe: <code>${text.slice(0, 20)}***</code>
```

Ein Tippfehler im **letzten** Zeichen des richtigen Passworts schickte damit
bis zu zwanzig **richtige** Zeichen im Klartext in den Chat. Es ist der eigene
Kanal — aber ein Telegram-Verlauf liegt auf jedem angemeldeten Gerät und auf
Telegrams Servern, und er lässt sich nicht zurückholen. Jetzt nennt der Alarm
nur noch **Länge** und **Art** („sah aus wie ein Befehl" / „Freitext").

**Und ein Befehl ist kein Passwort.** Die Bestätigungs-Prüfung steht **vor**
der Befehlsauswertung: wer innerhalb der 60 Sekunden `/status` schickte, dessen
Befehl galt als Passwortversuch — falscher Alarm, und über die Zeile oben stand
der Befehl dann im Alarmtext. Eine Nachricht mit `/` bricht die Bestätigung
jetzt ab und läuft als normaler Befehl weiter. **Preis:** das Admin-Passwort
darf nicht mit `/` beginnen; die Abbruch-Meldung sagt das.

**Beides ist mit einem Regex nicht ehrlich prüfbar** — es hängt an der
Reihenfolge der Zweige. `safety-nets` führt deshalb die echte `POST`-Funktion
mit echten Nachrichten aus (`fetch` ersetzt, Umgebungsvariablen gesichert und
zurückgestellt). Von fünf Sabotagen ist die vierte die feinste: der
Abbruch-Zweig bleibt stehen, kehrt aber zurück statt durchzufallen — der
Befehl verpufft dann. Strukturell unauffällig, nur im Lauf sichtbar.

**Und ein Auffang-Zweig ist dabei verschwunden.** Die Passwort-Bestätigung im
Telegram-Webhook endete mit `} else {` — und darin stand der **vollständige
Shutdown**. Jede nicht erkannte Aktion löste damit nach korrektem Passwort
einen Killswitch aus, inklusive Schliessen aller Positionen. Wer eine neue
Aktion einbaut und den Zweig vergisst, hätte unbemerkt den Notaus verdrahtet.
Jetzt ist `killswitch` ein eigener, benannter Zweig; ein unbekannter Name tut
**nichts** — sagt das aber, statt zu schweigen.

### Schritt 4 — Erst entsperren, wenn der Fix live ist

`/reset` (Telegram, mit Passwort) oder der Reset-Knopf im Security Center.
Vorher prüfen, dass der neue Deploy wirklich läuft — eine Deploy-Kennung ist
**kein** Commit-Hash (siehe Zeitstempel-Abgleich).

### Was NICHT hilft

`git add .` — es nimmt auch unbekannte neue Dateien auf. Besser `git status`
lesen und dann `git add -A`. Seit dem 27.09. fängt `.gitignore` jede `.env`
in jedem Verzeichnis, und der Prüfer `secrets` erzwingt das; davor war genau
das die Lücke.

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

## Die Zeit des Brokers ist Ortszeit — und eine Zukunft ist nicht „frisch" (22.09.)

Capital.com schickt seine Zeitstempel **ohne Zonenangabe** und liefert **kein
UTC-Feld**. Gemessen im Betrieb:

```
19:04:11  updateTime="2026-09-22T19:04:06.857"  (als UTC gelesen: 120.0 min gegen jetzt)
          updateTimeUTC=FEHLT
```

Der Kurs war **fünf Sekunden** alt. `new Date()` las die Zeit als UTC und bekam
zwei Stunden **in der Zukunft**. Getragen hat den Fehler eine einzige Zeile in
`ageInMinutes()`:

```ts
return age >= 0 ? Number(age.toFixed(1)) : 0; // Zukunft (Zeitzonen-Drift) = frisch
```

Damit war das Kurs-Alter `max(0, echt − 120)`:

| echtes Alter | berechnet | Filter (max 30) |
|---|---|---|
| 45 min | 0 | **durch — hätte blocken müssen** |
| 150 min | 30 | **durch** |
| 151 min | 31 | geblockt |

**Die eingestellten 30 Minuten wirkten wie 150.** Dazu kam der Zeit-Exit 2 h zu
spät (SCALPING lief 6 statt 4 Stunden) und dieselbe Verschiebung in der
Python-Haltedauer nach jedem Neustart. Nicht betroffen: Preis-Cache und
Markt-Gesundheit, die mit unserer eigenen Empfangszeit rechnen.

**Regel:** Jede Broker-Zeit wird **an der Grenze** umgerechnet
(`brokerZeitNachUtc()` in `capital-com-client.ts`, sieben Stellen). Kein
Aufrufer weiter innen darf eine rohe Broker-Zeit sehen. Trägt sie schon eine
Zone, wird sie nur normalisiert; fehlt sie, bleibt sie **leer** — niemals
`new Date()`.

**Eine Zeitzone, keine festen zwei Stunden.** Am 25.10. endet die Sommerzeit,
dann sind es 60 Minuten. Dass die Zone wirklich `Europe/Zurich` ist, belegt die
Messung nur für einen Tag — deshalb prüft `zeitzonenSelbstpruefung()` bei jedem
Kursabruf nach und meldet als Fehler, wenn ein umgerechneter Kurs in der
Zukunft liegt.

**Und eine Zukunft wird nicht mehr versteckt:** bis 2 Minuten gilt sie als
Uhren-Versatz (0), darüber heisst sie **unbekannt** (`null`), und der Filter
sagt hörbar „Kurs-Alter unbekannt — nicht blockiert, aber ungeprüft". Die
stille 0 war die Lüge, die den Fehler zwei Monate getragen hat.

### Dieselbe Falle in der ANZEIGE — und warum sie lokal unsichtbar ist (27.09.)

Auf `/status` antwortete der Telegram-Bot mit „27.9.2026, **12:48:11**".
Telegram zeigte dieselbe Nachricht um **14:48**. Zwei Stunden.

`toLocaleString("de-CH")` **ohne** `timeZone` formatiert in der Zeitzone des
**Prozesses**. `TZ` ist nirgends gesetzt, auf Railway ist das UTC. Vier
Stellen in `telegram-sender.ts` gaben die Zone mit, **dreizehn** andere nicht
— im selben Chat standen damit zwei verschiedene Zeiten für denselben Moment.

**Warum es lokal nicht auffällt:** auf einem Rechner, der ohnehin in Zürich
steht, liefern beide Formen **dasselbe**. Ein Vergleich im laufenden Prozess
wäre grün gewesen, egal ob die Zone mitgegeben wird. Der einzige Beleg war
die Differenz im Screenshot.

Deshalb läuft die Prüfung in `safety-nets` in einem **Kindprozess mit
`TZ=UTC`** — so wie Railway. Nachgerechnet werden Sommer (14:48 MESZ), Winter
(13:48 MEZ, die Umstellung am 25.10. greift von selbst) und der Tageswechsel
(22:30 UTC ist in Zürich schon der nächste Tag). Alle 17 Stellen gehen jetzt
über `telegramZeit()` / `telegramDatum()`, und ein nacktes `toLocale…` im
Telegram-Weg wird rot.

Von fünf Sabotagen ist die zweite die lehrreichste: ein **fester Versatz von
zwei Stunden** statt der Zeitzone. Das sieht richtig aus und stimmt bis zum
25.10. — genau die Falle, die beim Broker-Fix fünf Tage vorher vermieden
wurde.

## Eine Stufe ohne eigene Zahl verschwindet aus der Bilanz (22.09.)

Zum **zweiten Mal** dieselbe Fehlerklasse, zwei Tage nach dem ersten Fund.

Am 22.09. 21:17 antwortete `/api/v1/strategies/analyze/multi` mit **502**.
`fetchStrategySignals` gab eine leere Map zurück, damit fiel `strategienOk`
für **alle 30 Märkte**, damit `hasFullData`, damit jedes `goSignal`. GPT hatte
acht Richtungssignale geliefert; es folgten **exakt acht** 🔒-Zeilen und GO 0.
Ein einziger Gateway-Fehler kostet den ganzen Zyklus.

Die Bilanzzeile meldete davon nichts:

```
GPT 22W/5B/3S | Veto 0 | <Grenze 2 (65–68) | Freigabe-Nein 0 | GO 0
8 − 0 − 2 − 0 − 0 − 0 = SECHS Signale ohne jede Erklärung
```

Und selbst die zwei „<Grenze" sind irreführend: das Daten-Tor steht im
Trichter **vor** der Confidence, sie starben also auch am Ausfall. In der
Tagesbilanz hätte ein solcher Abend gelautet „60 BUY · 36 SELL … GO: 0" — zu
lesen als „die KI wollte nicht" statt „das Backend war weg".

`ohneStopZiel` hat am 20.09. genau dieses Loch eine Stufe weiter hinten
geschlossen. Jetzt trägt `ScanDaten` auch `ohneVolleDaten` **samt Grund**
(`Strategien` / `TA-Lib` / `TA-Lib+Strategien`) — die Zahl allein sagt nicht,
welcher Dienst ausgefallen ist, und genau das ist die Frage, mit der man ins
Railway-Log steigt.

**Regel:** Jede Stufe, an der ein Signal sterben kann, braucht eine **eigene
Zahl** in der Bilanz. Sonst ist ein Datenausfall von einem Urteil nicht zu
unterscheiden. Gezählt wird im **selben `if`**, das auch die Logzeile schreibt
— `safety-nets` erzwingt das per Klammerzählung, damit Log und Bilanz nicht
auseinanderlaufen.

### Wer den Grund nicht mitschreibt, muss ihn später raten

Im Log stand nur `502 Bad Gateway`. Der **Antwortkörper** — in dem Railway
bzw. FastAPI die Ursache nennt — wurde weggeworfen. Damit war die Ursache aus
unseren eigenen Logs **nicht zu bestimmen**. `callClaude` macht es seit jeher
richtig (`await res.text()`), diese Stelle nicht.

Das ist „belegen statt vermuten", angewandt auf die **Messung selbst**. Jetzt
steht der Körper in der Meldung, dazu die Folge im Klartext („dieser Zyklus
handelt NICHT"), und ein 5xx oder Netzfehler bekommt **einen** zweiten Versuch
— nacheinander, im **gemeinsamen** Zeitbudget (60 s), damit der Scan nie in
den nächsten Zyklus läuft. Ein 400/401/404/**429** wird nicht wiederholt: der
Fehler kehrt deterministisch zurück, und bei 429 wäre Nachlegen genau falsch.

**Und das wird AUSGEFÜHRT, nicht beschrieben.** `safety-nets` startet einen
echten HTTP-Server auf 127.0.0.1 und **zählt die Anfragen**: 502→200 ergibt
zwei, 401 ergibt eine, 200 ergibt eine. Vier Sabotagen, die strukturell völlig
unauffällig bleiben (zweiter Versuch nie ausgelöst, Regel gerechnet aber
ignoriert, Schleife statt einem Nachfragen, Rückfall verschwiegen), werden
**nur** so gefangen.

### Die Ursache war ein Neustart des Containers — nicht der Code

Nachgereicht aus dem Log von **`divine-warmth`** (dem Dienst selbst, nicht
`destinate`). Beide Zeitachsen nebeneinander:

| Uhrzeit | wo | was |
|---|---|---|
| 21:17:10 | destinate | Scan startet, `Promise.all` feuert TA / Strategien / MTF |
| **21:17:19** | **divine-warmth** | **`Starting Container`** |
| **21:17:20** | **divine-warmth** | `Application startup complete` · `Uvicorn running` |
| 21:17:40 | destinate | `502 Bad Gateway` nach 27 s Wartezeit |

Die Anfrage lief **genau in das Neustartfenster**. Belegt, nicht vermutet:
dieser Container protokolliert **keine einzige** `/talib/` oder `/strategies/`
Anfrage vor **21:22:23** — die TA-Lib- und MTF-Aufrufe desselben Zyklus wurden
also noch von der **vorherigen** Instanz bedient. Deshalb gingen drei von vier
Anfragen durch und nur eine nicht.

**Zwei Dinge, die daraus folgen:**

1. **Die Wiederholung hätte genau diesen Zyklus gerettet.** Der 502 kam um
   21:17:40, der Container war seit 21:17:20 bereit — **20 Sekunden vorher**.
   Der zweite Versuch (502 + 2 s Pause = 21:17:42, Restbudget 31 s) wäre auf
   einen gesunden Dienst getroffen.
2. **Die zwei Sekunden Pause sind gemessen, nicht geraten.** Von
   `Starting Container` bis `Uvicorn running` vergeht **eine** Sekunde. Ein
   längeres Warten würde hier nichts verbessern.

**Meine Überlast-Vermutung war falsch.** Ich hatte notiert, dass `Promise.all`
vier gleichzeitige Anfragen gegen einen uvicorn-Prozess ohne `--workers` feuert
(bis zu 44 Arbeits-Threads). Das ist zwar ein Code-Fakt, aber **nicht** die
Ursache: seit dem Neustart bedient derselbe Prozess dieselbe Last fehlerfrei.
Belegt mit `200 OK` für `/strategies/analyze/multi` in **vier** Zyklen —
21:22:45, 21:27:46, 21:37:44, 21:42:44 — und mit 3× `talib` in **fünf**
(zusätzlich 21:32:21; die Strategien-Zeile des 21:32-Zyklus liegt ausserhalb
des vorliegenden Log-Ausschnitts und wird deshalb **nicht** mitgezählt). Die
Vermutung stand als Vermutung da und ist damit widerlegt — so gehört es.

**Nicht bestimmbar und damit offen:** *warum* der Container um 21:17:19 neu
startete. Im Log steht davor **kein** Traceback, kein `Killed`, kein
OOM-Hinweis — nur der Start selbst. Ein einzelner Neustart, danach 25 Minuten
stabil.

### Ein Zeichen-Fenster im Prüfer beweist Nähe, nicht Zugehörigkeit

Beim Anbau wurde `prompt-zahlen` rot, obwohl der Code stimmte. Die Prüfung
lautete `/risikoBrauchbar[\s\S]{0,400}?claude = simulateClaude\(…\)/` — eine
längere Logzeile sprengte das Fenster.

**Nachgemessen statt aufgezogen:** der richtige Aufruf liegt 761 Zeichen
entfernt, der **nächste aus einem ganz anderen Zweig** bei 1642. Ein Fenster
von 1700 wäre grün gewesen — auch mit **gelöschtem** Riegel. Vorgeführt.

Jetzt wird der Block per Klammerzählung ausgeschnitten und nur darin gesucht.
Dieselbe Falle in der Gegenrichtung: eine Prüfung auf `res.text().catch` fand
den Aufruf in `callClaude` 1500 Zeilen weiter oben und blieb grün, obwohl er
an der geprüften Stelle entfernt war — die Fehlerklasse „ein Wort im Kommentar
ist keine Verwendung" in der Spielart **„eine andere Aufrufstelle"**.

### Und eine Diagnose darf im interessanten Fall nicht schweigen

`⛔ SPX500: Claude hat GEANTWORTET, aber ohne brauchbaren riskScore
(undefined)` — dazu verwies die Sammelzeile auf „HTTP-Status und Antworttext".
**Beides gibt es in diesem Zweig nicht:** der Aufruf war HTTP 200, und `raw`
wurde nie ausgegeben. Ob Claude Prosa lieferte, das Feld vergass oder ablehnte,
war nicht feststellbar. Jetzt stehen Länge und die ersten 200 Zeichen der
Antwort in der Zeile, und die Sammelzeile behauptet keinen Fehlschlag mehr.

## Ein Regex, der eine Modellantwort liest, ist eine Zeitbombe (30.09.)

Telegram 30.09. 12:09: **„KI-Sicherheitstor Meta-KI nicht erreichbar —
Rückfall aktiv"**, Fehler `Unexpected non-whitespace character after JSON at
position 653`. Die Stelle war eine Zeile:

```ts
const json = text.match(/\[[\s\S]*\]/)?.[0];
if (json) { JSON.parse(json) … }
```

Der Ausdruck ist **gierig**: vom **ersten** `[` bis zum **letzten** `]` im
ganzen Text. Daraus folgen **zwei** Fehlerbilder, beide nachgerechnet:

| Antwort des Modells | alte Zeile | Folge |
|---|---|---|
| Array **+ Prosa mit Klammer** („… [siehe oben]") | zieht die Prosa mit hinein, `JSON.parse` wirft | `catch` → **jeder Kandidat freigegeben**, Tor ganz offen (laut gemeldet) |
| **abgeschnitten**, kein `]` | findet **gar nichts**, wirft **nicht** | `decisions` bleibt leer → jeder Kandidat fällt in `if (!meta \|\| !meta.approve)` → **„Meta-AI hat abgelehnt"**. **Stille Totalablehnung** |

Die zweite ist die gefährlichere: sie sieht aus wie ein Urteil, meldet sich
nicht, und kostet **alle** Trades des Zyklus.

**Und sie war scharf.** `goSignals` ist nicht begrenzt — bei dreissig Märkten
kommen dreissig Kandidaten an. `max_tokens` stand fest auf **500**. Gemessen:
ein Eintrag ist ~91 Zeichen ≈ 25 Token, dreissig also **~735** — über der
Grenze. Exakt dieselbe Falle wie `tokenBudget()` am 06.09.: *„Die Watchlist
hat inzwischen DREISSIG Märkte, und der Wert wurde nie mitgezogen."*

**Jetzt:** `metaAntwortLesen()` zählt Klammern **mit Zeichenketten-Bewusstsein**
(eine `]` in `"concern":"RSI 82]"` schliesst nichts), sammelt **alle** Paare
auf oberster Ebene und nimmt das **erste, das sich wirklich als Urteilsliste
lesen lässt**. Ein leeres Array, Zahlen aus einem Fliesstext und ein Objekt
statt eines Arrays sind **keine** Urteile. Jede unlesbare Antwort ist ein
**Ausfall mit Grund** und geht denselben Weg wie eine ausgebliebene —
Rückfall **und** Meldung. `max_tokens` kommt aus `metaTokenBudget()`, nach
unten auf 500 geklemmt (nie weniger Platz als bisher).

**Zwei eigene Fehler dabei, beide gehören zur Methode:**
- Die erste Fassung nahm das **erste** balancierte Paar — und scheiterte an
  einer Klammer in der **Vorrede** („Hier das Ergebnis [Meta-Analyse]:").
  Vom eigenen Durchstich gefangen.
- Der erste Testfall für die Zeichenketten-Erkennung benutzte `[RSI 82]` — ein
  **balanciertes** Paar, an dem eine fehlende Erkennung gar nicht auffällt.
  Die Sabotage blieb grün. Jetzt eine **einzelne** Klammer: `"RSI 82]"`.

## Eine verwaiste dealId ergab ZWEI Journal-Zeilen pro Trade (30.09.)

Die 🔎-Diagnose vom 21.09. hat endlich eine offene Position erwischt — und
zeigte **viermal dasselbe Muster**, bei jedem XRPUSD-Trade seit dem 24.09.:

```
#778 CLOSED 09-29T15:17Z stil=DAYTRADING  dealId≠…  ref  exit=KEIN_PNL
#779 OPEN   09-29T15:18Z stil=UNBEKANNT   dealId=…  REKONSTRUIERT
```

Eine Minute Abstand — genau **ein** Sync-Zyklus. Die echte Zeile lief danach in
die P&L-Abstimmung, fand nichts (ihre dealId gehört zu keiner Position) und
wurde nach fünf Versuchen als `KEIN_PNL` mit P&L 0 geschlossen. Das **echte**
Ergebnis trug die rekonstruierte Zeile — mit `stil=UNBEKANNT`, also **ohne
Zeit-Exit**.

**Zwingend, nicht gedeutet:** `ergaenzeFehlendeJournalZeilen` legt nur an, wenn
KEINE offene Zeile ohne dealId existiert. Eine Zeile ohne dealId hätte
blockiert. Also trug die echte Zeile eine dealId — **eine andere als die der
offenen Position**.

Geprüft wurde nur „Zeile OHNE dealId". Eine Zeile mit einer dealId, die bei
**keiner** offenen Position vorkommt, rutschte durch. Die Absicht stand schon
im Kommentar („schlimmer als die Lücke"), die Bedingung war eine Stelle zu eng.

**Was das kostet:** der Zeit-Exit ist für die real laufende Position ausgesetzt,
und `echteGeschlosseneTrades()` liest die Notizen **nicht** — beide Zeilen gehen
in die Lernstatistik, jeder Trade bekommt einen erfundenen Nulltrade dazu. Ohne
Handelsfolge heute, weil `getLearningAdjustmentFactor()` in keiner Schleife
läuft. `ETIKETTEN_OHNE_ERGEBNIS` verlässt seine Datei nie und filtert nirgends.

Jetzt entscheidet `rekonstruktionsLage()` — eine **ausführbare** Funktion, kein
Ausdruck in der Schleife: eine verwaiste dealId blockiert die Rekonstruktion
genauso wie eine fehlende, und sie wird **namentlich** ins Log geschrieben,
samt der Liste der wirklich offenen IDs. Ohne diese Zeile bliebe genau die
Frage offen, wegen der es den Riegel gibt.

**Was das NICHT tut:** die Ursache der abweichenden dealId ist damit **nicht**
behoben. Verdacht, im Code gelesen und ausdrücklich als Verdacht notiert:
`capitalPlaceOrder` und `capitalConfirmDeal` nehmen beide das **Top-Level**
`dealId` aus `/confirms`, `capitalGetPositions` liest `position.dealId`, und
`affectedDeals` kommt im ganzen Programm **nicht vor** (nachgezählt). Der
Beleg muss aus dem Log kommen — dafür nennt die 🔎-Zeile jetzt die **vollen**
IDs und die Herkunft (`via=CONFIRMS` / `via=POSITIONSLISTE` / `via=POSITION`).

**Der eigene Anteil daran:** die 🔎-Zeile zeigte `id.slice(-12)`. Zwei IDs, die
sich am **Anfang** unterscheiden, sahen damit identisch aus — die Diagnose
konnte die Frage, für die sie gebaut wurde, nicht beantworten. Fehlerklasse
„eine Diagnose darf im interessanten Fall nicht schweigen", diesmal in der
Messung selbst.

**Und der Prüfer war blind.** `lifecycle-rueckkehr` ruft diese Funktion seit dem
18.08. **echt** auf — fünf Fälle, alle grün, auch mit dem Fehler. Ein Prüfer,
der den Fehler nicht kennt, beweist nichts über ihn. Jetzt Fall 6 plus acht
Rechnungen auf `rekonstruktionsLage()`; von sieben Sabotagen wurden zuerst
**sechs** gefangen. Die siebte entwischte — und das war **mein Testfall**, nicht
der Prüfer: er deckte das `.trim()` der Positions-Seite nur zufällig ab
(dieselbe Falle wie `[RSI 82]`). Dazu eine Sabotage, die **nicht** rot werden
kann: `.filter(Boolean)` auf den Positions-IDs ist nachweislich unerreichbar,
weil `offen.has(d)` nur für ein `d` läuft, das `if (!d)` schon passiert hat.
Das als „entwischt" zu zählen wäre ein Messfehler gewesen, kein Befund.

### Der Riegel allein war ein Halbfix — die Zeile muss VERHEIRATET werden

Nachgerechnet gegen die echte Funktion, am selben Tag: der Riegel verhindert
nur, dass beide Zeilen **gleichzeitig** offen stehen. Die P&L-Abstimmung
(`LIKE '%dealId%'`) sammelt die verwaiste Zeile ein und schliesst sie nach fünf
Versuchen als `KEIN_PNL`. Danach ist keine Zeile mehr verwaist, `erlaubt` wird
wieder wahr — **und es wird doch rekonstruiert**. Am Ende standen weiterhin zwei
Zeilen, und der Stil der laufenden Position blieb `UNBEKANNT`.

`ergaenzeDealIdsAusPositionen` übersprang `if (m.dealId) continue` — also jede
Zeile mit einer dealId, auch einer falschen. Jetzt entscheidet
`zeileBrauchtZuordnung()`: eine **verwaiste** dealId kommt in die Zuordnung,
`zuordnungAusPositionen()` korrigiert sie bei eindeutiger Lage, und die Zeile
behält ihren **echten** Stil — der Zeit-Exit rechnet wieder mit 4/24/168 Stunden
statt gar nicht.

**Zwei Risiken, beide abgesichert statt in Kauf genommen:**
- Eine **verwaiste** Zeile braucht einen brauchbaren Einstiegskurs.
  `zuordnungAusPositionen` überspringt den Kursvergleich, wenn einer der Kurse
  fehlt — für eine junge Zeile ohne dealId richtig, für eine ALTE gefährlich:
  auf demselben Symbol kann eine NEUE Position laufen, und die alte Zeile trüge
  ihr einen falschen Stil ein. Genau der Fehler, nur umgekehrt.
- Eine verwaiste Zeile darf **nicht** als `NIE_BESTAETIGT` sterben. Sie TRUG
  eine dealId, war also bestätigt; das Etikett heisst „hat es nie gegeben" und
  hätte einen echten Trade als Phantom in die Statistik geschrieben.

Die alte ID bleibt als `dealIdVorher` stehen — sie ist der einzige Beleg dafür,
woher sie kam, und die Frage ist noch offen. Dieselbe Regel wie
`exitReasonVorher`.

**Von zwölf Sabotagen entwischten zuerst zwei — beide auf dieselbe Weise:**
`if (alt && alt !== dealId) neu.dealIdVorher = alt;` wurde zu `if (false) …`.
Der **Wortlaut** stand noch da, der Regex fand ihn, der Prüfer blieb grün. Ein
Regex prüft den Wortlaut, nicht das Verhalten. Jetzt läuft die ganze Kette
**ausgeführt**, mit der echten `zuordnungAusPositionen` statt einem
Stellvertreter. Die zweite hielt sich noch eine Runde länger: der Phantom-Schutz
sitzt im `ohnePosition`-Zweig, und den betrat der Prüfstand gar nicht — ein
Zweig, der nie betreten wird, ist so ungeprüft wie einer, der fehlt. **12/12.**

## Eine Anzeige, die „kommt noch" sagt, obwohl es läuft (30.09.)

`app/trading-journal/page.tsx` hielt **dreizehn** fest verdrahtete Aussagen, und
jede einzelne widersprach dem laufenden System:

| angezeigt | tatsächlich |
|---|---|
| Broker Integration — LOCKED, „V6.0" | Capital.com ist der **Live-Broker** |
| GPT / OpenAI — LOCKED, „Coming Soon" | macht den Marktscan |
| Claude — LOCKED, „Coming Soon" | Meta-Analyse + Risiko-Agent |
| Auto Execution — LOCKED, „Final Stage" | läuft |
| sechs „Future Connections" — alle „Coming Soon" | vier davon laufen |
| „V6.0 Broker Integration Layer vorbereiten" | gibt es |
| „V6.1 OpenAI/Claude Signal Review anbinden" | gibt es |
| „V6.2 Paper Trading Execution Engine bauen" | gibt es — **neun** Module |

Die Seite ist im Dashboard verlinkt (Menüeintrag **und** Render-Zeile), also
keine tote Ecke. Dieselbe Fehlerklasse wie „Live Prep / Status: Prepared"
(26.08.) und wie `market-health.ts` („TradingView verbunden, 20 ms") — nur in
die andere Richtung: etwas als **„kommt noch"** anzeigen, das längst läuft.

**Nicht kosmetisch:** wer im Ernstfall hier nachsieht, liest „Broker nicht
verbunden, Auto Execution noch nicht aktiv" — und entscheidet danach über den
Killswitch.

Jetzt leitet `integrationsStand()` (`lib/bot-readiness/integrationen.ts`) ab,
aus `/api/broker-status` (echte Sitzungen über `brokerZustand()`) und
`/api/settings`. **Alle drei Eingaben sind dreiwertig**: `null` heisst
*unbekannt*, nicht *nicht verbunden*. Eine stille Null wäre genau die Lüge vom
22.09., eine Schicht höher. Der Startwert der Seite ist deshalb überall `null`.

**Verbunden ist nicht dasselbe wie aktiv:** IC Markets meldet „Locked —
Ausführung in den Einstellungen abgeschaltet", auch wenn die Sitzung steht. Dort
wird nicht gehandelt (`icMarketsExecutionEnabled: false`), und „Ready" wäre die
nächste Behauptung.

**Und jede Zeile nennt ihren Grund.** „Locked" allein sagt nicht, ob etwas
fehlt, abgeschaltet ist oder nur nicht abrufbar war — drei Lagen, drei
Konsequenzen.

Die drei offenen Schritte sind **belegt, nicht ausgedacht**: MetaTrader 5 kommt
im ganzen Programm nicht vor (gesucht in `lib`, `app/api`, `backend/services`),
die IC-Ausführung steht auf `false`, und `getLearningAdjustmentFactor()` wird
nur von `strategy-evolution/evolution-engine.ts:56` gelesen — das läuft in
keiner Schleife. Die Fundstelle in `instrumentation.ts:835` ist ein
**Kommentar**: „ein Wort im Kommentar ist keine Verwendung".

`menue-ansichten` **rechnet** das jetzt (38 → 76 Prüfungen) und hält die Seite
zusätzlich strukturell fest: kehren die Literale zurück, verschwindet ein
`fetch`, oder steht der Startwert wieder auf `false`, wird er rot. **16 von 16
Sabotagen gefangen**, darunter der gefährlichste Rückbau — `dreiwertig()` auf
`v === true` zu verkürzen, womit jede fehlgeschlagene Abfrage wieder „nicht
verbunden" hiesse.

### Eine geprüfte Funktion, die nie echte Werte bekommt (30.09.)

Und genau danach passierte der Fehler, vor dem das alles schützen sollte —
**zweimal in derselben Datei**, beim Einbau:

```ts
data.zeilen?.find(…)                       // brokerZustand() gibt `broker`
data.settings?.icMarketsExecutionEnabled   // liegt unter `botSettings`
```

Beide Ausdrücke sind **immer `undefined`**. Die Anzeige hätte dauerhaft
„Unbekannt" gezeigt — und das sah aus wie ein ehrliches Ergebnis, weil
„Unbekannt" ja ein vorgesehener Zustand ist. Der Fix tarnte seinen eigenen
Ausfall.

**Was NICHTS davon gemerkt hat:** `tsc` nicht (die Felder sind optional
deklariert, `?.` auf einem unbekannten Feld ist gültiges TypeScript), der Build
nicht, und auch die **sechzehn Sabotagen** nicht. Die Funktion
`integrationsStand()` war vollständig und korrekt geprüft — sie bekam nur nie
echte Werte. Das ist die Fehlerklasse „ein Wort im Kommentar ist keine
Verwendung", angewandt auf die **Verdrahtung**: eine Prüfung, die eine Funktion
rechnet, beweist nichts über ihre Aufrufstelle.

**Regel:** Wer ein Feld aus einer fremden Antwort liest, holt den Namen an der
**Quelle** — nicht aus dem Gedächtnis. `menue-ansichten` führt dafür jetzt
`brokerZustand(null, null)` aus, sucht **selbst**, welches Feld die Liste trägt,
und hält die Seite an genau diesen Namen; den Pfad in den Einstellungen schneidet
er per Klammerzählung aus `DEFAULT_SETTINGS` aus. Benennt die Quelle um, wird er
rot — **die Gegenprobe ist mitgeprüft**, sonst hinge er an einem festen Namen und
bewiese nichts.

Von sechs Sabotagen: **fünf gefangen**, beide echten Fehler darunter. Die sechste
— `broker` in der **Typdeklaration** zu `brokerId` — kann `menue-ansichten`
nicht sehen, weil sie das Laufzeitverhalten nicht ändert. Ausgeführt und belegt:
`npx tsc --noEmit` meldet dafür **zwei** Fehler (TS2561, Zeile 117 und 135).
Richtiges Werkzeug, kein Loch — sie als „entwischt" zu zählen wäre ein
Messfehler. Dazu ein echter Messfehler, der behoben ist: der Prüfer suchte
`icMarketsExecutionEnabled` als **Teilzeichenkette** und fand sie noch in
`icMarketsExecutionEnabledXX`. Jetzt mit Doppelpunkt.

#### Wie weit reicht diese Fehlerklasse? Vollständig gemessen (22.10.)

Die Frage, die der Fund aufwirft: wenn ich den Feldnamen **zweimal** falsch
lese, wo noch? Fünfzehn Komponenten rufen eigene Routen ab.

**Ergebnis: 23 Variable↔Route-Paare automatisch geprüft, NULL Fehler** — und
die restlichen neun einzeln von Hand, ebenfalls ohne Befund. Die Lücke ist
damit nicht „benannt", sondern **geschlossen**.

Hier stand bis heute „automatisch nicht entscheidbar". Das war **Aufgeben, nicht
Gründlichkeit**: beide Muster, an denen das Werkzeug scheiterte, sind auflösbar.
Bei `const [a, b] = await Promise.all([fetch(R1)…, fetch(R2)…])` ist die
**Reihenfolge** die Zuordnung; bei `NextResponse.json(variable)` steht das
Literal im selben Rumpf. Dazu musste es dem **React-State** folgen
(`setZustand(daten)` → gelesen wird `zustand?.broker`, nie `daten.broker`).

**Fünf eigene Messfehler auf dem Weg, alle gefangen** — die gehören zur Methode:

| Messfehler | Folge | wer fing ihn |
|---|---|---|
| falsches Lesemuster gesucht | 0 Paare | Selbstprüfung |
| Schlüssel-Erkennung zählte **Werte** mit (`{ok: true}` → „ok", „true") | **28 Falschmeldungen** | Selbstprüfung |
| `(await res.json())` in Klammern + State nicht verfolgt | Selbstprüfung rot | Selbstprüfung |
| kein Variablen-**Geltungsbereich** (`d` mehrfach je Datei) | **15 Falschmeldungen** | Handprüfung |
| Bereich endete am *eigenen* statt am nächsten Abruf | 0 Paare | Selbstprüfung |

Der zweite ist exakt der Fehler, der weiter oben schon steht („die
Schlüssel-Erkennung zählte auch WERTE") — **dieselbe Falle, neues Werkzeug.**

**Die Selbstprüfung ist der ganze Grund, warum das Ergebnis etwas wert ist.**
Sie setzt einen Feldnamen künstlich falsch und verlangt, dass er gefunden wird;
ohne sie hätte ich dreimal „alles sauber" gemeldet. Null geprüft ist kein
sauberes Ergebnis, sondern ein kaputtes Werkzeug.

**Ehrlich zum Geltungsbereich:** der Fehler vom 30.09. selbst liegt
**ausserhalb**. `/api/broker-status` antwortet mit `json({ ok: true, ...zustand })`
— die Felder kommen aus einer **Funktion**, statisch nicht auflösbar. Genau
dafür gibt es den spezifischen Riegel in `menue-ansichten`, der
`brokerZustand()` **ausführt**. Eine Selbstprüfung an einem Fall ausserhalb des
Geltungsbereichs wäre unehrlich — sie bliebe ewig rot und bewiese nichts.

Die neun nicht automatisch entscheidbaren, **einzeln abgearbeitet**:

| Pfad | gelesen | Befund |
|---|---|---|
| `/api/capital-com/execute` | `ok`, `dealId`, `error` | das `ExecutionResult` ✅ |
| `/api/icmarkets/execute` | `positionId` | existiert, Rückfall `dealId`/`id` ✅ |
| `/api/capital-com/positions` | `d.positions` | `{ok, positions, connected, error}` ✅ |
| `/api/execution-queue-position-sync` | `d.report` | `{ok, report}` ✅ |
| `/api/mission-control/audit` | `auditReport.checks` | `json(report)`, `report.checks` ✅ |
| `/api/broker-status`, `/api/execution-status` | — | durch `menue-ansichten` **rechnend** gesichert ✅ |
| `/api/python/backtest/*` ×2 | — | Proxy über `[...path]`; die Antwort bestimmt FastAPI, und die Komponente liest keine Felder ✅ |

**Verschärfend und weiterhin wahr:** fast alle Komponenten lesen ihre Antwort
als `any` (`const d = await r.json()`), nur **eine** mit Typ. Bei `any` sagt
`tsc` zu **jedem** Feldnamen nichts — der Fehler vom 30.09. hatte wenigstens
noch eine Typdeklaration, die ihn hätte fangen können. Die Messung ersetzt das
nicht, sie stellt nur fest, dass heute keiner falsch steht.

## Ein stiller Aussetzer ist von einem gesunden Lauf nicht zu unterscheiden (25.10.)

Anlass: die Suche nach `dealId` im Railway-Log ergab **null Treffer**. Daraus
liess sich die Frage, auf die es ankam — *greift die dealId-Korrektur?* —
**nicht** beantworten, und zwar aus einem Grund im Code:

```ts
if (!isCapitalConnected()) return;      // keine Meldung
if (!posResult.ok) return;              // keine Meldung, Grund verworfen
```

`syncCapitalPositionsToJournal` hatte **zwei stille Rücksprünge**. Ein Sync,
der bei jedem Lauf sofort aussteigt, schreibt damit genau so viel wie ein
gesunder: nichts. Bei der zweiten Stelle ist es wörtlich „wer den Grund nicht
mitschreibt, muss ihn später raten" — `capitalGetPositions` liefert
`{ ok: false, error: "HTTP 401" }`, und der Grund landete im Nichts.

`syncAussetzerMelden()` entscheidet das jetzt als **ausführbare** Funktion:
jeder **Wechsel** der Lage wird gemeldet (auch die Rückkehr zu „läuft"), ein
**Dauerzustand** alle 30 Minuten erneut. Ohne die Wiederholung verschwände
genau der interessante Fall nach der ersten Meldung für immer — die Lehre aus
dem dealId-Nachtrag vom 02.09. Ein gesunder Dauerzustand schweigt, sonst wären
es 720 Zeilen am Tag.

Der Zustand liegt auf `global.__journal_sync_lage__`, nicht modul-scoped.

**10 von 10 Sabotagen**, darunter die Drossel in beide Richtungen (nie melden /
immer melden) und der verworfene Grund.

### Und eine Prüfung, die nie beweisen konnte, was sie behauptet

Beim Anbau wurde `lifecycle-rueckkehr` rot — an einer **bestehenden** Stelle:

```js
indexOf("await schreibeAusstehendeZeilen()") < indexOf("if (!isCapitalConnected()) return;")
```

Zwei Fehler auf einmal. Der Anker hing am **Wortlaut** (der Rücksprung wurde
zu einem Block, um zu melden). Und schwerer: **`indexOf(...) < -1` kann nie
wahr werden.** Fehlte der Wortlaut, war die Prüfung *immer* rot — unabhängig
von der Reihenfolge, die sie prüfen sollte. Sie bewies also nie das, was sie
behauptete, sondern nur, dass eine Zeichenfolge noch dastand.

Jetzt werden **beide Positionen auf Existenz** geprüft und dann die
Reihenfolge, und der Befund nennt sie (`schreibe@22435 sitzung@22233`).
Gegenprobe ausgeführt: den Aufruf hinter den Sitzungs-Riegel **verschoben** —
die korrigierte Prüfung wird rot, die alte hätte das nicht zuverlässig
gefangen.

### Dieselbe Klasse, zweimal nebenan: der Keep-Alive warf sein Ergebnis weg

Die Fehlerklasse an **einer** Stelle zu beheben, beantwortet nicht, wo sie noch
steckt. Systematisch gesucht über alle acht Einstiegsfunktionen der
`setInterval`-Schleifen: **ein echter Fund**, und er ist die Ursachenkette zum
Befund oben.

```ts
if (!session) {
  await autoReconnectCapital().catch(() => {});   // Ergebnis WEGGEWORFEN
  return;                                          // keine Meldung
}
```

`autoReconnectCapital()` gibt `{ ok, error }` zurück. Ein Reconnect, der alle
zwei Minuten scheitert, war von einem erfolgreichen **nicht zu unterscheiden**.
Und das erklärt die stille Kette: ohne Sitzung steigt der Journal-Sync aus, der
Orchestrator handelt nicht, die Anzeige meldet „keine Sitzung" — **alle drei
Folgen sichtbar, nur die Ursache stumm.**

Es ist **wörtlich** derselbe Fehler, der bei IC Markets am 08.09. behoben wurde;
der Kommentar steht dort bis heute: *„Ein Wiederholungsversuch, dessen Ausgang
niemand sieht, ist von einem Fehlschlag nicht zu unterscheiden."* Bei
Capital.com war er schlimmer — dort wurde nicht einmal der Versuch gemeldet.

**Und es waren zwei Stellen.** Beim Anbau der ersten habe ich die zweite
übersehen — die, bei der `"reconnecting…"` im Log steht und seit jeher **nie**,
ob es geklappt hat. **Der Prüfer hat sie gefangen**, weil er das *Muster* sucht
und nicht eine einzelne Zeile. Genau dafür ist er da.

`reconnectMelden()` drosselt wie der Journal-Sync, aber mit **eigenem** Zustand
(`global.__capital_reconnect_lage__`): teilten sich beide einen, verdeckte die
eine Lage die andere — wieder ein stummer Ausfall.

**Drei eigene Messfehler, alle benannt:**
- Das Suchwerkzeug meldete **5** Verdachtsfälle, **4 davon falsch**: ein
  4-Zeilen-Fenster übersah Meldeblöcke, die 5 Zeilen davor standen, und zählte
  einen `.filter()`-Callback sowie die Ergebnis-Rückgabe am Ende als frühen
  Rücksprung. Jeder einzeln von Hand geprüft, bevor einer „Befund" hiess.
- Die Prüfung „beide Drosseln getrennt" war **zu schwach**: sie verlangte nur,
  dass beide beim ersten Aufruf melden — das tun sie auch bei geteiltem
  Zustand. Jetzt wird geprüft, dass nach dem Fremdaufruf die **eigene Drossel
  noch greift**.
- Im Sabotage-Lauf entwischte der catch-Rückfall `({ ok: true })`: die
  Verdrahtung blieb unverändert, nur hätte ein geworfener Netzfehler ab da als
  **gelungener** Reconnect gegolten. „Ein Ausfall darf sich nicht als Ergebnis
  ausgeben", eine Ebene tiefer. Jetzt müssen **beide** catch-Rückfälle
  `ok: false` **und** einen Grund liefern.

**10 von 10 Sabotagen**, 258 → **273 Prüfungen**.

### Ein Alarmsystem, dessen Ausfall selbst nicht alarmiert (25.10.)

Dieselbe Frage eine Ebene höher: wenn ein weggeworfener Rückgabewert einen
Dauerausfall versteckt — **wo noch?** Gemessen: 51 Stellen mit
`.catch(() => {})`. Die meisten sind absichtlich (Aufräumen beim Abmelden). Eine
nicht.

`sendTelegram` gibt `Promise<boolean>` zurück — und dieser Wert wurde an
**keiner einzigen** der elf Aufrufstellen ausgewertet (nachgezählt). Dazu hatte
die Funktion **drei stille Ausgänge**:

```ts
if (!isTelegramConfigured()) return false;   // Token/Chat-ID fehlt
return data.ok;                              // Telegram sagt nein
} catch { return false; }                    // Netzfehler
```

Keiner davon schrieb eine Zeile. Daran hängen **zehn Module**: der
Sicherheits-Watchdog, das KI-Tor-Alarmsystem, der Diagnose-Agent, Risiko- und
Orchestrator-Agent, die Tagesbilanz.

**Das ganze Alarmsystem konnte lautlos tot sein.** Fehlt `TELEGRAM_BOT_TOKEN`
in Railway, kehrt jeder Alarm sofort und wortlos zurück — und man erfährt vom
Problem erst, wenn man es ohnehin schon sieht. Genau der Zustand, der seit dem
27.09. als offener Punkt notiert war („TELEGRAM_CHAT_ID im Ruhezustand
prüfen") — nur dass er sich **nie von selbst** gemeldet hätte.

Und der Grund wurde weggeworfen: Telegram antwortet mit
`{ ok: false, error_code: 400, description: "chat not found" }` — die
`description` sagt genau, was los ist. Dieselbe Fehlerklasse wie der
verschluckte 502-Antwortkörper vom 22.09.

Jetzt meldet jeder der drei Ausgänge **ins Konsolen-Log** — nicht nach
Telegram, der Kanal ist ja der defekte. Gedrosselt wie die beiden Schwestern,
mit **eigenem** Zustand (`global.__telegram_lage__`), damit sich die drei Lagen
nicht gegenseitig verdecken. Die Meldung nennt die Folge: *„Solange das so ist,
kommt KEIN Alarm an: weder Killswitch noch Zyklus-Absturz, KI-Tor-Ausfall oder
Tagesbilanz."*

**11 von 11 Sabotagen**, 441 → **458 Prüfungen**. Die eine, die zuerst
entwischte, war wieder ein **Prüfer-Mangel**: er suchte, ob `console.error(m)`
*irgendwo* steht — die Sabotage machte nur **einen** der drei Ausgänge stumm,
die anderen zwei liessen den Ausdruck weiter zutreffen. Jetzt wird **gezählt**
(genau drei), nicht gefunden. Dasselbe Muster wie „ein Wort im Kommentar ist
keine Verwendung": ein Treffer beweist nichts über die anderen Stellen.

#### Und wo noch? Vollständig gemessen (25.10.)

`sendTelegram` habe ich gefunden, weil ich **gezielt** danach gesucht habe. Die
systematische Frage lautet: welche Funktion gibt sonst noch ein Ergebnis
zurück, das **nirgends** gelesen wird?

**Ergebnis: von 25 Funktionen mit aussagekräftigem Rückgabetyp** (`boolean`
oder ein Objekt mit `ok`) **wird jede einzelne ausgewertet.** `sendTelegram`
war der einzige Fall — und er ist behoben.

**Drei eigene Messfehler, bis das Ergebnis etwas wert war:**

| Messfehler | Folge |
|---|---|
| der Typ-Regex schloss `{` aus | übersah **jede** `Promise<{ok: …}>`-Funktion — die halbe Frage |
| nur `frontend/lib` gescannt | `instrumentation.ts` und `app/` fehlten → **2 Falschmeldungen** |
| nur der `?`-Zweig eines Ternärs | **1 Falschmeldung** (`capitalGetAvailableMarkets`) |

Der erste fiel sofort auf, weil die **Selbstprüfung** die Referenzfunktion gar
nicht fand. Die anderen zwei bei der Handprüfung jedes einzelnen Verdachts.

**Und die Selbstprüfung musste selbst umgebaut werden:** sie sabotierte zuerst
eine echte Funktion in *einer* Datei — `autoReconnectCapital` wird aber an
**vier** Stellen ausgewertet, zwei davon in `app/api`. Die Sabotage traf zwei,
der Rest hielt die Erkennung zurecht grün, und die Prüfung schlug fälschlich
an. Ein Werkzeug prüft man an Fällen, die man **vollständig kontrolliert** —
jetzt an zehn synthetischen Quelltexten (`const x = await f()`, `if (await
f())`, `return await f()`, Destructuring, `.then((r) => …)`, beide
Ternär-Zweige, und die Gegenprobe, dass ein ignorierter Aufruf **nicht** als
gelesen gilt).

Ehrlich benannte Grenze: `.then(() => …)` **ohne** Parameter gilt als
„ignoriert" — das ist gewollt, denn dort wird der Wert ja wirklich nicht
gelesen.

### Der Build hängt an Google Fonts

Beim Kontrolllauf schlug `npm run build` einmal fehl: *„Error while requesting
resource", 2 Warnungen, Build error occurred.* Zwei Wiederholungen liefen
sauber durch (Exit 0, null Warnungen) — **transient, kein Codefehler**.

Die Ursache ist trotzdem benannt: `app/layout.tsx:2` lädt `Geist` und
`Geist_Mono` über `next/font/google`. **Der Build holt sie zur Bauzeit von
Google.** Ist der Dienst nicht erreichbar, schlägt der Build fehl — auf Railway
genauso. Nicht geändert (selbst gehostete Fonts wären eine eigene
Entscheidung), aber wer einen Deploy ohne erkennbaren Grund scheitern sieht,
sucht sonst an der falschen Stelle.

## Die Zahl, die sagt, ob es einen Edge gibt — `/edge` (26.10.)

„Viele grüne Trades, und das Konto sinkt trotzdem." Das ist kein Rätsel,
sondern eine Rechnung — und zwar die denkbar einfachste:

```
EW = Summe aller P&L ÷ Anzahl der Trades
```

**Diese Zahl wurde im ganzen Programm nirgends gerechnet** (gesucht in
`frontend/lib`, kein Treffer). Jetzt gibt es sie als Telegram-Befehl —
**reine Lesung**, keine Order, kein Stop, keine Einstellung.

### Der erste Live-Lauf hat die eigene Formel widerlegt

Hier stand bis zum selben Abend die Zerlegung
`Trefferquote × ØGewinn − (1 − Trefferquote) × ØVerlust`. Sie stimmt **nur,
wenn es keine Breakeven-Trades gibt**. `1 − Trefferquote` sind sonst
*Verlierer **und** Breakeven zusammen* — und damit bekommt jeder Breakeven
einen vollen Ø Verlust aufgebürdet, obwohl er nichts verloren hat.

Der erste echte Lauf zeigte es sofort. In **einer** Antwort standen:

```
Summe P&L: −1822.39   ·   Erwartungswert: −11.9   ·   gewertet: 814
```

**−11.9 × 814 = −9686.60.** Die Antwort widersprach sich selbst um den
**Faktor 5.32**, weil 517 der 814 Zeilen Breakeven waren.

**Warum kein Prüfer das sah:** von den fünf gerechneten Testfällen hatte
**keiner** einen Breakeven (21W/9L, 12W/18L, 20W/10L). Genau dann ist
`1 − Trefferquote` zufällig gleich der echten Verlustquote, und die falsche
Formel liefert das richtige Ergebnis. **Ein Prüfer, der den Fehler nicht
kennt, beweist nichts über ihn** — dieselbe Lehre wie am 30.09. bei
`lifecycle-rueckkehr`, diesmal am eigenen Neubau, einen Tag alt.

Deshalb ist der EW jetzt **Summe ÷ Anzahl**. In dieser Form **kann** er der
ausgewiesenen Summe nicht mehr widersprechen — und die Antwort führt die
**Summenprobe selbst mit**, denn genau sie hätte den Widerspruch sofort
gezeigt.

Zwei weitere Fehler derselben Fassung: die nötige Trefferquote (57 %) gilt für
die **entschiedenen** Trades, wurde aber gegen die Quote über **alle**
verglichen („44.6 Punkte" statt echter 23.0) — zwei Nenner in einer Zeile. Und
„davon rekonstruiert: 33" stand unter „ohne Ergebnis: 31" und las sich als
Teilmenge; gezählt werden aber die Zeilen, die den Ausschluss **passiert**
haben. Beides sind Zahlen, die nebeneinander nicht zusammenpassen können.

### Eine 0 kann „Breakeven" heissen oder „nie geschrieben"

`profitLoss` ist im Schema `Float @default(0)`. Eine Zeile, deren P&L **nie
geschrieben wurde**, steht auf exakt 0 und ist von einem echten Breakeven **an
der Zahl allein nicht zu unterscheiden**.

Deshalb weist `/edge` die Breakeven **nach `result`/`exitReason`
aufgeschlüsselt** aus und nennt den Erwartungswert zusätzlich **ohne** sie. Wer
beide Zahlen sieht, weiss, wie viel an der Frage hängt; wer nur eine sieht, rät.

Statisch gemessen: von **sechs** Stellen, die einen Trade auf `CLOSED` setzen,
setzt **genau eine** kein `profitLoss` — `icmarkets-trade-manager.ts:197`
(`result='CLOSED_TIME'`). Heute ohne Handelsfolge, weil
`icMarketsExecutionEnabled` auf `false` steht. Die beiden `BREAKEVEN`-Stellen
in `capital-trade-tracker.ts` (718, 1215) schreiben **immer**
`NIE_BESTAETIGT`/`KEIN_PNL` und fallen schon raus.

**Die Datenqualität steht MIT im Ergebnis.** Seit dem 30.09. ist belegt, dass
ein Trade **zwei** Journal-Zeilen erzeugen konnte; `echteGeschlosseneTrades()`
liest die Notizen **nicht**, beide Zeilen gehen bis heute in jede Statistik.
`ETIKETTEN_OHNE_ERGEBNIS` bekommt hier seinen ersten Leser ausserhalb der
eigenen Datei.

**Und ein Ausfall gibt sich nicht als Ergebnis aus:** unter `MIN_TRADES = 30`
wird **kein** Erwartungswert ausgegeben, sondern der Grund. Zehn Trades, wie
anderswo üblich, sind zu wenig — dort verschiebt ein einziger Ausreisser die
Trefferquote um zehn Punkte.

### Die Anzahl allein sagt nicht, ob der Fehler noch lebt

Der erste aufgeschlüsselte Lauf ergab: **510 der 517 Breakeven (98.6 %) haben
gar keinen `exitReason`** — `BREAKEVEN/—` (441) und `CLOSED/—` (69). Nur 7
tragen einen echten Grund.

Im Code steht, woher das kommt (`capital-trade-tracker.ts:292–302`):
`sync-journal` schrieb *„status CLOSED und result 'CLOSED' ohne P&L und ohne
Grund"* — **bis zum 17.08.**, nachgewiesen am Wochen-Report vom 16.08.

**Ein Kommentar ist aber kein Beleg dafür, wann diese Zeilen entstanden
sind.** Deshalb trägt jede Herkunftszeile jetzt ihre **Zeitspanne**, und
daneben steht der Massstab: das Datum des **letzten Trades mit Ergebnis**.
Endet ein Etikett lange davor, ist es Altbestand; reicht es bis dorthin, wird
es heute noch erzeugt. Ohne diesen Vergleich ist beides nicht zu
unterscheiden.

**Ein fehlendes Datum wird dabei NICHT zu „heute"** (`tag()` gibt `null`).
Dieselbe Regel wie beim Kurs-Alter am 22.09.: eine stille Ersatzzahl macht aus
„unbekannt" eine Messung — und hier hinge daran die Frage, ob ein Fehler noch
aktiv ist.

### Woran die Gewinner enden — die Frage vor jeder Schwellen-Änderung

Der Einstieg verlangt **R/R ≥ 1.5** (`ai-analysis-engine.ts:911`). Gemessen
wurde am 26.10. ein **realisiertes R/R von 0.75** — Ø Gewinn 11.47 gegen Ø
Verlust 15.21. Faktor 2.

Die Kette dazu steht vollständig im Code, jeder Schritt belegt:

| | Beleg |
|---|---|
| Stop ist 1.5 × ATR, schwankt um **Faktor 17.6** je Markt | `risk-agent.ts:297–305` |
| Teilgewinn feuert bei **festem Kursprozent** (DAYTRADING 1.0 %) | `risk-agent.ts:98`, `:626` |
| „In **29 von 30** Märkten greift die Absicherung, bevor der Trade seinen eigenen Einsatz verdient hat — auf UKOIL bei **0,12 R**" | gemessen 10.08., `risk-agent.ts:307` |
| Der Gegenschalter `exitThresholdsRelativeToStop` ist **AUS** | `settings-store.ts:51` **und** im Snapshot |

Die R-Werte (`partialAtR: 1.5`) sind konfiguriert und werden **nicht benutzt**.

**Das ist eine Erklärung, keine Messung.** Deshalb schlüsselt `/edge` jetzt
auch die **Gewinner und Verlierer** nach `result/exitReason` auf — **mit Ø
P&L je Etikett**. Die Anzahl allein sagt nicht, wie viel ein Ausstieg kostet.
Erst wenn dort steht, dass der Grossteil der Gewinner an einem Teilgewinn
statt am Ziel endet und dabei einen Bruchteil bringt, ist die Kette
geschlossen — vorher wird an den Schwellen nichts geändert.

Breakeven, Gewinner und Verlierer gehen durch **dieselbe** Funktion
(`herkunftListe()`). Drei Kopien wären drei Stellen, an denen sie
auseinanderlaufen.

### GEMESSEN: kein einziger Trade erreicht sein Ziel (26.10.)

`ausstiegsgrund()` vergibt `ZIEL`, wenn der Schlusskurs **≥ 95 %** des Weges
vom Stop zum Ziel geschafft hat (`capital-trade-tracker.ts:323`). Das Etikett
existiert also — und kommt in **129 Trades mit echtem Ausstiegsgrund kein
einziges Mal** vor.

| wie Gewinner enden | Anzahl | Ø P&L |
|---|---|---|
| `WIN/DAZWISCHEN` — Zwischenausstieg | 40 (73 %) | **3.31** |
| `WIN/STOP` — nachgezogener Stop im Plus | 15 (27 %) | **2.66** |
| `WIN/ZIEL` | **0** | — |

Der Einstieg verlangt R/R ≥ 1.5. **Kein Trade kommt dort je an.** Damit ist
die Kette oben nicht mehr erklärt, sondern **gemessen**.

**Ehrlich eingeordnet:** für die Zeit *vor* dem 17.08. beweist das nichts —
dort wurde gar kein Ausstiegsgrund geschrieben. Die Aussage gilt für die 129
etikettierten Trades.

**Und der Altbestand-Fehler ist tot, mit Daten belegt:** alle vier „ohne
Grund"-Etiketten enden im August (`WIN/—` 13.08., `BREAKEVEN/—` 14.08.,
`LOSS/—` 17.08., `CLOSED/—` nur am 17.06.), während der letzte Trade mit
Ergebnis der **22.10.** ist. Der Code-Kommentar sagte „bis 17.08." — jetzt
sagen es die Daten. Genau dafür wurde die Zeitspanne gebaut.

### Zwei Regime in einer Zahl — deshalb `/edge 60` (27.10.)

Die Historie zerfällt sichtbar in zwei Systeme:

| | ALT (bis 17.08.) | **NEU (ab 17.08.)** |
|---|---|---|
| W / L / BE | 46 / 129 / 510 | **55 / 67 / 7** |
| Trefferquote (entschieden) | 26.3 % | **45.1 %** |
| Ø Gewinn | 21.43 | **3.13** |
| Ø Verlust | 19.36 | **7.21** |
| R/R | 1.107 | **0.434** |
| nötiges R/R | 2.80 | **1.22** |

Die Trefferquote hat sich fast **verdoppelt**, der Ø Gewinn ist auf ein
**Siebtel** gefallen. Das Geld geht nicht an schlechten Einstiegen verloren,
sondern an den Ausstiegen.

Zusammengerechnet ergibt das ein R/R von **0.75** — ein Wert, der **keines der
beiden Systeme beschreibt**. Und die daraus abgeleiteten Hebel zeigen falsch:
über alles gerechnet „fehlen 23 Punkte Trefferquote", im laufenden Regime
liegt sie längst bei 47 % und es fehlt ausschliesslich am R/R (0.42 statt
nötiger 1.13).

Das ist die Fehlerklasse „eine Stufe ohne eigene Zahl verschwindet aus der
Bilanz", eine Ebene höher: **zwei Regime in einer Zahl.**

`/edge 60` rechnet deshalb nur die letzten 60 Tage. Zeilen davor werden
**gezählt und ausgewiesen**, nicht still verworfen; Zeilen **ohne Datum** sind
nicht einordenbar und werden separat genannt statt heimlich mitgerechnet. Ein
unbrauchbares Argument fällt ehrlich auf „alles" zurück — und `fensterTage:
null` **sagt das auch**, statt ein Fenster vorzutäuschen.

#### `parseInt` liest, was es kriegen kann

Der End-to-End-Prüfstand fand beim ersten Lauf einen echten Fehler in genau
dieser Eingabe: `Number.parseInt("1e", 10)` ergibt **1**. `/edge 1e` wurde
damit still zu einem Ein-Tage-Fenster, `/edge 60xyz` zu 60 — eine Eingabe
**geraten**, die so nie gemeint war. Jetzt gilt `/^\d+$/`: nur Ziffern, sonst
eine Meldung.

**Und der erste Fix war noch nicht streng genug.** Die Sabotage „`/^\d+$/` auf
`/^\d/` verkürzen" blieb grün — weil `Number()` ohnehin streng ist und meine
Testfälle (`abc`, `0`, `-5`, `1e`) den Unterschied gar nicht ausdrücken
konnten. Ausgeführt gemessen, wo er liegt:

| Eingabe | streng `/^\d+$/` | lasch `/^\d/` |
|---|---|---|
| `1e5` | abgelehnt | **100000 Tage** |
| `0x10` | abgelehnt | **16 Tage** |
| `6e2` | abgelehnt | **600 Tage** |

Genau diese drei fehlten im Prüfstand und stehen jetzt drin. Zum dritten Mal
an einem Tag dieselbe Lehre: **ein Testfall, der den Fehler nicht ausdrücken
kann, beweist nichts** — `[RSI 82]`, die gleichen Datumswerte, und nun das.

Dazu ein eigener Fehler beim Beheben: ohne Argument war `tage` danach `NaN`
statt `null` und wurde erst von der Rechnung aufgefangen. Das Ergebnis stimmte
— aus Zufall. **Ein Ergebnis, das nur stimmt, weil es jemand weiter innen
repariert, ist keins.** Jetzt ausdrücklich `null`.

#### Und die Ablehnung echote die Eingabe

Beim Gegenlesen des eigenen Codes aufgefallen. Die Meldung lautete:

```ts
`⚠️ <b>/edge ${arg.slice(0, 20)}</b> — das ist keine Anzahl Tage.`
```

Das ist die Regel vom **29.09.** („ein Admin-Passwort gehört nirgends echot"),
nur an einer anderen Stelle: ein Telegram-Verlauf liegt auf jedem angemeldeten
Gerät und auf Telegrams Servern und **lässt sich nicht zurückholen**. Wer sich
vertippt und `/edge <etwas Vertrauliches>` schickt, hat es dort dauerhaft
stehen.

Und die Meldung **braucht das Argument gar nicht**: Länge plus die richtige
Form erklären alles, was zu erklären ist. Ein Echo, das nichts erklärt, aber
etwas preisgeben kann, ist reiner Verlust. Jetzt steht dort nur noch
`(12 Zeichen)`.

Der Prüfstand schickt dafür `/edge geheim123xyz` durch die echte `POST`-Funktion
und verlangt, dass die Antwort **weder die Eingabe noch ein Stück davon**
enthält — die Gegenprobe mit einer 26 Zeichen langen Eingabe fängt auch ein
gekürztes Echo.

### Wie WEIT kam der Trade? (27.10.)

Der erste `/edge 60` über das laufende System ergab:

| | |
|---|---|
| gewertet | 128 (55 W / 66 L / 7 BE) |
| Trefferquote (entschieden) | **45.5 %** |
| Ø Gewinn / Ø Verlust | 3.13 / 7.24 |
| R/R | **0.43** · nötig wären **1.20** |
| `WIN/ZIEL` | **0 von 121** |
| weder Stop noch Ziel | **69 von 121 = 57 %** |

Ein voller Stop kostet **8.92**, ein Gewinner bringt **3.13** — **35 %** davon.
Ein Ziel bei geplantem R/R 1.5 brächte 13.38; erreicht werden **23 %**.

**Die Trefferquote ist nicht das Problem.** 45.5 % sind brauchbar; die
Rechnung „24.3 Punkte heben" ist formal richtig und praktisch sinnlos, weil
69.8 % niemand erreicht. Der Hebel ist das R/R, und zwar allein.

**Was das Etikett nicht hergibt:** `DAZWISCHEN` sagt nur „weder Stop noch
Ziel" — ob bei 10 % oder bei 90 %, steht nicht drin. Genau daran hängt aber
die Entscheidung über `exitThresholdsRelativeToStop`.

Die Zahl dafür lag längst in den Daten: `ausstiegsgrund()` liefert
**`exitPosition`** (0 = am Stop, 1 = am Ziel), und sie wird gespeichert
(`capital-trade-tracker.ts:1251`). `/edge` weist sie jetzt je Etikett aus:

```
WIN/DAZWISCHEN: 40 · Ø 3.31 · Weg 34 % (40/40)  (2026-09-09 … 2026-10-22)
```

**Drei Regeln dabei**, alle aus früheren Funden:

- **Fehlt die Angabe, wird sie nicht 0.** Eine 0 hiesse „am Stop
  ausgestiegen" — eine Behauptung statt einer Messung. Dann steht dort
  „Weg unbekannt", und bei Teilabdeckung die Zahl der Zeilen mit Angabe
  (`20/30`).
- **Nicht geklemmt.** Ein Weg über 100 % oder unter 0 % ist echter Schlupf
  beim Schliessen und gehört sichtbar. Eine Klemme würde ihn verstecken.
- **Nur endliche Zahlen zählen.** Ein `"halb"` in den Notizen verfälscht den
  Schnitt nicht, sondern fehlt in `wegBekannt`.

safety-nets 597 → **606**, **12 von 12 Sabotagen**.

**Zwei fielen zuerst durch — wieder die Testdaten, nicht der Prüfer:** alle
`exitPosition`-Werte lagen zwischen 0 und 1, also änderte eine Klemme auf
0..100 % nichts; und der Bündel-Testfall trug gar keinen Weg, also fiel nicht
auf, dass die Bündelung ihn verlor. Behoben mit einem Schlupf-Fall (1.08 und
−0.04) und einem Bündel mit Weg. **Vierte Wiederholung derselben Lehre an
zwei Tagen.**

### Und der Prüfer sah den Typfehler nicht — `tsc` schon

Beim Anbau blieb die Deklaration des Arrays auf einem **Inline-Typ** ohne das
neue Feld stehen. `safety-nets` war **grün**: `ladeTsModul` transpiliert, ohne
zu typprüfen. `npx tsc --noEmit` meldete zwei Fehler (TS2345), `npm run build`
ebenfalls.

Das ist kein Loch, sondern die Arbeitsteilung, wie sie gedacht ist — aber es
ist der Grund, warum **beide** laufen müssen. Jetzt steht dort `GewerteteZeile[]`
statt einer zweiten Beschreibung desselben Typs; damit kann es nicht mehr
auseinanderlaufen.

### Absicherung

`safety-nets` **rechnet** das (477 → **650** Prüfungen), unter anderem mit der
**echten Live-Lage** vom 26.10. als Testfall: 845 Zeilen, 814 gewertet,
101W/196L/**517BE**, Ergebnis −2.24. Dazu die **Verdrahtung**: die Route muss
`result` **und** `updatedAt` mitschicken, sonst wäre die Herkunft dauerhaft
`—/—` bzw. „ohne Datum" und sähe dabei wie ein ehrliches Ergebnis aus —
Fehlerklasse 30.09., eine geprüfte Funktion, die nie echte Werte bekommt. Der
`/edge`-Block wird per Klammerzählung ausgeschnitten; ein `result: true`
irgendwo sonst in der Datei beweist nichts.

**76 von 76 Sabotagen.** Die erste stellt die alte Formel wieder her und wird
rot — das ist der eigentliche Nachweis, denn genau diese Fassung war einen Tag
lang grün.

#### Drei Sabotagen entwischten zuerst — an zu braven Testdaten

Nicht der Prüfer war zu schwach, sondern **seine Daten konnten den Fehler gar
nicht ausdrücken** — dieselbe Falle wie `[RSI 82]` am 30.09.:

- alle Gewinner hatten **dasselbe** Datum → „älteste statt neueste" fiel nicht auf;
- keine Breakeven-Zeile war **neuer** als der neueste Gewinner → „Massstab
  nimmt Breakeven mit" fiel nicht auf;
- kein Etikett hatte **unsortierte** Daten mit einer **Lücke mittendrin** →
  „der letzte gewinnt" traf zufällig das Richtige, und ein `null` löschte die
  Spanne unbemerkt.

Nach der Nachbesserung: alle drei rot. Die Testdaten sind seitdem **absichtlich
unbequem**, und der Grund steht im Prüfer.

**Die vierte war kein Prüferloch, sondern eine wirkungslose Sabotage.** Die
`v instanceof Date`-Abzweigung lässt sich nicht sabotieren: ausgeführt und
belegt, `new Date(v)`, `new Date(Number(v))`, `new Date(String(v))` und
`new Date(v.getTime())` liefern **alle vier** dasselbe Ergebnis — JS nimmt ein
`Date` in jeder Form an. Sie als „entwischt" zu zählen wäre ein Messfehler
gewesen, kein Befund. Ersetzt durch eine wirksame: `String(v).slice(0,10)`
ergibt `"Wed Sep 16"`.

### Und die Länge wurde gemessen, nicht geschätzt

Mit drei Aufschlüsselungen stellte sich die Frage, ob die Antwort Telegrams
Grenze von **4096 Zeichen** reisst. Gemessen: die echte Lage ergibt **1664**
Zeichen, ein bewusst konstruierter Härtefall mit überlangen Etiketten **2900**.

**Also wurde kein Stückeln gebaut.** Meine eigene Erwartung („der Härtefall
passt nicht mehr") wurde von der Messung widerlegt, und eine Mechanik zu
bauen, die nachweislich nie greift, wäre Arbeit auf Verdacht.

### `reply()` im Webhook war stumm — jeder Befehl, nicht nur /edge

Dabei fiel der eigentliche Fund auf. In `webhook/route.ts` stand:

```ts
await fetch(…).catch(() => {});   // kein Status, kein Antwortkoerper
```

Telegram lehnt einen Versand mit **HTTP 200** und `{ok:false, description}`
ab — zu lange Nachricht, kaputtes HTML, Drosselung. Der Befehl verpuffte dann
**spurlos**, und im Log stand nichts. Betroffen ist **jede** Antwort des Bots:
`/status`, `/killswitch`, `/reset`, `/peakreset`, `/edge`.

Das ist exakt die Fehlerklasse, die am 25.10. für `sendTelegram` behoben wurde
(`d47b772`) — **aber `reply` ist die eigene Funktion des Webhooks und war nie
erfasst.** Ein Fix an einer Stelle beantwortet nicht, wo die Klasse sonst noch
steckt.

Jetzt wird Status **und** Körper ausgewertet, der Grund steht in der Meldung,
und sie geht ins **Konsolen-Log** — nicht nach Telegram, der Kanal ist ja der
defekte. **Die Rückgabe bleibt `void`**, mit Absicht: ein `boolean`, den keiner
der Aufrufer liest, wäre genau der Fehler vom 25.10. in neuer Verpackung.

Geprüft wird **ausgeführt**: die echte `POST`-Funktion gegen einen `fetch`, der
Ablehnung, unlesbare Antwort, leere Antwort und Netzfehler spielt, mit
gezählten Konsolenausgaben — dazu die **Gegenprobe**, dass ein *gelungener*
Versand **nicht** meldet. Ohne sie wäre eine Prüfung grün, die bei jeder
Antwort Alarm schlägt.

**Noch offen:** `sendTelegram` wertet die Antwort seit dem 25.10. aus, **kennt
aber keine Längengrenze**. Eine Tagesbilanz über 4096 Zeichen käme nicht an —
immerhin mit Logzeile. Nicht geändert, weil nicht gemessen.

### Nebenbei belegt: der Prisma-Client ist programmweit `any`

`app/lib/prisma.ts` holt den Client per `require("@prisma/client")`. Ein
`require` in TypeScript ergibt `any`, `InstanceType<typeof any>` ist `any` —
**jede** Datenbankabfrage im Programm ist untypisiert.

Ausgeführt belegt, zwei Stufen: `select: { resultXX: true }` ergibt
`npx tsc --noEmit` **exit 0**, und sogar
`getPrisma().gibtEsNichtModell.findMany(…)` ergibt **exit 0**. Nicht einmal
ein nicht existierendes **Modell** fällt auf. Die generierten Typen sind in
Ordnung (`TradeSelect` kennt `result?: boolean`) — sie werden nur nirgends
angewendet.

**Folge:** ein Tippfehler in einem `where`, `select` oder `data` ist still.
Auf `/edge` ist die `safety-nets`-Verdrahtungsprüfung deshalb der **einzige**
Schutz, nicht `tsc`.

**Nicht geändert:** `require` → `import` würde auf einen Schlag jede
Prisma-Abfrage typisieren und möglicherweise viele bestehende Fehler sichtbar
machen. Das ist eine eigene, bewusste Entscheidung.

## Welcher Stand läuft gerade? `/status` sagt es (27.10.)

`/edge 60` wurde um **22:59:36** gepusht und um **23:01** ausprobiert.
Railway war noch am Bauen, der Bot antwortete „Unbekannter Befehl" — und es
gab **keine Möglichkeit, das festzustellen ausser Raten**.

Dass es der alte Stand war, liess sich hinterher **beweisen**: die
Fehlermeldung zeigt den Text `"/edge 60"`, und auf dem neuen Stand ist
`"/edge 60".startsWith("/edge ")` wahr — der Zweig greift, der Auffangzweig ist
gar nicht erreichbar. Im Commit davor kommt `startsWith("/edge ")` **null mal**
vor. Nur: diesen Beweis kann man nicht führen, während man im Chat steht.

`CLAUDE.md` benennt die Lücke seit dem 27.09.: *„Vorher prüfen, dass der neue
Deploy wirklich läuft — eine Deploy-Kennung ist **kein** Commit-Hash."* Im
Ernstfall ist das die Frage **vor** dem `/reset`.

`/status` nennt jetzt den laufenden Commit, den Branch und die Laufzeit:

```
🧩 Laufender Stand
Commit: a02fc4a (main)
Läuft seit: 7 min (Start 27.10.2026, 23:05:12 MEZ)
```

**Nur eine Variable, die auch einen Commit enthält.** `RAILWAY_DEPLOYMENT_ID`
steht bewusst **nicht** in `COMMIT_QUELLEN` — sie als Commit auszugeben wäre
genau die Lüge aus der Regel oben, nur bequemer. Und was nicht wie ein
Commit-Hash aussieht (`/^[0-9a-f]{7,40}$/`), wird **nicht** als einer
ausgegeben: dann heisst es „unbekannt" **mit Grund**.

**Der unbrauchbare Wert selbst geht nicht in den Chat** — nur seine Länge.
Dieselbe Regel wie bei der `/edge`-Ablehnung: was in den Chat geht, kommt
nicht zurück.

**Die erste gesetzte Variable entscheidet**, auch wenn ihr Wert unbrauchbar
ist. Sonst verdeckte eine zweite stillschweigend einen Tippfehler in der
ersten, und man suchte an der falschen Stelle.

**Statischer Import, kein `await import()`.** Das Modul ist winzig, rein und
ohne Nebenwirkungen; ein dynamischer Import hätte nur eine **Laufzeit**-Fehler\-
quelle geschaffen — ausgerechnet in `/status`, dem Befehl, den man benutzt,
wenn ohnehin etwas kaputt ist. Statisch schlägt ein Problem beim **Bauen** auf.

Die Zeit formatiert der Aufrufer mit `telegramZeit()`, nicht das Modul — ein
nacktes `toLocaleString` im Telegram-Weg war der Fehler vom 27.09.

**14 von 14 Sabotagen**, und fünf davon fielen zuerst durch — **vier wegen zu
schwacher Prüfungen von mir**, eine wegen eines CRLF-Ankers:

| entwischt | warum |
|---|---|
| Deployment-ID als Commit | mein Testwert `abc-123-def` ist **nicht hex** und wurde schon von der Hash-Prüfung abgewiesen — der Fall konnte den Fehler gar nicht ausdrücken |
| Grund fehlt in der Anzeige | ich prüfte nur auf das Wort „unbekannt", das auch ohne Grund dasteht |
| Startzeit ohne Zeitzone | nichts prüfte, **dass** sie durch `telegramZeit()` geht; `toISOString()` ist kein `.toLocale…` und entging dem bestehenden Riegel |
| `process.uptime()` → feste 0 | nichts prüfte den Wert |

Behoben, indem der Prüfstand den **Formatierer** durch einen Stellvertreter
ersetzt, der sein Argument zurückgibt (`ZEIT:<ms>`), und die **Uptime selbst
setzt** (3600 s ⇒ „1 h"). Die echte Uptime taugte als Massstab nicht: gemessen
läuft der Prüfer-Prozess an dieser Stelle erst **0.04 s** — eine Prüfung „mehr
als eine halbe Sekunde" hinge an der Wanduhr statt am Verhalten.

## Warum kein Trade? `/status` sagt es jetzt auch (29.10.)

Vom **23. bis 29.10. wurde keine einzige Position eröffnet.** `/edge 60`
bestätigt es unabhängig: der letzte Trade mit Ergebnis ist der **22.10.**

`/status` antwortete in diesen sieben Tagen durchgehend `System: ONLINE 🟢`
— und diese Zeile misst **ausschliesslich** `ks.systemLocked`, also den
Killswitch. Über Broker-Sitzung, Modus, offene Positionen, Tageslimit,
Drawdown-Sperre oder den Scan sagt sie **nichts**. Fehlerklasse „eine
Diagnose darf im interessanten Fall nicht schweigen" — angewandt auf genau
die Frage, die man im Ernstfall **vor** dem `/reset` stellt.

**Zwei Tore sind ausgeschlossen, nicht vermutet:**

- der Killswitch — `Armed ✅` ist der Zweig `ks.triggered === false`
  (`webhook/route.ts:538`);
- die Handelszeit — `isWithinTradingSession()` **ausgeführt**, an allen
  Werktagen vom 21. bis 29.10. offen.

### Drei Ausgänge, die stumm sind

Der Zyklus endet an diesen drei Stellen mit **einer Logzeile** und **ohne**
Telegram-Meldung (`orchestrator-agent.ts`):

```ts
if (!isCapitalConnected())                 return "Capital nicht verbunden";  // :737
if (settings.botSettings.mode !== "AUTO")  return "Modus nicht AUTO";         // :743
if (openCount >= maxConcurrent)            return "Max. Positionen erreicht"; // :811
```

Sieben Tage Schweigen sehen bei allen dreien **identisch** aus — und
identisch zu „die KI wollte nicht". Besonders der zweite verdient
Aufmerksamkeit: `DEFAULT_SETTINGS` steht auf `mode: "MANUAL"`
(`settings-store.ts:6`). Ein Ausfall des Datenbank-Lesepfads genügt also —
niemand muss etwas umgestellt haben.

### Die Lage wird GERECHNET, nicht formuliert

`handelsLage()` (`lib/handels-lage/`) ist eine **reine** Funktion ohne
Importe: Broker, Modus, Positionen gegen Limit, Tageslimit,
Gesamt-Drawdown, Handelszeit, Zyklen heute und die **Ausgänge nach
Häufigkeit**. Eine Ternär-Kette im Antworttext wäre strukturell prüfbar,
aber nicht rechnerisch — genau daran scheiterte die Broker-Lage einen Tag
vorher.

**Dreiwertig, ohne Ausnahme.** Jede Eingabe darf `null` sein und heisst
dann **unbekannt** — nie „in Ordnung" und nie „blockiert". Hier wäre die
stille Null besonders teuer: die Antwort wird gelesen, **weil** etwas
kaputt ist, fehlende Werte sind also der Normalfall. Ein Höchststand von 0
ergibt deshalb keine Division, sondern „nicht berechenbar".

**Die Zahl, die alles beantwortet, lag längst in Redis:** `zyklus:tag:<UTC-
Datum>` zählt jeden Zyklus-Ausgang — sie ging bisher nur einmal am Tag um
22:05 UTC als Tagesbilanz raus.

**Ein Lesepfad schreibt gemeinsamen Zustand nicht** (07.09.). Besitzer von
`__daily_trades__` ist der Orchestrator. Passt das Datum nicht, schreibt
`/status` **nichts**, sondern liest dieselbe Quelle wie der Besitzer:
Redis `daily_trades:<Datum>`. Genau so hat am 07.09. ein Statusbericht das
Tageslimit zurückgesetzt.

### Zwei eigene Fehler — beide vom Prüfstand gefunden

- **`/status` starb, statt zu antworten.** `handelsLage` ist ein
  **statischer** Import, und `ladeTsModul` ersetzt jeden Import durch einen
  Stellvertreter, der beim Aufruf **wirft**. Das ist kein Prüfstands-
  Artefakt: es heisst, dass ein Fehler in dieser einen Zeile den ganzen
  Befehl umbringen konnte — ausgerechnet den, den man benutzt, wenn etwas
  kaputt ist. Jetzt Rückfall **mit Grund** („Lage nicht berechenbar — …")
  statt stumm zu sterben, und der Prüfstand bekommt das echte Modul.
- **Sieben Quellen nacheinander** = im schlimmsten Fall 7 × 5 s = **35
  Sekunden** bis zur Antwort. Keine hängt von einer anderen ab, also
  `Promise.all` — Obergrenze fünf Sekunden. Der Prüfer hält beides fest.

### Absicherung

`safety-nets` **rechnet** `handelsLage()` durch (650 → **773**): alles
unbekannt darf **nichts** behaupten, jeder der drei stillen Ausgänge wird
einzeln gefangen, der Drawdown wird gerechnet (2000 → 1700 = −15 % gegen
Grenze 10), ein `NaN` gilt nicht als Zahl, und der **gesunde** Fall muss
grün bleiben — sonst wäre der Riegel nur „immer rot" (Lehre vom 15.09.).

Dazu die **Verdrahtung an der Quelle**: `mode`, `maxConcurrentPositions`,
`maxTradesPerDay` und `tradeLimitEnabled` werden per Klammerzähler aus
`DEFAULT_SETTINGS.botSettings` geschnitten, `maxTotalDrawdownPct` aus
`riskSettings`, und die Redis-Schlüssel müssen über `PEAK_SCHLUESSEL` bzw.
`TAGESSUMME_SCHLUESSEL(handelstag())` kommen statt als Zeichenkette.

**21 von 23 Sabotagen** im ersten Lauf. Die Gegenprobe fing beide
Ausreisser — und deckte dabei ein **drittes** Loch auf:

| entwischt | warum |
|---|---|
| Sortierung der Ausgänge entfernt | **meine Testdaten** standen schon in der richtigen Reihenfolge — `Object.entries` behält sie, also kam ohne Sortierung dasselbe heraus. Jetzt absichtlich verkehrt eingetragen |
| Urteil ohne Trichter-Hinweis | die Sabotage war **wirkungslos** (nur das erste Textstück ersetzt) **und** die Prüfung zu schwach: sie suchte im ganzen Text statt in der Urteilszeile |
| Parallelität entfernt (`Promise.allSettled`) | die Prüfung suchte `await Promise.all([` **irgendwo in der Datei** — und fand ein **zweites, unbeteiligtes** Vorkommen in einem ganz anderen Befehl (Zeile 815). Jetzt an die Zuweisung selbst gebunden |

Die ersten beiden sind zum wiederholten Mal dieselbe Lehre: **ein Testfall,
der den Fehler nicht ausdrücken kann, beweist nichts.** Der Grund steht
jetzt im Prüfer.

Das dritte ist wörtlich die Lehre vom 25.10.: **ein Treffer beweist
nichts über die andere Stelle.** Dort war die Antwort, zu **zählen**
statt zu finden; hier, den Ausdruck an die Zuweisung zu binden.

### Der erste Lauf hat geantwortet — und meinen Verdacht widerlegt

Live auf `a6bcd96`:

```
✅ Broker: Capital.com verbunden      ✅ Modus: AUTO
✅ Positionen: 0/6                    ✅ Tageslimit: 0/21
✅ Gesamt-Drawdown: -6.02 % (Grenze -10 %, Höchststand 1990.36, Stand 1870.57)
✅ Handelszeit: offen                 ✅ Zyklen heute: 258
📤 Ausgänge heute:
   • Keine freigegebenen Signale: 100
   • Ausserhalb Handelszeit: 96
   • Keine Kandidaten nach Filter: 62
```

**Mein Verdacht „Modus steht auf MANUAL" war falsch** — er steht auf AUTO.
Die Vermutung stand als Vermutung da und ist damit widerlegt; so gehört es.

**Kein einziges Tor blockt.** 162 von 258 Zyklen sterben im **Trichter**:
100-mal kam der Scan ohne freigegebenes Signal zurück, 62-mal liess die
Filterkette keinen Kandidaten übrig. Die 96 „Ausserhalb Handelszeit" sind
die Nacht im selben UTC-Tag und völlig normal.

### Ein Verweis ist keine Antwort

Das Urteil lautete: „die Zyklus-Tagesbilanz (22:05 UTC) sagt an welcher
Stufe." **Dabei liegen dieselben Zahlen in derselben Tagessumme**, die der
Block ohnehin schon liest — er zeigte nur `zyklen` und `ausgaenge` davon.
Das ist „jede Stufe braucht eine eigene Zahl" (22.09.) eine Ebene weiter
vorn: ein Verweis auf eine andere Nachricht ist keine Zahl.

Jetzt steht der Trichter **in derselben Antwort** — Richtungssignale,
KI-Veto, Stil verworfen, ohne vollständige Daten **samt Grund**, unter der
Confidence-Grenze **mit Spanne**, an der Risiko-Freigabe gescheitert, ohne
Stop/Ziel, GO. Und das Urteil **nennt die grösste Stufe**, statt zu
verweisen.

**Drei Regeln dabei, alle aus früheren Funden:**

- eine Stufe ohne Zahl heisst **unbekannt**, nicht 0 — sonst wird aus
  „nicht gemessen" eine Messung (22.09.);
- bei `GO > 0` sagt das Urteil **„dann liegt es an der Ausführung"** statt
  weiter auf den Trichter zu zeigen;
- ohne Analyse (`scans === 0`) wird **kein** Trichter vorgetäuscht.

Die Feldnamen hängen an der **Quelle**: `safety-nets` schneidet den Typ
`Tagessumme` per Klammerzähler aus `zyklus-bilanz.ts` und hält jeden der
dreizehn Namen dagegen — und dass `richtungen` wirklich **BUY + SELL**
summiert, nicht nur BUY.

### Der zweite Live-Lauf: GO 2, und trotzdem kein Trade (30.10.)

```
107 Analysen · 3210 Marktanalysen
Richtungssignale (BUY/SELL): 0        GO: 2
Ausgänge: Keine freigegebenen Signale 105 · Keine Kandidaten nach Filter 2
```

**GPT lieferte in 3210 Analysen NULL Richtungen.** Und die zwei GO können
nur aus dem **gemessenen Konsens** stammen — zwingend, nicht gedeutet: ein
GO verlangt `source === "GPT_REAL"` oder `"MEASURED_CONSENSUS"`
(`ai-analysis-engine.ts:1897`). Bei `GPT_REAL` wäre die Richtung mitgezählt
worden, sie ist 0. Der Konsens-Pfad feuert **ausschliesslich** bei
`gpt.direction === "WAIT"` und nur bei eingeschaltetem Regler. **Also ist
`allowMeasuredConsensus` im Live-System AN** — der Standard ist AUS.

**Beide starben NACH dem GO:** 107 − 105 = 2, und genau zweimal lautet der
Ausgang „Keine Kandidaten nach Filter". Der kommt aus **drei** Toren
(`orchestrator-agent.ts:982–1017`): Walk-Forward-Überanpassung, Confidence
unter der Schwelle, Stil-Tageslimit.

#### Ein Urteil, das auf die falsche Stelle zeigt

Mein eigener Block sagte dazu: *„Bleiben die Trades trotzdem aus, liegt es
an der **Ausführung**, nicht an der Signalkette."* Im selben Bericht stand
„Keine Kandidaten nach Filter: 2". **Die Filterkette des Orchestrators ist
nicht die Ausführung** — das Urteil schickte in die falsche Richtung.

Und welches der drei Tore es war, lag als **`tore`** in **derselben
Tagessumme**, die der Block ohnehin liest (`TorSumme = {ja, nein,
fallback, gruende}`). Wieder „ein Verweis ist keine Antwort", diesmal eine
Stufe weiter hinten.

Jetzt steht in `/status` ein Block **„Tore nach dem GO"** mit `ja`/`nein`,
Rückfall und dem **häufigsten Grund** je Tor — und das Urteil **nennt das
grösste ablehnende Tor**. „Ausführung" sagt es nur noch, wenn **kein** Tor
abgelehnt hat.

`safety-nets` 715 → **762**, **7 von 7 Sabotagen** — darunter die
Wiederherstellung des falschen Urteils.

**Die drei Tor-Prüfungen fielen zuerst durch — wieder die Testdaten:** sie
liessen alle übrigen Eingaben auf `null`, damit griff das
„unbekannt"-Urteil **vor** den GO-Zweigen und der Fall war gar nicht
erreichbar. Jetzt ein vollständiger „alles bekannt"-Satz **plus eine
Selbstprüfung**, die rot wird, wenn die Testdaten diese Eigenschaft
verlieren.

#### Behoben: WAIT und „nicht geantwortet" waren dasselbe

Gezählt wird `normalisiereRichtung(gptData?.direction ?? "WAIT")`, und
daneben steht der Zweig

```ts
} else if (hasGPT) {
  // GPT hat dieses Symbol trotz Anweisung nicht beantwortet → sicherer WAIT
  gpt = { ...noSignal(market), source: "GPT_REAL" };
}
```

**Eine ausgebliebene Antwort wird also als WAIT gezählt.** Die Bilanz kann
„GPT sagte WAIT" nicht von „GPT hat gar nicht geantwortet" unterscheiden —
und bei **0 von 3210** Richtungen ist genau das die Frage, mit der man ins
Railway-Log steigt. Fehlerklasse „ein Ausfall darf sich nicht als Ergebnis
ausgeben".

**Jetzt gezählt — und zwar im SELBEN Zweig, der entscheidet.** Der Zähler
`ohneGptAntwortZahl` steht direkt neben `gpt = { ...noSignal(market) }`, so
wie es die Regel vom 22.09. verlangt: Zahl und Verhalten können nicht
auseinanderlaufen. Die Zahl geht über `ScanDaten` in die `Tagessumme`, von
dort in die **Tagesbilanz** („davon OHNE GPT-Antwort") und in den
`/status`-Trichter.

**Die Änderung an der Hochrisiko-Datei ist reine Messung** — belegt, nicht
behauptet: der Diff besteht aus einem Kommentar, einer
Zähler-Deklaration, einem `++` und einem Feld in `ScanDaten`. **Keine**
Entscheidungszeile ist angefasst; `gpt = { ...noSignal(market), source:
"GPT_REAL" };` steht Zeichen für Zeichen unverändert da. Vorher lief die
Pflicht-Impact-Analyse (`system-map --impact`): benutzt von Scanner-Route,
Analyse-Agent und Orchestrator, abgesichert durch **sechs** Prüfer —
darunter `snapshot` (Prüfsumme des GPT-Regelteils) und `prompt-zahlen`.

**Eine Summe von gestern kennt das Feld noch nicht.** Deshalb steht
`zahl()` auf **beiden** Seiten der Addition — dieselbe Vorsicht wie bei
`ohneStopZiel`. Ohne sie wirft die erste Tagessumme nach dem Deploy.

Die Zahl steht auch in der **Zyklus-Zeile** (`[zyklus]`, eine pro Lauf) —
ohne sie bliebe dort `GPT 30W/0B/0S` genauso mehrdeutig wie in der
Tagesbilanz. Nur bei > 0, wie `Stil` und `ohne Stop/Ziel`.

`safety-nets` 762 → **773**, **9 von 9 Sabotagen**. Die wichtigste ist die
**Gegenprobe**: der Zähler darf **nicht** auch im Zweig mit einer ECHTEN
Antwort laufen — sonst zählte er Urteile als Ausfall. Der Zweig wird dafür
per Klammerzähler ausgeschnitten; ein Zeichen-Fenster bewiese nur Nähe,
nicht Zugehörigkeit (22.09.).

**Zwei eigene Fehler beim Einbau, beide vom eigenen Skript gefangen:** ein
Anker traf **zwei** Stellen (`ScanDaten` und `Tagessumme` haben dieselbe
Zeilenfolge) — der Lauf brach ab, und die halb geänderte Datei wurde exakt
auf HEAD zurückgestellt. Und ein fest verdrahtetes `\r\n` in einer
Ersetzung machte `zyklus-bilanz.ts` **gemischt**; der Schlusscheck hat es
gemeldet, die Datei ist wieder rein LF, der Inhalt unverändert.

#### Ein erzeugter Patch hat sich selbst zerlegt — `$&`

Beim Einbau wurde der Prüfer unladbar (`SyntaxError`). Die Ursache ist
keine Tippfehler-Geschichte, sondern eine Regel:
**`$` ist im Ersetzungstext von `String.replace` ein Sonderzeichen.**
Mein Ersatz enthielt `"\\$&"` — als Regex-Escape gedacht —, und JS setzte
dort den **ganzen gefundenen Anker** ein.

Behoben, und zwar zweifach: Einsetzen über eine **Funktion** als Ersatz
(dort bedeutet `$` nichts), und an der Stelle selbst **gar kein Regex** —
eine Zeilensuche mit `includes` braucht kein Escaping. Dieselbe Familie wie
die verschluckten Backslashes: Werkzeuge, die den Text noch einmal
interpretieren, bevor er ankommt. **Nach jedem erzeugten Codeblock `node -c
<datei>`** — sonst fällt der Fehler erst im Prüferlauf auf, mit einer
irreführenden Fundstelle.


## Welche Schraube würde etwas ändern? `/hebel` (29.10.)

`/edge` sagt, **dass** kein Edge da ist. `/status` sagt seit heute,
**wo** die Signale sterben. Offen blieb die Frage davor: **welche
Einstellung würde überhaupt etwas ändern?**

`/hebel` gruppiert dieselben echten Trades nach den Grössen, an denen man
drehen kann — **geplantes R/R**, **Handelsstil**, **Richtung**, **Markt**,
**Strategie** — und nennt je Gruppe den Erwartungswert, die Trefferquote
und das realisierte R/R. Reine Rechnung: keine Order, kein Stop, keine
Einstellung.

### Es rechnet nicht selbst

Jede Gruppe geht durch **`erwartungswert()`** — dieselbe Funktion,
dieselben Ausschlüsse (`KEIN_PNL`/`NIE_BESTAETIGT`, unlesbare Notizen,
Fenster, Zeilen ohne Datum). Eine zweite Formel wäre eine **zweite
Wahrheit**: `/edge` und `/hebel` könnten sich dann widersprechen, und
niemand wüsste, welcher recht hat. Genau so hat sich der erste
`/edge`-Lauf am 26.10. um den **Faktor 5.32** selbst widerlegt.

Der Prüfer hält das als wichtigste Zusicherung fest: dieselben Zeilen
durch `/edge` und durch `/hebel` müssen **dieselbe Zahl** ergeben.

### Drei Regeln, die im Bericht stehen — nicht nur im Code

- **Unter `MIN_TRADES` (30) kein Erwartungswert**, sondern der Grund.
- **Ein Befund braucht zwei belastbare Gruppen.** „EW 99 bei 4 Trades" ist
  Rauschen, kein Hebel — und genau so entstehen Empfehlungen, die Geld
  kosten.
- **Ein Unterschied ist keine Zusage.** Wer eine Schwelle verschiebt,
  ändert auch die **Menge** der Trades; die übrigbleibenden sind dann
  nicht mehr dieselben wie die gemessenen. Das steht so in der Antwort.

**Und was NICHT geht, steht auch drin:** eine Empfehlung zur
**Confidence-Schwelle** ist aus den echten Trades **nicht** berechenbar —
die `Trade`-Tabelle hat keine Confidence-Spalte (im Schema nachgesehen,
nicht vermutet). Eine erfundene Empfehlung wäre schlimmer als keine.

**Eine 0 ist kein R/R.** `riskReward` hat im Schema `@default(0)`; eine 0
heisst „nie geschrieben" und kommt in ein eigenes Band, statt als
schlechtestes R/R mitgerechnet zu werden — dieselbe Regel wie bei
`profitLoss` am 26.10.

### `NaN` landete im BESTEN Band

Vom eigenen Prüfstand gefangen, nicht von Hand:

```ts
if (v === null || v <= 0) return "ohne Angabe";   // NaN <= 0  ist FALSE
if (v < 1.5) return "< 1.5";                      // NaN < 1.5 ist FALSE
…
return "≥ 3.0";                                   // ← hier landet NaN
```

Ein `NaN` fiel durch **alle** Vergleiche und damit ins beste Band. Das ist
wörtlich die Falle aus `checkPriceAvailable` (24.08.) und `ordersRiegel`
(28.10.) — zum dritten Mal dieselbe, diesmal in einer neuen Funktion.
Behoben mit `Number.isFinite`. Der heutige Aufrufer hätte nie ein `NaN`
hereingereicht; die Funktion ist exportiert und muss **für sich** stimmen.

### Absicherung

`safety-nets` **rechnet** das (715 → **778**): `rrBand` an elf Werten,
die Gleichheit mit `/edge`, das durchgereichte Fenster **samt**
Gegenprobe ohne Fenster, der `MIN_TRADES`-Riegel, der Befund mit null,
einer und zwei belastbaren Gruppen — und dass der Text seine eigenen
Grenzen nennt.

**13 von 16 Sabotagen** im ersten Lauf, danach **3 von 3**:

| entwischt | Diagnose |
|---|---|
| Trefferquote mit falschem Nenner | **meine Testdaten hatten keinen Breakeven** — dann sind `trefferquote` und `trefferquoteEntschieden` zufällig gleich. Jetzt zehn Breakeven drin, **plus eine Selbstprüfung**, die rot wird, wenn die Daten die Eigenschaft verlieren |
| Confidence-Hinweis entfernt | mein Sabotage-Anker schrieb „waere", die Datei sagt „wäre" — Fehler im Nachweis, nicht im Prüfer |
| `MIN_TRADES` ignoriert | **wirkungslose Sabotage, ausgeführt belegt**: `erwartungswert()` gibt unter 30 Zeilen **selbst schon** `null` (5 Zeilen → `null`, 40 Zeilen → `0.9`). Die äussere Klemme ist redundant; sie als „entwischt" zu zählen wäre ein Messfehler |

Zum wiederholten Mal dieselbe Lehre — **ein Testfall, der den Fehler nicht
ausdrücken kann, beweist nichts.** Neu ist diesmal die Konsequenz: die
Testdaten tragen jetzt eine **eigene Prüfung**, die anschlägt, wenn sie
ihre unbequeme Eigenschaft verlieren.

Dazu die Gegenprobe, dass der Prüfstand nicht einfach immer rot ist: eine
nachweislich **wirkungslose** Sabotage (ein eingefügter Kommentar) muss
grün bleiben — die Lehre vom 15.09.

### Ein Feldname aus dem Gedächtnis — in meinem eigenen `/hebel` (30.10.)

`/hebel` las `ausNotizen(z.notes, "stil")`. Die Journal-Notizen schreiben
aber **`tradingStyle`** (`capital-trade-tracker.ts`), und der autoritative
Leser `stammdatenAusNotizen` (`risk-agent.ts:933`) liest denselben Namen.
**Die Dimension „Handelsstil" war damit dauerhaft „ohne Angabe"** — und sah
dabei wie ein ehrliches Ergebnis aus.

Exakt die Fehlerklasse vom 30.09., einen Tag nach dem Kapitel darüber. Und
**der Prüfer blieb grün, weil meine Testdaten denselben erfundenen
Schlüssel benutzten** — ein Testfall, der den Fehler nicht ausdrücken kann.

Jetzt holt der Prüfer den Namen **an der Quelle**: der Notizen-Block wird
per Klammerzähler aus `capital-trade-tracker.ts` geschnitten, und die
Gegenprobe gehört dazu — benennt der Tracker das Feld um, wird er rot.
**4 von 4 Sabotagen**, darunter der echte Fehler exakt wiederhergestellt.

**Dabei zweiter Fund:** die Spalte `Trade.strategy` bekommt
`"<tradingStyle> | <strategy>"`, und der Orchestrator setzt
`strategy: candidate.gpt.tradingStyle` — bei Auto-Trades steht dort also
**zweimal der Stil**. Der Titel heisst deshalb jetzt „Strategie-Feld (Stil |
Strategie)" mit dem Hinweis, dass die Spalte die **Signalherkunft nicht**
unterscheidet.

**Und daraus folgt die Grenze von `/hebel`:** ob ein Trade von GPT oder vom
gemessenen Konsens kam, steht **nirgends** im Trade. `notes.source` heisst
dort „auto-scan" gegen „rekonstruiert". Ohne diese Angabe lässt sich der
Regler `allowMeasuredConsensus` **nicht an Daten beurteilen**.

### Was NICHT gebaut wurde — und warum

Eine **Selbstverstellung** (das Programm dreht die Schwellen selbst) ist
damit ausdrücklich **nicht** gebaut. Gemessen am 29.10.: es gibt bereits
**fünfzehn** Module mit genau diesem Zweck —
`adaptive-broker-weighting`, `autonomous-trading-evolution`,
`evolution-governance`, `strategy-evolution`,
`strategy-weight-auto-rebalancing` und zehn weitere —, und **0 von 15
hängen an einer Schleife**. Sie hängen aneinander und an API-Routen; mit
`system-map --impact` gegengeprüft, kein Pfad führt zu
`instrumentation.ts`.

Ein „Automat" wäre hier also **Verdrahten, nicht Bauen** — und gehört erst
gegangen, wenn gemessen ist, dass die Verstellung den Erwartungswert
**hebt**. Auf einem negativen EW (−2.39 je Trade, Stand 29.10.) verstellt
sich ein Auto-Tuner **schneller in den Verlust**: er lockert die Tore, bis
wieder Trades durchkommen, und aus „keine Trades" werden „schlechte
Trades".

## Ohne Stop keine Order (28.10.)

Gefunden beim Nachgehen der Frage, ob offene Positionen geschützt sind, wenn
Railway die Dienste anhält.

`LiveExecutionMonitor.tsx` — die Dashboard-Ansicht **„live-execution"**
(`app/page.tsx:3675`, also kein toter Winkel) — schickt beim GO-Knopf
**weder** `stopLossPrice` **noch** `takeProfitPrice`:

```ts
body: JSON.stringify({ symbol, direction, riskPercent, accountBalance,
                       confidence, strategy, tradingStyle: "DAYTRADING" })
```

Die Route reicht das unverändert durch (`execute/route.ts:23-24`, kein
Standardwert), und `capital-com-client.ts:760` lässt das Feld dann weg:

```ts
if (order.stopLevel != null) body.stopLevel = order.stopLevel;
```

**Die Order wäre ohne Stop beim Broker herausgegangen.** Und das Schlimmere:
die Grösse wird trotzdem gerechnet — über `DEFAULT_STOP_BY_STYLE`, also **für
einen Stop, den es nicht gibt**. Das Risiko wäre auf 1 R bemessen und der
Verlust nach oben offen. Die Journal-Zeile bekäme dazu `stopLoss: 0`
(`execute/route.ts:48`).

**Der Knopf KANN den Stop nicht liefern:** `QueueItem` hat gar kein
Stop-Feld.

### Der automatische Handel war nie betroffen — nachgeprüft, nicht vermutet

```
goSignal verlangt gpt.stopLoss > 0 && gpt.takeProfit > 0   (ai-analysis-engine.ts:1956-1957)
  → goSignals = opportunities.filter(o => o.goSignal …)     (analysis-agent.ts:440)
  → `approved` entsteht ausschliesslich aus goSignals        (Schleife 449)
  → Orchestrator reicht slPrice/tpPrice durch                (orchestrator-agent.ts:1305, 1351)
```

`MarketScannerPanel.tsx:163-164` schickt beides ebenfalls mit. Der Riegel
blockiert damit **genau einen** Weg: den Knopf, der es vergisst.

### Warum der Riegel in der Ausführung sitzt, nicht in der Komponente

Dieselbe Begründung wie beim Notaus und bei `checkPriceAvailable` (24.08.):
eine Zusicherung gehört an die Stelle, an der sie gilt.
`executeCapitalDemoOrder` ist der Punkt, an dem Geld bewegt wird — gerufen von
der Route, vom ExecutionAgent und über den Orchestrator aus
`instrumentation.ts`. Ein Riegel **dort** deckt alle drei und hält auch, wenn
morgen ein vierter Aufrufer dazukommt.

`Number.isFinite` steht mit Absicht da: `NaN <= 0` ist **false**.

### Und der Wortlaut beweist hier nichts

Von zehn Sabotagen entwischte zuerst **eine** — und zwar die gefährlichste:

```ts
if (riegel) { … }   →   if (false) { … }
```

Der Riegel wird dann **gerechnet und weggeworfen**, der Wortlaut steht weiter
da, und die Reihenfolge-Prüfung (`ordersRiegel` vor `capitalPlaceOrder`)
bleibt grün. Wörtlich die Fehlerklasse vom 30.09.: *„ein Regex prüft den
Wortlaut, nicht das Verhalten."*

Jetzt läuft die **echte** `executeCapitalDemoOrder` gegen einen **gezählten**
`capitalPlaceOrder`: ohne Stop darf er **null** mal gerufen werden, mit Stop
und Ziel **genau einmal**. Die Gegenprobe gehört dazu — ein zu strenger Riegel
stellte den echten Handel still, und das wäre schlimmer als der Fund.
**10 von 10.**

### Zwei Zweige, die nur die Meldung verbessern — und wie das auffiel

Zwei weitere Sabotagen blieben zuerst grün: `undefined/null` und
`typeof !== number` aus `pruefe()` zu entfernen. Ausgeführt gemessen:
`Number.isFinite` fängt `undefined`, `null`, Text, `NaN` und `Infinity`
**allein** — die zwei Zweige blockieren nichts Zusätzliches, sie machen nur
die **Meldung** brauchbar („fehlt" statt „nicht endlich").

Sie als „entwischt" zu zählen wäre ein Messfehler gewesen. Richtig ist, ihren
Zweck zu prüfen: der Prüfer hält jetzt den Meldungstext je Fall fest.

**Und vier Anker griffen gar nicht** — beides eigene Messfehler: die Datei ist
rein **CRLF** (ein `\n`-Anker kann dort nicht greifen), und `return pruefe(…)`
hat **zwei** Leerzeichen Einzug, nicht vier.

### Der GO-Knopf war nie klickbar — die Ansicht ist entkernt (28.10.)

Beim Absichern des Riegels zeigte sich, dass der gefährliche Weg **gar nicht
erreichbar war**. Drei Befunde, alle gemessen:

**1. Die Liste war immer leer.** `LiveExecutionMonitor.tsx` las
`queue.queue` und `queue.queuedTrades`;
`/api/execution-queue-position-sync` liefert aber `items` und `totalItems`:

```tsx
{!queue?.queue?.length ? ( …leer… ) : queue.queue.map(…)}
```

`queue.queue` war **immer `undefined`** → der Leer-Zweig lief immer → kein
Eintrag, kein Knopf. Dieselbe Feldnamen-Fehlerklasse wie am 30.09., eine
Ebene tiefer: die Messung vom 22.10. prüfte `d.report`, **nicht die Felder
darin**.

Das erklärt die `/edge`-Daten lückenlos: kein `UNBEKANNT`-Etikett, weil nie
ein Trade von dort kam.

**2. Es war die falsche Route.** Die erwarteten Namen (`queue`,
`queuedTrades`, `rank`, `adaptiveConfidence`, `riskPerTradePercent`) gehören
zu `/api/execution-queue-engine` — und die ruft **niemand** auf.

**3. „Korrigieren" wäre falsch gewesen.** Beide Queue-Module erklären sich
selbst als nicht-live (`liveTradingEnabled: false` bzw.
`liveExecutionBlocked: true`, Modus `SIMULATION | READ_ONLY | PAPER_MODE`)
und tragen **keinen Stop**. Die Route zu korrigieren hätte eine
Simulations-Queue an den echten Broker gehängt.

Entfernt wurden deshalb: die Queue-Anzeige, der GO-Knopf, das Execution-Log
und der Schalter **„Auto-Execute GO Signale"** — letzterer wurde
ausschliesslich für seine **eigene Darstellung** gelesen. Ein grünes „AN",
das nichts tut, ist dieselbe Klasse wie die falschen Killswitch-Texte
(27.09.) und die IC-keep-alive-Zeile (25.10.).

Auch das Eingabefeld für den Kontostand ist weg: es speiste nur die
Ordergrösse des entfernten Knopfs. Jetzt steht dort der **echte** Wert vom
Broker als Anzeige — und „unbekannt", wenn keine Sitzung steht.

**Geblieben** ist, was nachweislich funktioniert: die offenen Positionen aus
`/api/capital-com/positions` (`d.positions`, am 22.10. einzeln geprüft) und
der Schliessen-Knopf.

**Die Zusicherung unten ist nachgeprüft, nicht behauptet:** `useLiveApi` hat
den Standardwert `false` und **kein Aufrufer** übergibt ihn; alle übrigen
Endpunkte sind fest auf `DEMO_BASE` (`capital-com-client.ts`).

#### Und ein allgemeiner Riegel statt einer Einzelfallnotiz

`safety-nets` hält jetzt fest: **jede Datei, die eine Order-Route ruft, muss
`stopLossPrice` kennen** — kommentarbereinigt, mit Selbstprüfung gegen
`MarketScannerPanel` als bekanntem Auslöser. **4 von 4 Sabotagen**, darunter
der Fund vom 28.10. exakt nachgebaut.

**Ehrlich zur Reichweite:** die Prüfung arbeitet auf **Datei**-Ebene und
beweist nicht, dass der Wert auch *in diesem Aufruf* landet. Dafür gibt es
`ordersRiegel()`, der zur Laufzeit greift. Hier geht es um den Fall, den wir
hatten: eine Komponente, die den Stop **nirgends** erwähnt.

**Eine eigene Sabotage war dabei wirkungslos** und blieb zu Recht grün: ich
zerstörte nur **eine** der beiden Order-Routen in `MarketScannerPanel` — die
Datei ruft sie in **einem** `Promise.all` zusammen auf und galt weiter als
Auslöser.

#### Dabei korrigiert: eine eigene Falschmeldung

Mein Suchwerkzeug meldete zwei API-Routen, die das Ergebnis von
`autoReconnectCapital()` wegwerfen. **Eine davon war keine:**
`/api/capital-com` liest `getLastReconnectError()` und gibt `reconnectError`
in der Antwort zurück (Zeile 20, 47, 59) — der Grund geht dort **nicht**
verloren, er wird nur über den gespeicherten Zustand gelesen. Das Werkzeug
mass die Aufrufstelle, nicht den Informationsfluss.

Echt war nur `/api/execution-queue-position-sync`: dort fehlte der Grund in
der Antwort. Jetzt steht er drin, genau wie bei der Schwesterroute.

**Und die Route ist weiterhin in Gebrauch** —
`ExecutionQueuePositionSyncPanel.tsx:111` ruft sie auf (eingebunden über
`ForwardTestingCenter.tsx:289`). Im Kommentar der entkernten Datei stand
kurzzeitig das Gegenteil, weil die Suche nur diese eine Datei im Blick hatte.

#### Und der Grund hing dort im Leeren — ein Feld ohne Empfänger (28.10.)

Beim Gegenlesen des eigenen Fixes: die Route schickte `capitalComActive`
**schon vorher** mit, und `ExecutionQueuePositionSyncPanel` liest **keines
von beiden**. Nachgezählt, nicht vermutet — `reconnectError` hat genau
**einen** Leser im ganzen Programm, und der sitzt an der *anderen* Route
(`SettingsDashboard.tsx:254`).

Ein Feld ohne Empfänger ist dieselbe Klasse wie ein **Abo am Bus ohne
Sender** (17.09.): es sieht nach Information aus und geht ins Leere. Ein
drittes stummes Feld zu pushen wäre genau der Fehler, den dieser Tag
behebt — deshalb hat die Ansicht jetzt eine Broker-Zeile.

**Dreiwertig, und das ist der Punkt:** `undefined` heisst **unbekannt** und
sagt das auch („die Antwort trägt kein Feld `capitalComActive`"), nicht
„nicht verbunden". Eine stille Null wäre der Fehler vom 30.09., eine Ebene
höher. Weil dieser Zustand **getypt** ist (nicht `any`), fängt `tsc` hier
zusätzlich einen Tippfehler im Feldnamen — an den `any`-Stellen tut er das
nicht.

##### Die Entscheidung gehört in eine Funktion, nicht ins JSX

Zuerst stand die Lage als Ternär-Kette direkt in der Komponente. **Der
Sabotage-Lauf hat das widerlegt: 6 von 8** — und beide Ausreisser waren
echte Prüferlöcher, keine schwachen Sabotagen:

| entwischt | warum | behoben durch |
|---|---|---|
| Feld fällt aus der **Antwort** | die Suche fand die **Variablendeklaration** `const capitalComActive = isCapitalConnected()` — „ein Wort an einer anderen Stelle ist keine Verwendung" | Klammerzähler schneidet den Rumpf von `NextResponse.json(` aus |
| der **unbekannt**-Zweig verschwindet | der Ausdruck `=== false` stand **zweimal** da (Farbe **und** Text); eine Sabotage am Text liess den Wortlaut im Farb-Zweig stehen | `brokerLage()` als eigene Datei, vom Prüfer **ausgeführt** |

Die zweite ist die lehrreichere: eine Struktur-Prüfung auf *Vorhandensein*
kann zwei Vorkommen desselben Ausdrucks nicht auseinanderhalten. Die
Anzeige hätte bei fehlender Antwort wieder „nicht verbunden" behauptet,
während der Prüfer grün blieb. Jetzt wird `brokerLage()` mit `true`,
`false` und `undefined` **gerechnet**, und alle drei Texte müssen
verschieden sein.

`safety-nets` hält beide Richtungen (632 → **650**): die Route muss senden,
die Anzeige muss lesen **und** die Funktion rufen, und die Dreiwertigkeit
darf nicht auf `!report.capitalComActive` verkürzt werden.

**14 von 14 Sabotagen** in der zweiten Runde — beide Ausreisser als eigene
Fälle, dazu die Teilzeichenketten-Falle vom 30.09.:
`report.capitalComActiveXX` **enthält** den alten Namen, mit `includes()`
wäre die Umbenennung grün geblieben. **Mein erster Entwurf hatte genau
das.** Jetzt mit Wortgrenze.

**Drei der vierzehn sabotieren die Werkzeuge des Prüfers selbst** — die
Kommentar-Bereinigung in beide Richtungen (streift nichts ab / frisst
alles) und den Klammerzähler. Die Selbstprüfung läuft dafür an **selbst
gebauten** Zeichenketten, nicht am Dateiinhalt: am Dateiinhalt hinge sie
an einer Formulierung.

**Nicht `objectBlock` aus `_lib`:** das zählt nur `{}` ohne
Zeichenketten-Bewusstsein — eine `}` in einem Text schliesst dort den
Block, genau die Falle vom 30.09. bei `metaAntwortLesen` — und es wirft
statt `null` zu liefern.

#### Zwei Funde in der entkernten Datei selbst (28.10.)

Beim dritten Gegenlesen — die Ansicht zeigt jetzt den echten Kontostand
und die offenen Positionen, und beides war einen Schritt zu ungenau:

- **`balance > 0`** machte aus einem **echten** Stand von 0 ein
  „unbekannt". Die Quelle ist `balance: session?.balance ?? null`
  (`app/api/capital-com/route.ts`) — `null` heisst *nicht abrufbar*, eine
  Zahl ist *gemessen*. Die Regel vom 22.09. gilt auch in dieser Richtung:
  aus einer Messung darf kein „unbekannt" werden. Jetzt `Number.isFinite`.
- **`new Date(pos.createdDate).toLocaleTimeString()`** schrieb wörtlich
  **„Invalid Date"** in die Zeile, wenn die Zeit leer ist — und leer ist
  sie mit **Absicht**: `brokerZeitNachUtc()` gibt bei fehlender
  Zonenangabe nichts zurück statt zu raten
  (`capital-com-client.ts:965`). Jetzt eine Funktion `zeit()`, die „—"
  ergibt; die vier Fälle (leer, `undefined`, Unsinn, echte Zeit) sind beim
  Einbau **gerechnet** worden, nicht behauptet.

**Und die systematische Frage dazu, gemessen:** 30 Stellen im Frontend
schreiben `new Date(<Variable>).toLocale…` (542 Dateien gescannt,
kommentarbereinigt, Selbstprüfung in beide Richtungen). Genau **eine**
davon las eine **Broker**-Zeit, die konstruktionsgemäss leer sein kann —
die hier behobene. Die anderen 29 lesen Zeitstempel, die **unser eigener**
Code schreibt (`updatedAt`, `checkedAt`, `generatedAt`, `scannedAt`).

**Ehrlich zur Grenze:** ob bei diesen 29 das Feld im Einzelfall **fehlen**
kann, ist **nicht gemessen** — `new Date(undefined)` ergäbe dort dasselbe
„Invalid Date". Das ist eine eigene Messung und war nicht Teil dieses
Commits.

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
