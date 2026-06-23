/**
 * Rate Limiter — bottleneck
 * Schützt Capital.com + IC Markets API vor Rate-Limit Errors
 */

import Bottleneck from "bottleneck";

// Capital.com: max 10 req/sec
export const capitalLimiter = new Bottleneck({
  maxConcurrent: 3,
  minTime: 120, // 120ms zwischen Requests = ~8 req/sec
});

// IC Markets MCP: konservativer
export const icMarketsLimiter = new Bottleneck({
  maxConcurrent: 2,
  minTime: 250,
});

// Generic limiter für externe APIs (yfinance, news etc.)
export const genericLimiter = new Bottleneck({
  maxConcurrent: 5,
  minTime: 200,
});

// Wrapper: führt fn() rate-limited aus
export async function withCapitalLimit<T>(fn: () => Promise<T>): Promise<T> {
  return capitalLimiter.schedule(fn);
}

export async function withICMarketsLimit<T>(fn: () => Promise<T>): Promise<T> {
  return icMarketsLimiter.schedule(fn);
}
