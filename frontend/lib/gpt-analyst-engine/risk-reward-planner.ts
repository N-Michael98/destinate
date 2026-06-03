export function buildTargets(
  price: number,
  bias: string
) {
  if (bias === "BULLISH") {
    return {
      stopLoss: Number(
        (price * 0.99).toFixed(2)
      ),

      takeProfit1: Number(
        (price * 1.02).toFixed(2)
      ),

      takeProfit2: Number(
        (price * 1.04).toFixed(2)
      ),
    };
  }

  return {
    stopLoss: Number(
      (price * 1.01).toFixed(2)
    ),

    takeProfit1: Number(
      (price * 0.98).toFixed(2)
    ),

    takeProfit2: Number(
      (price * 0.96).toFixed(2)
    ),
  };
}