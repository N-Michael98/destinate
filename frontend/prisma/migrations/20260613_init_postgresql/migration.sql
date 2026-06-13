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
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

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
);

CREATE INDEX IF NOT EXISTS "Trade_userId_idx" ON "Trade"("userId");
CREATE INDEX IF NOT EXISTS "Trade_market_idx" ON "Trade"("market");
CREATE INDEX IF NOT EXISTS "Trade_createdAt_idx" ON "Trade"("createdAt");

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
);

CREATE INDEX IF NOT EXISTS "PaperOrder_userId_idx" ON "PaperOrder"("userId");
CREATE INDEX IF NOT EXISTS "PaperOrder_broker_idx" ON "PaperOrder"("broker");

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
);

CREATE INDEX IF NOT EXISTS "LearningSnapshot_symbol_idx" ON "LearningSnapshot"("symbol");
CREATE INDEX IF NOT EXISTS "LearningSnapshot_createdAt_idx" ON "LearningSnapshot"("createdAt");

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
);

CREATE INDEX IF NOT EXISTS "BacktestRun_symbol_strategy_idx" ON "BacktestRun"("symbol", "strategy");

-- Prisma migrations table
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id" VARCHAR(36) NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "finished_at" TIMESTAMPTZ,
    "migration_name" VARCHAR(255) NOT NULL,
    "logs" TEXT,
    "rolled_back_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id")
);
