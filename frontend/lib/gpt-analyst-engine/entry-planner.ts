export function buildEntryZone(
  price: number
) {
  return {
    entryLow: Number(
      (price * 0.998).toFixed(2)
    ),

    entryHigh: Number(
      (price * 1.002).toFixed(2)
    ),
  };
}