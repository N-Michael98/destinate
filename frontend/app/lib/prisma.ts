// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require("@prisma/client");
type PrismaClient = InstanceType<typeof PrismaClient>;

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient();
}

export function getPrisma(): PrismaClient {
  if (process.env.NODE_ENV === "production") {
    return createPrismaClient();
  }
  if (!global.__prisma) {
    global.__prisma = createPrismaClient();
  }
  return global.__prisma;
}

// Lazy proxy — does NOT connect at import time
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return getPrisma()[prop as keyof PrismaClient];
  },
});
