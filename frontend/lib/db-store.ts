// Universal key-value DB store — replaces all JSON file stores
// Uses AppStorage table: (key TEXT PK, data TEXT, updatedAt TIMESTAMP)

async function getDb() {
  const { getPrisma } = await import("../app/lib/prisma");
  return getPrisma();
}

export async function dbGet<T>(key: string, fallback: T): Promise<T> {
  try {
    const db = await getDb();
    const rows = await db.$queryRaw<{ data: string }[]>`
      SELECT data FROM "AppStorage" WHERE key = ${key} LIMIT 1
    `;
    if (rows && rows.length > 0) return JSON.parse(rows[0].data) as T;
  } catch { /* DB not ready */ }
  return fallback;
}

export async function dbSet(key: string, value: unknown): Promise<void> {
  try {
    const db = await getDb();
    const data = JSON.stringify(value);
    await db.$executeRawUnsafe(
      `INSERT INTO "AppStorage" (key, data, "updatedAt") VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET data = $2, "updatedAt" = NOW()`,
      key,
      data
    );
  } catch { /* non-fatal */ }
}

export async function dbDelete(key: string): Promise<void> {
  try {
    const db = await getDb();
    await db.$executeRawUnsafe(`DELETE FROM "AppStorage" WHERE key = $1`, key);
  } catch { /* non-fatal */ }
}
