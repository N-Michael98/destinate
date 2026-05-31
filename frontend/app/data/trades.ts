export type Trade = {
  id: number;
  date: string;
  market: string;
  direction: "LONG" | "SHORT";
  entry: number;
  stopLoss: number;
  takeProfit: number;
  status: "OPEN" | "CLOSED";
  result: "WIN" | "LOSS" | "OPEN";
  profitLoss: number;
};

export const trades: Trade[] = [
  {
    id: 1,
    date: "2026-05-20",
    market: "Gold",
    direction: "LONG",
    entry: 3345,
    stopLoss: 3330,
    takeProfit: 3380,
    status: "CLOSED",
    result: "WIN",
    profitLoss: 350,
  },
  {
    id: 2,
    date: "2026-05-22",
    market: "WTI Crude Oil",
    direction: "LONG",
    entry: 58.2,
    stopLoss: 57.4,
    takeProfit: 60.1,
    status: "OPEN",
    result: "OPEN",
    profitLoss: 0,
  },
  {
    id: 3,
    date: "2026-05-25",
    market: "NAS100",
    direction: "LONG",
    entry: 21250,
    stopLoss: 21120,
    takeProfit: 21500,
    status: "CLOSED",
    result: "LOSS",
    profitLoss: -180,
  },
  {
    id: 4,
    date: "2026-05-28",
    market: "Gold",
    direction: "SHORT",
    entry: 3345,
    stopLoss: 3365,
    takeProfit: 3290,
    status: "CLOSED",
    result: "WIN",
    profitLoss: 420,
  },
];