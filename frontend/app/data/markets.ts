export const markets = [
  {
    name: "WTI Crude Oil",
    category: "Commodities",
    direction: "BUY",
    score: 92,
    confidence: 94,
    trend: "Bullish",
    timeframe: "H4",
    risk: "Medium",
    riskReward: "1:2.4",
    aiRating: "Strong Buy",
    newsImpact: "Medium",
    entry: "58.20",
    stopLoss: "57.40",
    takeProfit: "60.10",

    analysis: [
      "Bullisher Trend auf H4",
      "Starke Nachfragezone",
      "Momentum zeigt nach oben",
      "AI bestätigt Long Setup",
    ],

    news: [
      "Ölnachfrage steigt",
      "Angebotsrisiken unterstützen Preise",
    ],
  },

  {
    name: "Gold",
    category: "Commodities",
    direction: "SELL",
    score: 85,
    confidence: 91,
    trend: "Bearish",
    timeframe: "H4",
    risk: "Low",
    riskReward: "1:2.8",
    aiRating: "Strong Sell",
    newsImpact: "Low",
    entry: "3345",
    stopLoss: "3365",
    takeProfit: "3290",

    analysis: [
      "Bearisher Trend",
      "Negative Marktstruktur",
      "Momentum zeigt nach unten",
      "AI bestätigt Verkauf",
    ],

    news: [
      "USD aktuell stark",
      "Gold unter Verkaufsdruck",
    ],
  },

  {
    name: "NAS100",
    category: "Indices",
    direction: "BUY",
    score: 88,
    confidence: 89,
    trend: "Bullish",
    timeframe: "H1 / H4",
    risk: "Medium",
    riskReward: "1:2.0",
    aiRating: "Buy",
    newsImpact: "Medium",
    entry: "21250",
    stopLoss: "21120",
    takeProfit: "21500",

    analysis: [
      "Bullisher Trend",
      "Technologiesektor stark",
      "Momentum positiv",
      "AI erkennt Kaufchance",
    ],

    news: [
      "Positive Tech-Stimmung",
      "Starke US-Unternehmenszahlen",
    ],
  },

  {
    name: "EURUSD",
    category: "Forex",
    direction: "NEUTRAL",
    score: 61,
    confidence: 64,
    trend: "Sideways",
    timeframe: "H4",
    risk: "High",
    riskReward: "-",
    aiRating: "Wait",
    newsImpact: "High",
    entry: "-",
    stopLoss: "-",
    takeProfit: "-",

    analysis: [
      "Keine klare Trendrichtung",
      "Seitwärtsphase",
      "Momentum neutral",
      "Abwarten empfohlen",
    ],

    news: [
      "Wichtige Zentralbankdaten erwartet",
      "Hohe Volatilität möglich",
    ],
  },
];