-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Trade" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "market" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "entry" REAL NOT NULL,
    "stopLoss" REAL NOT NULL,
    "takeProfit" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "result" TEXT NOT NULL DEFAULT 'OPEN',
    "profitLoss" REAL NOT NULL DEFAULT 0,
    "accountSize" REAL NOT NULL DEFAULT 30000,
    "riskPercent" REAL NOT NULL DEFAULT 1,
    "riskAmount" REAL NOT NULL DEFAULT 300,
    "riskReward" REAL NOT NULL DEFAULT 0,
    "positionSize" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Trade" ("createdAt", "date", "direction", "entry", "id", "market", "notes", "profitLoss", "result", "status", "stopLoss", "takeProfit", "updatedAt") SELECT "createdAt", "date", "direction", "entry", "id", "market", "notes", "profitLoss", "result", "status", "stopLoss", "takeProfit", "updatedAt" FROM "Trade";
DROP TABLE "Trade";
ALTER TABLE "new_Trade" RENAME TO "Trade";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
