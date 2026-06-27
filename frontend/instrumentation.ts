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
        setInterval(async () => {
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
            const { isPythonBackendConfigured, pyPriceUpdate, pyUpdateBalance } = await import("./lib/python-backend/python-client");
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
                  for (const pos of positions) {
                    const tradeId = pos.dealId;
                    if (!tradeId) continue;
                    const symbol = pos.symbol ?? pos.epic ?? "";
                    const currentPrice = priceMap.get(symbol);
                    if (!currentPrice) continue;
                    const action = await pyPriceUpdate(tradeId, currentPrice).catch(() => ({ action: null }));
                    if (!action || action.action === null) continue;
                    if (action.action === "UPDATE_SL" && action.new_sl) {
                      await capitalUpdatePosition(sess.apiKey, sess.cst, sess.securityToken, tradeId, action.new_sl, undefined).catch(() => {});
                      console.log(`[py-lifecycle] SL updated: ${symbol} -> ${action.new_sl}`);
                    } else if (action.action === "CLOSE") {
                      await capitalClosePosition(sess.apiKey, sess.cst, sess.securityToken, tradeId).catch(() => {});
                      console.log(`[py-lifecycle] Zeit-Exit: ${symbol}`);
                    } else if (action.action === "PARTIAL_CLOSE" && action.volume) {
                      await capitalClosePartial(sess.apiKey, sess.cst, sess.securityToken, pos.epic ?? "", pos.direction, action.volume).catch(() => {});
                      console.log(`[py-lifecycle] Partial TP: ${symbol} vol=${action.volume}`);
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
        setInterval(() => runOrchestratorCycle().catch(err =>
          console.error("[orchestrator] Zyklus-Fehler:", err instanceof Error ? err.message : String(err))
        ), 5 * 60_000);
        console.log("[instrumentation] OrchestratorAgent gestartet (every 5min)");
      } catch { /* non-fatal */ }

      // ── Claude Security Watchdog every 3min ────────────────────────────────
      try {
        const { runClaudeWatchdog } = await import("./lib/security-watchdog/claude-watchdog");
        setInterval(() => runClaudeWatchdog().catch(() => {}), 3 * 60 * 1000);
        console.log("[instrumentation] Claude Security Watchdog started (every 3min)");
      } catch { /* non-fatal */ }

    } catch (err) {
      console.error("[instrumentation] Setup error:", err);
    }
  }
}
