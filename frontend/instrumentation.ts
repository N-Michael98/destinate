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
        const { autoReconnectCapital } = await import("./lib/capital-com/capital-com-session");
        let reconnected = await autoReconnectCapital();
        if (reconnected) {
          console.log("[instrumentation] Capital.com auto-reconnected");
        } else {
          // Retry after 5s — Capital.com API sometimes slow on cold start
          await new Promise((r) => setTimeout(r, 5000));
          reconnected = await autoReconnectCapital();
          if (reconnected) console.log("[instrumentation] Capital.com auto-reconnected (retry)");
          else console.error("[instrumentation] Capital.com auto-reconnect failed after retry");
        }
      } catch { /* non-fatal */ }
    } catch (err) {
      console.error("[instrumentation] Setup error:", err);
    }
  }
}
