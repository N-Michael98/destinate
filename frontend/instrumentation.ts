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

      // Auto-reconnect Capital.com with retry (P3 fix: timing issue on cold start)
      try {
        // Restore IC Markets session from Redis on startup
        const { restoreICMarketsSessionFromRedis, getICMarketsSession } = await import("./lib/icmarkets/icmarkets-session");
        const icRestored = await restoreICMarketsSessionFromRedis();
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

        // Daily summary at 20:00 via Telegram
        setInterval(async () => {
          try {
            const now = new Date();
            if (now.getHours() === 20 && now.getMinutes() < 2) {
              const { getPrisma } = await import("./app/lib/prisma");
              const db = getPrisma();
              const today = now.toISOString().slice(0, 10);
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
            }
          } catch { /* non-fatal */ }
        }, 60 * 1000); // check every minute

        // Position monitor every 2min — Capital.com + IC Markets parallel
        setInterval(async () => {
          try {
            // Capital.com: sync journal + active trade manager
            const { syncCapitalPositionsToJournal } = await import("./lib/capital-com/capital-trade-tracker");
            await syncCapitalPositionsToJournal();
            const { runActiveTradeManager } = await import("./lib/capital-com/active-trade-manager");
            await runActiveTradeManager();
          } catch { /* non-fatal */ }

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

      // ── Server-side Auto-Scan + Auto-Execute every 60s ─────────────────────
      // Runs regardless of which page is open — no browser required
      try {
        setInterval(async () => {
          try {
            const { isCapitalConnected, getCapitalSession } = await import("./lib/capital-com/capital-com-session");
            const { getSettings } = await import("./lib/settings/settings-store");
            if (!isCapitalConnected()) return;
            const settings = await getSettings();
            if (settings.botSettings.mode !== "AUTO") return;

            const { capitalGetTopMarkets } = await import("./lib/capital-com/capital-com-client");
            const { analyzeMarkets } = await import("./lib/market-scanner/ai-analysis-engine");
            const { executeCapitalDemoOrder } = await import("./lib/capital-com/capital-com-execution");

            const session = getCapitalSession()!;
            const markets = await capitalGetTopMarkets(session.apiKey, session.cst, session.securityToken);
            if (!markets.ok || !markets.markets?.length) return;

            const opportunities = await analyzeMarkets(markets.markets);
            const threshold = settings.botSettings.autoApproveThreshold ?? 71;
            const styleLimit = settings.botSettings.maxTradesPerDayByStyle ?? { DAYTRADING: 3, SCALPING: 5, SWING: 2 };

            // Daily counter — load from Redis to survive restarts
            const today = new Date().toISOString().slice(0, 10);
            const { cacheGet: cGet, cacheSet: cSet } = await import("./lib/cache/redis-cache");
            const redisDailyKey = `daily_trades:${today}`;
            const redisDailyRaw = await cGet<{ count: number; byStyle: Record<string, number> }>(redisDailyKey);
            if (!global.__daily_trades__ || global.__daily_trades__.date !== today) {
              global.__daily_trades__ = { date: today, count: redisDailyRaw?.count ?? 0, byStyle: redisDailyRaw?.byStyle ?? {} };
            }
            const dailyCount = global.__daily_trades__.count;
            const tradeLimitEnabled = settings.botSettings.tradeLimitEnabled ?? true;
            const bypassScore = settings.botSettings.tradeLimitBypassScore ?? 80;
            const limitReached = dailyCount >= settings.botSettings.maxTradesPerDay;
            if (tradeLimitEnabled && limitReached) {
              console.log(`[auto-scan] Tageslimit ${dailyCount}/${settings.botSettings.maxTradesPerDay} — prüfe Bypass (Score ≥ ${bypassScore}%)`);
            }

            // Store scan results globally so scanner UI can display them without manual scan
            global.__last_scan_result__ = { opportunities, updatedAt: new Date().toISOString() };

            // Build candidate list — apply limit + bypass rule
            const candidates = opportunities.filter((o) => {
              if (!o.goSignal) return false;
              if (o.gpt.confidence < threshold) return false;
              // Per-style limit check
              const style = (o.gpt.tradingStyle ?? "DAYTRADING").toUpperCase();
              const styleMax = (styleLimit as Record<string, number>)[style] ?? 999;
              if ((global.__daily_trades__?.byStyle[style] ?? 0) >= styleMax) return false;
              // Daily limit check
              if (!tradeLimitEnabled) return true; // OFF = unlimited
              if (!limitReached) return true;       // Limit not yet reached
              // Limit reached — allow only if bypass score met
              return o.gpt.confidence >= bypassScore;
            });

            if (!candidates.length) return;

            for (const candidate of candidates) {
              const style = (candidate.gpt.tradingStyle ?? "DAYTRADING").toUpperCase() as "DAYTRADING" | "SCALPING" | "SWING";
              const result = await executeCapitalDemoOrder({
                symbol: candidate.symbol,
                direction: candidate.gpt.direction as "BUY" | "SELL",
                riskPercent: Math.min(candidate.claude.maxRiskPercent, settings.riskSettings.maxRiskPerTradePct),
                accountBalance: session.balance > 0 ? session.balance : 10000,
                stopLossPrice: candidate.gpt.stopLoss,
                takeProfitPrice: candidate.gpt.takeProfit,
                confidence: candidate.gpt.confidence,
                strategy: candidate.gpt.tradingStyle,
                tradingStyle: style,
              });

              if (result.ok) {
                global.__daily_trades__.count++;
                global.__daily_trades__.byStyle[style] = (global.__daily_trades__.byStyle[style] ?? 0) + 1;
                // Persist counter to Redis so restarts don't reset it
                await cSet(redisDailyKey, { count: global.__daily_trades__.count, byStyle: global.__daily_trades__.byStyle }, 90000);
                console.log(`[auto-scan] ✅ ${candidate.symbol} ${candidate.gpt.direction} (${style}) — Deal ${result.dealId}`);
                // Save to Trading Journal
                try {
                  const { saveCapitalTradeToJournal } = await import("./lib/capital-com/capital-trade-tracker");
                  await saveCapitalTradeToJournal({
                    dealId: result.dealId ?? "unknown",
                    symbol: candidate.symbol,
                    direction: candidate.gpt.direction as "BUY" | "SELL",
                    tradingStyle: style,
                    strategy: candidate.gpt.tradingStyle ?? style,
                    entry: result.openLevel ?? (candidate.gpt as { entryPrice?: number }).entryPrice ?? (candidate as { currentPrice?: number }).currentPrice ?? 0,
                    stopLoss: candidate.gpt.stopLoss ?? 0,
                    takeProfit: candidate.gpt.takeProfit ?? 0,
                    size: result.size,
                    accountBalance: session.balance > 0 ? session.balance : 10000,
                    riskPercent: settings.riskSettings.maxRiskPerTradePct,
                    confidence: candidate.gpt.confidence,
                  });
                } catch { /* non-fatal */ }
                break; // one trade per scan cycle
              } else {
                console.warn(`[auto-scan] ❌ ${candidate.symbol} failed: ${result.error} — trying next`);
              }
            }
          } catch (err) {
            console.warn("[auto-scan] error:", err);
          }
        }, 60_000);
        console.log("[instrumentation] Server-side auto-scan started (every 60s)");
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
