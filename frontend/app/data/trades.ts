export type Trade = {
  id: number;
  market: string;
  direction: "LONG" | "SHORT";
  entry: number;
  stopLoss: number;
  takeProfit: number;
  status: "OPEN" | "CLOSED";
};

export const trades: Trade[] = [
  {
    id: 1,
    market: "Gold",
    direction: "LONG",
    entry: 3345,
    stopLoss: 3330,
    takeProfit: 3380,
    status: "OPEN",
  },

  {
    id: 2,
    market: "WTI Crude Oil",
    direction: "LONG",
    entry: 58.2,
    stopLoss: 57.4,
    takeProfit: 60.1,
    status: "OPEN",
  },
];