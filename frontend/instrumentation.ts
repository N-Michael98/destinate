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
          try {
            // Capital.com: sync journal + active trade manager
            const { syncCapitalPositionsToJournal } = await import("./lib/capital-com/capital-trade-tracker");
            await syncCapitalPositionsToJournal();
            const { runActiveTradeManager } = await import("./lib/capital-com/active-trade-manager");
            await runActiveTradeManager();
          } catch { /* non-fatal */ }

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
                      console.log(`[py-lifecycle] ✅ SL updated: ${symbol} → ${action.new_sl}`);
                    } else if (action.action === "CLOSE") {
                      await capitalClosePosition(sess.apiKey, sess.cst, sess.securityToken, tradeId).catch(() => {});
                      console.log(`[py-lifecycle] ⏰ Zeit-Exit: ${symbol}`);
                    } else if (action.action === "PARTIAL_CLOSE" && action.volume) {
                      await capitalClosePartial(sess.apiKey, sess.cst, sess.securityToken, pos.epic ?? "", pos.direction, action.volume).catch(() => {});
                      console.log(`[py-lifecycle] 💰 Partial TP: ${symbol} vol=${action.volume}`);
                    }
                  }
                }
              }
            }
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
            const maxConcurrent = settings.botSettings.maxConcurrentPositions ?? 3;

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
            const maxTradesPerDay = settings.botSettings.maxTradesPerDay ?? 5;

            // ── Concurrent positions check (echte Positionen von Capital.com) ───
            const { capitalGetPositions } = await import("./lib/capital-com/capital-com-client");
            const posResult = await capitalGetPositions(session.apiKey, session.cst, session.securityToken).catch(() => null);
            const openPositions = posResult?.positions ?? [];
            const openCount = openPositions.length;
            if (openCount >= maxConcurrent) {
              console.log(`[auto-scan] Max concurrent positions erreicht (${openCount}/${maxConcurrent}) — skip`);
              return;
            }

            // ── Bereits offene Symbole — kein Duplicate-Trade ──────────────────
            const openSymbols = new Set<string>(
              openPositions.map((p: { symbol?: string; epic?: string }) =>
                (p.symbol ?? p.epic ?? "").toUpperCase()
              ).filter(Boolean)
            );

            // ── Daily limit check ───────────────────────────────────────────────
            const limitReached = tradeLimitEnabled && dailyCount >= maxTradesPerDay;
            if (limitReached) {
              console.log(`[auto-scan] Tageslimit erreicht (${dailyCount}/${maxTradesPerDay}) — kein weiterer Trade`);
              return;
            }

            // Store scan results globally so scanner UI can display them without manual scan
            global.__last_scan_result__ = { opportunities, updatedAt: new Date().toISOString() };

            // Build candidate list — apply confidence + per-style limits + kein Duplicate-Symbol
            const candidates = opportunities.filter((o) => {
              if (!o.goSignal) return false;
              if (o.gpt.confidence < threshold) return false;
              // Kein zweiter Trade auf dasselbe Symbol das bereits offen ist
              const sym = (o.symbol ?? "").toUpperCase();
              if (openSymbols.has(sym)) {
                console.log(`[auto-scan] ⛔ ${sym} bereits offen — kein Duplicate-Trade`);
                return false;
              }
              // Per-style limit check
              const style = (o.gpt.tradingStyle ?? "DAYTRADING").toUpperCase();
              const styleMax = (styleLimit as Record<string, number>)[style] ?? 999;
              if ((global.__daily_trades__?.byStyle[style] ?? 0) >= styleMax) return false;
              return true;
            });

            if (!candidates.length) return;

            for (const candidate of candidates) {
              const style = (candidate.gpt.tradingStyle ?? "DAYTRADING").toUpperCase() as "DAYTRADING" | "SCALPING" | "SWING";
              const riskPct = Math.min(candidate.claude.maxRiskPercent, settings.riskSettings.maxRiskPerTradePct);

              const orderParams = {
                symbol: candidate.symbol,
                direction: candidate.gpt.direction as "BUY" | "SELL",
                riskPercent: riskPct,
                accountBalance: session.balance > 0 ? session.balance : 10000,
                stopLossPrice: candidate.gpt.stopLoss > 0 ? candidate.gpt.stopLoss : undefined,
                takeProfitPrice: candidate.gpt.takeProfit > 0 ? candidate.gpt.takeProfit : undefined,
                confidence: candidate.gpt.confidence,
                strategy: candidate.gpt.tradingStyle,
                tradingStyle: style,
              };

              // Execute on Capital.com + IC Markets in parallel
              const { executeICMarketsOrder } = await import("./lib/icmarkets/icmarkets-execution");
              const { isICMarketsConnected: icConnected, getICMarketsSession: icSess } = await import("./lib/icmarkets/icmarkets-session");
              const icSession = icSess();
              const [result, icResult] = await Promise.all([
                executeCapitalDemoOrder(orderParams),
                icConnected() ? executeICMarketsOrder({
                  ...orderParams,
                  accountBalance: icSession?.balance ?? orderParams.accountBalance,
                }) : Promise.resolve(null),
              ]);

              if (result.ok) {
                global.__daily_trades__.count++;
                global.__daily_trades__.byStyle[style] = (global.__daily_trades__.byStyle[style] ?? 0) + 1;
                // Persist counter to Redis so restarts don't reset it
                await cSet(redisDailyKey, { count: global.__daily_trades__.count, byStyle: global.__daily_trades__.byStyle }, 90000);
                const icLog = icResult ? (icResult.ok ? `IC:✅${icResult.positionId}` : `IC:❌${icResult.error?.slice(0, 60)}`) : "IC:not connected";
                console.log(`[auto-scan] ✅ ${candidate.symbol} ${candidate.gpt.direction} (${style}) — Deal ${result.dealId} | ${icLog}`);
                // Telegram notification
                try {
                  const { notifyTradeExecuted } = await import("./lib/telegram-notifications/telegram-sender");
                  const brokerLabel = icResult?.ok ? "Capital.com + IC Markets" : "Capital.com";
                  await notifyTradeExecuted({
                    symbol: candidate.symbol,
                    direction: candidate.gpt.direction as "BUY" | "SELL",
                    size: result.size ?? 0,
                    entry: result.openLevel ?? 0,
                    stopLoss: candidate.gpt.stopLoss ?? 0,
                    takeProfit: candidate.gpt.takeProfit ?? 0,
                    confidence: candidate.gpt.confidence,
                    broker: brokerLabel,
                    dealId: result.dealId,
                  });
                } catch { /* non-fatal */ }
                // Register trade with Python lifecycle manager
                try {
                  const { pyRegisterTrade, pyUpdateBalance } = await import("./lib/python-backend/python-client");
                  await pyUpdateBalance(session.balance);
                  if (!result.dealId) throw new Error("no dealId");
                  await pyRegisterTrade({
                    tradeId:     result.dealId,
                    symbol:      candidate.symbol,
                    direction:   candidate.gpt.direction as "BUY" | "SELL",
                    entry:       result.openLevel ?? 0,
                    stopLoss:    candidate.gpt.stopLoss ?? 0,
                    takeProfit:  candidate.gpt.takeProfit ?? 0,
                    size:        result.size ?? 0,
                    confidence:  candidate.gpt.confidence,
                    tradingStyle: style,
                    broker:      "Capital.com",
                    openedAt:    new Date().toISOString(),
                  });
                } catch { /* non-fatal */ }
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
