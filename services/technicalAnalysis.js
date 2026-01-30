export function calculateSupportResistance(prices) {
  const values = prices.map(p => p[1]).sort((a, b) => a - b);

  const support = values[Math.floor(values.length * 0.2)];
  const resistance = values[Math.floor(values.length * 0.8)];

  return { support, resistance };
}

export function detectTrend(prices) {
  const first = prices[0][1];
  const last = prices[prices.length - 1][1];

  if (last > first * 1.03) return "uptrend";
  if (last < first * 0.97) return "downtrend";
  return "sideways";
}
