/**
 * IC Markets session state — mirrors capital-com-session pattern.
 */

interface ICMarketsSession {
  accountId: string;
  balance: number;
  equity: number;
  currency: string;
  connectedAt: string;
  leverage: number; // 400, 500, or 1000
}

let session: ICMarketsSession | null = null;

export function getICMarketsSession(): ICMarketsSession | null {
  return session;
}

export function setICMarketsSession(s: ICMarketsSession): void {
  session = s;
}

export function clearICMarketsSession(): void {
  session = null;
}

export function isICMarketsConnected(): boolean {
  return session !== null;
}
