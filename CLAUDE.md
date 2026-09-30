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
ruft nur ein Knopf im Dashboard. **Offen bleibt der Widerspruch im Log.**

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

`menue-ansichten` **rechnet** das jetzt (38 → 68 Prüfungen) und hält die Seite
zusätzlich strukturell fest: kehren die Literale zurück, verschwindet ein
`fetch`, oder steht der Startwert wieder auf `false`, wird er rot. **16 von 16
Sabotagen gefangen**, darunter der gefährlichste Rückbau — `dreiwertig()` auf
`v === true` zu verkürzen, womit jede fehlgeschlagene Abfrage wieder „nicht
verbunden" hiesse.

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
