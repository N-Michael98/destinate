export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getPrisma } = await import("./app/lib/prisma");
    const db = getPrisma();
    try {
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "User" (
          "id" TEXT NOT NULL,
          "username" TEXT NOT NULL,
          "email" TEXT NOT NULL,
          "passwordHash" TEXT NOT NULL,
          "role" TEXT NOT NULL DEFAULT 'USER',
          "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
          "emailVerifyToken" TEXT,
          "lastLoginAt" TIMESTAMP(3),
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "User_pkey" PRIMARY KEY ("id")
        )
      `);
      await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username")`);
      await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")`);
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Trade" (
          "id" SERIAL NOT NULL,
          "userId" TEXT,
          "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "market" TEXT NOT NULL,
          "direction" TEXT NOT NULL,
          "strategy" TEXT NOT NULL DEFAULT 'Unclassified',
          "entry" DOUBLE PRECISION NOT NULL,
          "stopLoss" DOUBLE PRECISION NOT NULL,
          "takeProfit" DOUBLE PRECISION NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'OPEN',
          "result" TEXT NOT NULL DEFAULT 'OPEN',
          "profitLoss" DOUBLE PRECISION NOT NULL DEFAULT 0,
          "accountSize" DOUBLE PRECISION NOT NULL DEFAULT 30000,
          "riskPercent" DOUBLE PRECISION NOT NULL DEFAULT 1,
          "riskAmount" DOUBLE PRECISION NOT NULL DEFAULT 300,
          "riskReward" DOUBLE PRECISION NOT NULL DEFAULT 0,
          "positionSize" DOUBLE PRECISION NOT NULL DEFAULT 0,
          "notes" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
        )
      `);
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "PaperOrder" (
          "id" SERIAL NOT NULL,
          "userId" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "broker" TEXT NOT NULL DEFAULT 'capital',
          "market" TEXT NOT NULL,
          "direction" TEXT NOT NULL,
          "strategy" TEXT NOT NULL DEFAULT 'Unclassified',
          "entry" DOUBLE PRECISION NOT NULL,
          "stopLoss" DOUBLE PRECISION NOT NULL,
          "takeProfit" DOUBLE PRECISION NOT NULL,
          "accountSize" DOUBLE PRECISION NOT NULL DEFAULT 30000,
          "riskPercent" DOUBLE PRECISION NOT NULL DEFAULT 1,
          "riskAmount" DOUBLE PRECISION NOT NULL DEFAULT 300,
          "riskReward" DOUBLE PRECISION NOT NULL DEFAULT 0,
          "positionSize" DOUBLE PRECISION NOT NULL DEFAULT 0,
          "status" TEXT NOT NULL DEFAULT 'OPEN',
          "result" TEXT NOT NULL DEFAULT 'OPEN',
          "profitLoss" DOUBLE PRECISION NOT NULL DEFAULT 0,
          "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
          "qualityGrade" TEXT NOT NULL DEFAULT 'B',
          "aiDecision" TEXT NOT NULL DEFAULT 'WAIT',
          "notes" TEXT,
          CONSTRAINT "PaperOrder_pkey" PRIMARY KEY ("id")
        )
      `);
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "LearningSnapshot" (
          "id" SERIAL NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "broker" TEXT NOT NULL DEFAULT 'capital',
          "symbol" TEXT NOT NULL,
          "winRate" DOUBLE PRECISION NOT NULL,
          "totalTrades" INTEGER NOT NULL,
          "adjustmentFactor" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
          "insights" TEXT,
          CONSTRAINT "LearningSnapshot_pkey" PRIMARY KEY ("id")
        )
      `);
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "BacktestRun" (
          "id" SERIAL NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "symbol" TEXT NOT NULL,
          "interval" TEXT NOT NULL,
          "period" TEXT NOT NULL,
          "strategy" TEXT NOT NULL,
          "winRate" DOUBLE PRECISION NOT NULL,
          "profitFactor" DOUBLE PRECISION NOT NULL,
          "totalReturn" DOUBLE PRECISION NOT NULL,
          "maxDrawdown" DOUBLE PRECISION NOT NULL,
          "sharpeRatio" DOUBLE PRECISION NOT NULL DEFAULT 0,
          "totalTrades" INTEGER NOT NULL,
          CONSTRAINT "BacktestRun_pkey" PRIMARY KEY ("id")
        )
      `);
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "SystemSettings" (
          "id" TEXT NOT NULL DEFAULT 'singleton',
          "data" TEXT NOT NULL,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
        )
      `);
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "AIConfig" (
          "id" TEXT NOT NULL DEFAULT 'singleton',
          "data" TEXT NOT NULL,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "AIConfig_pkey" PRIMARY KEY ("id")
        )
      `);
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "AppStorage" (
          "key" TEXT NOT NULL,
          "data" TEXT NOT NULL,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "AppStorage_pkey" PRIMARY KEY ("key")
        )
      `);
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "CapitalCredentials" (
          "id" TEXT NOT NULL DEFAULT 'singleton',
          "data" TEXT NOT NULL,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "CapitalCredentials_pkey" PRIMARY KEY ("id")
        )
      `);
      console.log("[instrumentation] Database schema ready");

      const { ensureAdminExists } = await import("./lib/auth/auth-store");
      await ensureAdminExists();
      console.log("[instrumentation] Admin user ready");

      // Load caches from DB into memory on startup
      try {
        const { MissionControlEventLog } = await import("./lib/mission-control/event-log");
        await MissionControlEventLog.init();
      } catch { /* non-fatal */ }
      try {
        const { AgentMemory } = await import("./lib/ai-agent/memory/agent-memory");
        await AgentMemory.init();
      } catch { /* non-fatal */ }
      try {
        const { PaperHistory } = await import("./lib/paper-trading/paper-history");
        await PaperHistory.init();
      } catch { /* non-fatal */ }
      try {
        const { init: initLearning } = await import("./lib/learning/learning-store");
        await initLearning();
      } catch { /* non-fatal */ }

    } catch (err) {
      // DER DATENBANK-VORLAUF DARF DIE SCHLEIFEN NICHT VERHINDERN (19.08.).
      //
      // Bis heute lag ALLES in einem einzigen try, dessen catch ganz unten
      // sitzt — auch die setInterval-Schleifen. War die Datenbank beim
      // Prozessstart nicht erreichbar, warf schon die erste Migration, und
      // damit wurde KEINE EINZIGE Schleife gestartet: kein Positions-Monitor,
      // kein Breakeven, kein Trailing, kein Python-Lifecycle, kein Watchdog.
      // Der Dienst stand auf "Online", die Website lief, das Handelssystem tat
      // nichts. Einzige Spur war eine console.error-Zeile, und es erholte sich
      // NIE — register() laeuft nur einmal je Prozess.
      //
      // Anlass: Railway kuendigte fuer Sa 10:00 - So 18:00 UTC einen
      // Sicherheits-Patch des Postgres an. Ein Neustart der Datenbank in genau
      // dem Moment, in dem auch dieser Dienst neu startet, haette das
      // ausgeloest.
      //
      // Die Migrationen sind `CREATE TABLE IF NOT EXISTS` — Hausarbeit. Die
      // Schleifen sind das Produkt. Schlaegt die Hausarbeit fehl, laeuft das
      // Produkt trotzdem an und findet die Datenbank beim naechsten Zyklus
      // von selbst wieder.
      console.error("[instrumentation] ⚠️ DATENBANK-VORLAUF GESCHEITERT — die Handelsschleifen "
        + "starten trotzdem. Schema-Migration, Admin-Anlage und Zwischenspeicher wurden "
        + "UEBERSPRUNGEN; sobald die Datenbank wieder antwortet, greifen die Zyklen erneut:", err);
      try {
        const { sendTelegram } = await import("./lib/telegram-notifications/telegram-sender");
        await sendTelegram(
          "⚠️ <b>Datenbank beim Start nicht erreichbar</b>\n\n"
          + "Schema-Migration und Zwischenspeicher wurden übersprungen. Die Handelsschleifen "
          + "laufen trotzdem an und finden die Datenbank beim nächsten Zyklus von selbst.\n\n"
          + `Grund: ${err instanceof Error ? err.message : String(err)}`
        );
      } catch { /* non-fatal */ }
    }

    try {
      // Killswitch-State aus Redis wiederherstellen (überlebt Deploys)
      try {
        const { restoreKillswitchFromRedis } = await import("./lib/killswitch");
        const ksRestored = await restoreKillswitchFromRedis();
        if (ksRestored) {
          console.log("[killswitch] 🔴 SYSTEM GESPERRT — Killswitch aus Redis wiederhergestellt. /reset erforderlich.");
        }
      } catch { /* non-fatal */ }

      // Auto-reconnect Capital.com with retry (P3 fix: timing issue on cold start)
      try {
        // Restore IC Markets session from Redis on startup
        const { restoreICMarketsSessionFromRedis, getICMarketsSession, autoReconnectICMarkets, keepAliveICMarkets } = await import("./lib/icmarkets/icmarkets-session");
        const icRestored = await restoreICMarketsSessionFromRedis();
        if (!icRestored) {
          // No session in Redis — try fresh connect using env token
          const r = await autoReconnectICMarkets();
          if (r.ok) console.log("[instrumentation] IC Markets auto-connected from env token");
          else console.warn(`[instrumentation] IC Markets auto-connect failed: ${r.error}`);
        }
        if (icRestored) {
          const icSess = getICMarketsSession();
          console.log(`[instrumentation] IC Markets session restored from Redis ⚡ balance: ${icSess?.currency} ${icSess?.balance}`);
          // Sync settings store so CONNECTED badge shows correctly after restart
          const { updateBrokerConnection } = await import("./lib/settings/settings-store");
          await updateBrokerConnection({
            brokerKey: "IC_MARKETS",
            connected: true,
            accountId: icSess?.accountId || "IC-MCP",
            accountMode: "DEMO",
            lastConnectedAt: icSess?.connectedAt ?? new Date().toISOString(),
            error: null,
          }).catch(() => {});
        }

        const { autoReconnectCapital, isCapitalConnected } = await import("./lib/capital-com/capital-com-session");
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        let r = await autoReconnectCapital();
        if (r.ok) {
          console.log("[instrumentation] Capital.com auto-reconnected");
        } else {
          console.error(`[instrumentation] Capital.com reconnect attempt 1 failed: ${r.error}`);
          // Retry after 5s — Capital.com API sometimes slow on cold start
          await new Promise((res) => setTimeout(res, 5000));
          r = await autoReconnectCapital();
          if (r.ok) console.log("[instrumentation] Capital.com auto-reconnected (retry)");
          else console.error(`[instrumentation] Capital.com auto-reconnect failed after retry: ${r.error}`);
        }
        // Keep-alive every 2min — pings Capital.com to prevent session expiry,
        // auto-reconnects if session expired or dropped
        const { keepAliveCapital } = await import("./lib/capital-com/capital-com-session");
        setInterval(() => keepAliveCapital().catch(() => {}), 2 * 60 * 1000);

        // IC Markets keep-alive every 2min — prevents MCP session expiry
        setInterval(() => keepAliveICMarkets().catch(() => {}), 2 * 60 * 1000);

        // Daily summary täglich um 20:00 Zürich-Zeit via node-cron
        try {
          const cron = await import("node-cron");
          cron.schedule("0 20 * * *", async () => {
            try {
              const now = new Date();
              const { getPrisma } = await import("./app/lib/prisma");
              const db = getPrisma();
              const today = now.toLocaleDateString("en-CA", { timeZone: "Europe/Zurich" });
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const rows = await (db.$queryRawUnsafe as any)(
                `SELECT result, "profitLoss" FROM "Trade"
                 WHERE status = 'CLOSED' AND DATE("updatedAt") = $1`, today
              ) as Array<{ result: string; profitLoss: number }>;
              if (rows.length > 0) {
                const wins = rows.filter((r) => r.result === "WIN").length;
                const losses = rows.filter((r) => r.result === "LOSS").length;
                const totalPnL = rows.reduce((s, r) => s + (r.profitLoss ?? 0), 0);
                const { notifyDailySummary } = await import("./lib/telegram-notifications/telegram-sender");
                await notifyDailySummary({ trades: rows.length, wins, losses, totalPnL, currency: "CHF", winRate: rows.length > 0 ? (wins / rows.length) * 100 : 0 });
              }
            } catch { /* non-fatal */ }
          }, { timezone: "Europe/Zurich" });
          console.log("[instrumentation] Daily summary cron: täglich 20:00 Zürich");
        } catch { /* non-fatal */ }

        // Position monitor every 2min — Capital.com + IC Markets parallel
        let positionMonitorRunning = false;
        setInterval(async () => {
          if (positionMonitorRunning) {
            console.warn("[position-monitor] Vorheriger Zyklus läuft noch — überspringe diesen Tick (Audit-Fund #2, 27.07.)");
            return;
          }
          // Killswitch-Sperre (28.07.): kein Positions-Management solange aktiv.
          // Offene Positionen bleiben bewusst offen (Broker-SL/TP schützen weiter).
          try {
            const { isKillswitchActive } = await import("./lib/killswitch");
            if (isKillswitchActive()) {
              console.warn("[position-monitor] 🔴 Killswitch aktiv — Zyklus übersprungen (/reset zum Entsperren)");
              return;
            }
          } catch { /* non-fatal — im Zweifel weiterlaufen wie bisher */ }
          positionMonitorRunning = true;
          try {
          console.log("[position-monitor] 2min Zyklus gestartet");

          // Capital.com: Journal-Sync — separat damit Fehler nicht trade-mgr blockieren
          try {
            const { syncCapitalPositionsToJournal } = await import("./lib/capital-com/capital-trade-tracker");
            await syncCapitalPositionsToJournal();
          } catch (e) {
            console.error("[position-monitor] syncCapitalPositionsToJournal Fehler:", e instanceof Error ? e.message : String(e));
          }

          // Capital.com: Active Trade Manager (BE/Trailing/Partial TP)
          try {
            const { runActiveTradeManager } = await import("./lib/capital-com/active-trade-manager");
            await runActiveTradeManager();
          } catch (e) {
            console.error("[position-monitor] runActiveTradeManager Fehler:", e instanceof Error ? e.message : String(e));
          }

          // Python lifecycle manager: BE/Trailing/Exit für alle registrierten Trades
          try {
            const { isPythonBackendConfigured, pyPriceUpdate, pyUpdateBalance,
                    pyLifecycleTrades, pyRegisterTrade } = await import("./lib/python-backend/python-client");
            if (isPythonBackendConfigured()) {
              const { isCapitalConnected, getCapitalSession } = await import("./lib/capital-com/capital-com-session");
              if (isCapitalConnected()) {
                const sess = getCapitalSession()!;
                await pyUpdateBalance(sess.balance);
                const { capitalGetPositions, capitalUpdatePosition, capitalClosePosition, capitalClosePartial } = await import("./lib/capital-com/capital-com-client");
                const { capitalGetPrices } = await import("./lib/capital-com/capital-com-client");
                const posResult = await capitalGetPositions(sess.apiKey, sess.cst, sess.securityToken).catch(() => null);
                const positions = posResult?.positions ?? [];
                console.log(`[py-lifecycle] ${positions.length} Positionen für Lifecycle-Update`);
                if (positions.length > 0) {
                  const symbols = [...new Set(positions.map((p: { symbol?: string; epic?: string }) => p.symbol ?? p.epic ?? "").filter(Boolean))];
                  const priceResult = await capitalGetPrices(sess.apiKey, sess.cst, sess.securityToken, symbols).catch(() => null);
                  const priceMap = new Map<string, number>();
                  for (const p of priceResult?.prices ?? []) {
                    if (p.symbol) priceMap.set(p.symbol, (p.bid + p.ask) / 2);
                  }

                  // Welche Positionen haben schon einen ECHTEN Teilgewinn
                  // hinter sich? (11.08.) Der RiskAgent lief in diesem Zyklus
                  // kurz zuvor und hat seinen Teilgewinn in Trade.notes
                  // vermerkt. Der Python-Lifecycle weiss davon nichts: sein
                  // partial_done liegt nur im Arbeitsspeicher, und sein
                  // trade.size stammt aus der REGISTRIERUNG und wird nie
                  // aktualisiert. Ohne diese Abfrage nimmt er ein zweites Mal
                  // Teilgewinn — mit einer Menge, die auf die inzwischen
                  // halbierte Position bezogen die ganze Restposition schliesst.
                  //
                  // partialSize > 0 verlangt, nicht nur partialDone: der
                  // RiskAgent setzt den Merker auch, wenn die Position zu klein
                  // zum Halbieren war und er NICHTS geschlossen hat. Dort soll
                  // der Python-Teilgewinn weiter greifen — er rechnet mit
                  // kleineren Stückelungen.
                  //
                  // Schlägt die Abfrage fehl, bleibt die Menge leer und der
                  // Riegel greift nicht. Das ist Absicht: der zweite Riegel
                  // unten (nie mehr schliessen als offen ist) fängt den teuren
                  // Fall ohnehin ab, und ein DB-Aussetzer soll keinen
                  // funktionierenden Teilgewinn abschalten.
                  // Das Auswerten selbst liegt in teilgewinnStand() im
                  // RiskAgent — als Funktion, damit der Prüfer `teilgewinn` sie
                  // WIRKLICH ausführen kann. Als Schleife hier war sie im
                  // Sabotage-Lauf abschaltbar, ohne dass etwas rot wurde.
                  let schonTeilgewonnen = new Set<string>();
                  // Stil und Confidence je dealId — gebraucht, um nach einem
                  // Neustart des Python-Dienstes nachregistrieren zu koennen
                  // (18.08.). Dieselben Zeilen, kein zweiter DB-Treffer.
                  let stammdaten = new Map<string, import("./lib/agents/risk-agent").LifecycleStammdaten>();
                  let befund: import("./lib/agents/risk-agent").NotizenBefund | null = null;
                  try {
                    const { getPrisma } = await import("./app/lib/prisma");
                    const { teilgewinnStand, stammdatenAusNotizen, notizenBefund } = await import("./lib/agents/risk-agent");
                    const db = getPrisma();
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const rows = await (db.$queryRawUnsafe as any)(
                      `SELECT notes FROM "Trade" WHERE status = 'OPEN' AND notes LIKE '%dealId%'`
                    ) as Array<{ notes: string }>;
                    schonTeilgewonnen = teilgewinnStand(rows);
                    stammdaten = stammdatenAusNotizen(rows);
                    befund = notizenBefund(rows);
                  } catch (e) {
                    // Die Meldung nennt BEIDE Folgen (19.08.). Seit die
                    // Stammdaten aus derselben Abfrage kommen, schaltet ein
                    // DB-Aussetzer auch das Nachregistrieren ab — die alte
                    // Fassung sprach nur vom Teilgewinn und fuehrte damit
                    // genau bei der Frage in die Irre, ob nachregistriert
                    // wurde.
                    console.warn("[py-lifecycle] Trade-Notizen nicht lesbar — dieser Zyklus OHNE "
                      + "Teilgewinn-Riegel und OHNE Nachregistrieren:",
                      e instanceof Error ? e.message : String(e));
                  }

                  // FEHLENDE TRADES NACHREICHEN (18.08.).
                  //
                  // `_trades` im Python-Lifecycle liegt nur im Arbeitsspeicher
                  // und wurde bisher AUSSCHLIESSLICH beim Eroeffnen gefuellt.
                  // Nach jedem Neustart des Dienstes — also nach jedem Deploy —
                  // kannte er die offenen Positionen nicht mehr und antwortete
                  // still mit action:null, waehrend die Zeile darueber weiter
                  // "N Positionen fuer Lifecycle-Update" meldete. Der Schutz
                  // blieb (der RiskAgent lief kurz zuvor und hat Breakeven,
                  // Teilgewinn, Trailing und Zeit-Exit selbst), aber die zweite
                  // Schicht fiel lautlos aus.
                  //
                  // Die Entscheidung liegt in nachzuregistrieren() im RiskAgent,
                  // NICHT hier als Schleife: eingebettet liesse sie sich nicht
                  // ausfuehren und damit nicht beweisen. Der Pruefer
                  // `lifecycle-rueckkehr` ruft genau diese Funktion auf.
                  try {
                    const { nachzuregistrieren } = await import("./lib/agents/risk-agent");
                    const bekannt = await pyLifecycleTrades();
                    if (bekannt === null) {
                      console.warn("[py-lifecycle] Trade-Liste nicht abrufbar — diesen Zyklus wird NICHT nachregistriert");
                    }
                    const fehlend = nachzuregistrieren(positions, bekannt, stammdaten);
                    // Eine Zeile je Zyklus mit dem ERGEBNIS der Pruefung
                    // (19.08.). Vorher wurde nur beim tatsaechlichen
                    // Nachregistrieren geloggt — "geprueft, nichts zu tun" war
                    // damit von "nie gelaufen" nicht zu unterscheiden, und
                    // genau das liess sich hinterher nicht mehr beantworten.
                    console.log(`[py-lifecycle] Python kennt ${bekannt ? bekannt.size : "?"} von `
                      + `${positions.length} Positionen, Stammdaten fuer ${stammdaten.size}, `
                      + `nachzureichen ${fehlend.length}`);
                    // Kommen keine Stammdaten zustande, obwohl etwas fehlt:
                    // sagen WORAN es liegt (19.08.). Ohne diese Zeile sahen
                    // "keine offenen Trades in der Datenbank" und "Feld fehlt
                    // in den Notizen" im Log voellig gleich aus. Nur Anzahlen,
                    // kein Notiz-Inhalt.
                    if (stammdaten.size === 0 && bekannt && bekannt.size < positions.length) {
                      console.warn("[py-lifecycle] KEINE Stammdaten — Notizen: "
                        + (befund
                          ? `${befund.zeilen} Zeilen, ${befund.lesbar} lesbar, `
                            + `${befund.mitDealId} mit dealId, ${befund.mitStil} mit Stil, `
                            + `${befund.mitConfidence} mit Confidence`
                          : "Abfrage fehlgeschlagen")
                        + ` | ${positions.length} offene Positionen beim Broker`);
                    }
                    for (const t of fehlend) {
                      const ok = await pyRegisterTrade(t);
                      if (ok) {
                        console.log(`[py-lifecycle] nachregistriert: ${t.symbol} ${t.direction} `
                          + `deal=${t.tradeId} stil=${t.tradingStyle} eroeffnet=${t.openedAt}`);
                      } else {
                        console.warn(`[py-lifecycle] Nachregistrieren fehlgeschlagen: ${t.symbol} deal=${t.tradeId}`);
                      }
                    }
                  } catch (e) {
                    console.warn("[py-lifecycle] Nachregistrieren uebersprungen:",
                      e instanceof Error ? e.message : String(e));
                  }

                  for (const pos of positions) {
                    const tradeId = pos.dealId;
                    if (!tradeId) continue;
                    const symbol = pos.symbol ?? pos.epic ?? "";
                    const currentPrice = priceMap.get(symbol);
                    if (!currentPrice) continue;
                    const action = await pyPriceUpdate(tradeId, currentPrice).catch(() => ({ action: null }));
                    if (!action || action.action === null) continue;
                    if (action.action === "UPDATE_SL" && action.new_sl) {
                      // Generalkontroll-Fund C (03.08.): ZWEI Systeme schreiben
                      // denselben Stop. Kurz zuvor lief in diesem Zyklus schon
                      // runActiveTradeManager() -> runRiskAgent(), der ebenfalls
                      // capitalUpdatePosition aufruft. Der Python-Lifecycle läuft
                      // DANACH und gewinnt damit immer. Sein eigener Schutz gegen
                      // Rückwärtsbewegung (trade_lifecycle_manager.py:241) vergleicht
                      // nur gegen die EIGENE Erinnerung, nicht gegen den echten
                      // Broker-Stop — er konnte einen bereits enger gezogenen Stop
                      // wieder lockern und damit Absicherung zurücknehmen.
                      //
                      // pos.stopLevel stammt aus capitalGetPositions() weiter oben,
                      // also NACH dem RiskAgent — es ist der echte, aktuelle Stop.
                      // Ein Stop darf sich ab jetzt nur noch in Richtung Gewinn
                      // bewegen, egal welches System ihn setzen will.
                      const liveSL = typeof pos.stopLevel === "number" && pos.stopLevel > 0 ? pos.stopLevel : null;
                      const isBuyPos = pos.direction === "BUY";
                      const istEnger = liveSL === null
                        || (isBuyPos ? action.new_sl > liveSL : action.new_sl < liveSL);
                      if (!istEnger) {
                        console.log(`[py-lifecycle] ${symbol}: SL ${action.new_sl} wäre lockerer als der bestehende ${liveSL} — nicht angewendet`);
                        continue;
                      }
                      // Take-Profit ausdrücklich mitgeben (03.08.). Vorher stand hier
                      // undefined; ob Capital.com einen fehlenden limitLevel als
                      // "unverändert" oder als "löschen" auffasst, ist nicht belegt.
                      // Mit dem echten Wert ist das Ergebnis in beiden Fällen gleich.
                      // Der RiskAgent macht es an seinen beiden Stellen genauso.
                      const liveTP = typeof pos.profitLevel === "number" && pos.profitLevel > 0 ? pos.profitLevel : undefined;
                      const r = await capitalUpdatePosition(sess.apiKey, sess.cst, sess.securityToken, tradeId, action.new_sl, liveTP)
                        .catch((e) => ({ ok: false, error: e instanceof Error ? e.message : String(e) }));
                      if (r.ok) {
                        console.log(`[py-lifecycle] SL updated: ${symbol} ${liveSL ?? "kein"} -> ${action.new_sl}`);
                        // Dem AI Manager mitteilen, dass hier ein zweites System
                        // eingegriffen hat (11.08.). Er entschied bisher ueber
                        // Positionen, deren Absicherung Python kurz zuvor
                        // veraendert hatte, ohne davon zu wissen.
                        try {
                          const { merkeFremdAktion } = await import("./lib/agents/risk-agent");
                          merkeFremdAktion(tradeId, `Python-Lifecycle zog den Stop auf ${action.new_sl}`);
                        } catch { /* non-fatal */ }
                      }
                      else console.error(`[py-lifecycle] ⚠ SL-Update FEHLGESCHLAGEN: ${symbol} -> ${action.new_sl} — ${r.error}`);
                    } else if (action.action === "CLOSE") {
                      const r = await capitalClosePosition(sess.apiKey, sess.cst, sess.securityToken, tradeId)
                        .catch((e) => ({ ok: false, error: e instanceof Error ? e.message : String(e) }));
                      if (r.ok) {
                        console.log(`[py-lifecycle] Zeit-Exit: ${symbol}`);
                        try {
                          const { merkeFremdAktion } = await import("./lib/agents/risk-agent");
                          merkeFremdAktion(tradeId, "Python-Lifecycle schloss die Position (Zeit-Exit)");
                        } catch { /* non-fatal */ }
                      }
                      else console.error(`[py-lifecycle] ⚠ Zeit-Exit FEHLGESCHLAGEN: ${symbol} — ${r.error}`);
                    } else if (action.action === "PARTIAL_CLOSE" && action.volume) {
                      // ZWEI Systeme nehmen Teilgewinn (Fund 11.08.). Kurz zuvor
                      // lief in diesem Zyklus runActiveTradeManager() ->
                      // runRiskAgent(), der ebenfalls capitalClosePartial ruft.
                      // Beide führen getrennte Merker, keiner kennt den anderen:
                      //   RiskAgent   partialDone in Trade.notes (überlebt Neustart)
                      //   Python      trade.partial_done nur im Arbeitsspeicher
                      // Schlimmer noch: trade.size im Python-Lifecycle stammt aus
                      // der REGISTRIERUNG und wird nie aktualisiert. Nach einem
                      // Teilgewinn des RiskAgent ist action.volume deshalb auf
                      // eine Grösse bezogen, die es nicht mehr gibt — und
                      // schliesst die ganze Restposition statt der Hälfte.
                      //
                      // Die Entscheidung liegt in teilgewinnErlaubt() im
                      // RiskAgent — als eigene Funktion, damit der Prüfer
                      // `teilgewinn` sie WIRKLICH ausführen kann. Eine
                      // eingebettete if-Kette hier wäre nur vorhanden, nicht
                      // bewiesen.
                      const { teilgewinnErlaubt, merkeTeilgewinn, merkeFremdAktion } = await import("./lib/agents/risk-agent");
                      const offen = typeof pos.size === "number" ? pos.size : 0;
                      const urteil = teilgewinnErlaubt(tradeId, action.volume, offen, schonTeilgewonnen);
                      if (!urteil.erlaubt) {
                        console.warn(`[py-lifecycle] ${symbol}: Teilgewinn nicht ausgeführt — ${urteil.grund}`);
                        continue;
                      }
                      const r = await capitalClosePartial(sess.apiKey, sess.cst, sess.securityToken, pos.epic ?? "", pos.direction, action.volume)
                        .catch((e) => ({ ok: false, error: e instanceof Error ? e.message : String(e) }));
                      if (r.ok) {
                        console.log(`[py-lifecycle] Partial TP: ${symbol} vol=${action.volume} von ${offen}`);
                        // In Trade.notes vermerken, sonst nimmt der RiskAgent im
                        // nächsten Zyklus seinerseits noch einen Teilgewinn —
                        // derselbe Fehler, nur andersherum.
                        try {
                          merkeTeilgewinn(tradeId, action.volume);
                          merkeFremdAktion(tradeId, `Python-Lifecycle nahm Teilgewinn ueber ${action.volume}`);
                        } catch (e) {
                          console.warn("[py-lifecycle] Teilgewinn nicht vermerkt:", e instanceof Error ? e.message : String(e));
                        }
                      } else {
                        console.error(`[py-lifecycle] ⚠ Partial TP FEHLGESCHLAGEN: ${symbol} vol=${action.volume} — ${r.error}`);
                      }
                    }
                  }
                }
              } else {
                console.log("[py-lifecycle] Capital nicht verbunden — skip");
              }
            }
          } catch (e) {
            console.error("[py-lifecycle] Fehler:", e instanceof Error ? e.message : String(e));
          }

          try {
            // IC Markets: journal sync + active trade manager (parallel)
            const { isICMarketsConnected } = await import("./lib/icmarkets/icmarkets-session");
            if (isICMarketsConnected()) {
              const [{ syncICMarketsJournal }, { runICMarketsTradeManager }] = await Promise.all([
                import("./lib/icmarkets/icmarkets-journal-sync"),
                import("./lib/icmarkets/icmarkets-trade-manager"),
              ]);
              await Promise.all([
                syncICMarketsJournal(),
                runICMarketsTradeManager(),
              ]);
            }
          } catch { /* non-fatal */ }
          } finally {
            positionMonitorRunning = false;
          }
        }, 2 * 60 * 1000);
      } catch { /* non-fatal */ }

      // ── DiagnosticsAgent — muss VOR allen anderen Agents starten ─────────────
      try {
        const { initDiagnosticsAgent } = await import("./lib/agents/diagnostics-agent");
        initDiagnosticsAgent();
        console.log("[instrumentation] DiagnosticsAgent gestartet");
      } catch { /* non-fatal */ }

      // ── OrchestratorAgent — koordiniert alle Agents jeden 5min ───────────────
      try {
        const { runOrchestratorCycle } = await import("./lib/agents/orchestrator-agent");
        let orchestratorRunning = false;
        setInterval(async () => {
          if (orchestratorRunning) {
            console.warn("[orchestrator] Vorheriger Zyklus läuft noch — überspringe diesen Tick (Audit-Fund #2, 27.07.)");
            return;
          }
          // Killswitch-Sperre (28.07.): keine neuen Trades solange aktiv.
          try {
            const { isKillswitchActive } = await import("./lib/killswitch");
            if (isKillswitchActive()) {
              console.warn("[orchestrator] 🔴 Killswitch aktiv — Zyklus übersprungen (/reset zum Entsperren)");
              return;
            }
          } catch { /* non-fatal — im Zweifel weiterlaufen wie bisher */ }
          orchestratorRunning = true;
          try {
            await runOrchestratorCycle();
          } catch (err) {
            console.error("[orchestrator] Zyklus-Fehler:", err instanceof Error ? err.message : String(err));
          } finally {
            orchestratorRunning = false;
          }
        }, 5 * 60_000);
        console.log("[instrumentation] OrchestratorAgent gestartet (every 5min)");
      } catch { /* non-fatal */ }

      // ── Claude Security Watchdog every 3min ────────────────────────────────
      try {
        const { runClaudeWatchdog } = await import("./lib/security-watchdog/claude-watchdog");
        setInterval(() => runClaudeWatchdog().catch(() => {}), 3 * 60 * 1000);
        console.log("[instrumentation] Claude Security Watchdog started (every 3min)");
      } catch { /* non-fatal */ }

      // ── Lernzyklus stündlich (24.08., Schritt 2) ──────────────────────────
      //
      // WOZU. runLearningCycle() liest seit dem 24.08. die ECHTEN
      // geschlossenen Trades statt der Papierhandels-Historie — aber NIEMAND
      // rief es auf. Es hing an zwei API-Routen, die von Hand angestossen
      // werden mussten. Eine Auswertung, die nur läuft, wenn jemand daran
      // denkt, ist keine Auswertung.
      //
      // STÜNDLICH, nicht öfter. Der Zyklus liest bei jedem Lauf ALLE
      // geschlossenen Trades neu (kein Index auf `status`, also ein voller
      // Durchgang). Geschlossene Trades entstehen ein paar Mal am Tag —
      // häufiger zu rechnen erzeugt Datenbanklast ohne neue Erkenntnis.
      //
      // ERSTER LAUF NACH 2 MINUTEN statt sofort: beim Start sind Datenbank
      // und Broker-Sitzung noch am Hochfahren. Ohne diese Wartezeit stünde im
      // Log direkt nach jedem Deploy ein Fehler, der keiner ist.
      //
      // WAS ER NICHT TUT: er ändert nichts am Handel. Der gelernte Faktor
      // wird bisher nur von strategy-evolution/evolution-engine.ts gelesen,
      // und das läuft in keiner Schleife. Dieser Zyklus SAMMELT die Messdaten,
      // mit denen sich später entscheiden lässt, ob das Lernsignal überhaupt
      // etwas taugt.
      try {
        const { runLearningCycle } = await import("./lib/learning/trade-feedback-engine");
        let lernzyklusLaeuft = false;
        const lernen = async () => {
          if (lernzyklusLaeuft) {
            console.warn("[learning] Vorheriger Zyklus läuft noch — überspringe diesen Tick");
            return;
          }
          // Killswitch respektiert (gleiche Regel wie alle anderen Schleifen).
          // Der Zyklus handelt zwar nicht, schreibt aber den Lernzustand — und
          // während eines Notaus ist die Lage kein guter Lehrmeister.
          try {
            const { isKillswitchActive } = await import("./lib/killswitch");
            if (isKillswitchActive()) {
              console.warn("[learning] 🔴 Killswitch aktiv — Lernzyklus übersprungen");
              return;
            }
          } catch { /* non-fatal — im Zweifel weiterlaufen wie bisher */ }
          lernzyklusLaeuft = true;
          try {
            const bericht = await runLearningCycle();
            console.log(
              `[learning] Zyklus fertig — Quelle "${bericht.quelle}", ` +
              `${bericht.totalTradesAnalyzed} Trades, Status ${bericht.status}, ` +
              `${Object.keys(bericht.symbolPerformance).length} Symbole`
            );
          } catch (err) {
            // Eine Ausnahme darf die Schleife nicht töten — sonst lernt das
            // System ab dem ersten Fehler nie wieder, ohne dass es auffällt.
            console.error(
              "[learning] Zyklus-Fehler:",
              err instanceof Error ? err.message : String(err)
            );
          } finally {
            lernzyklusLaeuft = false;
          }
        };
        setTimeout(lernen, 2 * 60 * 1000);
        setInterval(lernen, 60 * 60 * 1000);
        console.log("[instrumentation] Lernzyklus gestartet (stündlich, erster Lauf in 2min)");
      } catch { /* non-fatal */ }

    } catch (err) {
      console.error("[instrumentation] Setup error:", err);
    }
  }
}
