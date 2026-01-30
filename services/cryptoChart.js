import fetch from "node-fetch";

const BASE = "https://api.coingecko.com/api/v3";

function cgFetch(url) {
  return fetch(url, {
    headers: {
      "x-cg-demo-api-key": process.env.COINGECKO_API_KEY
    }
  });
}

/* ============================
   Helpers
============================ */

function groupByHour(candles, volumes) {
  const map = {};

  candles.forEach(c => {
    const hour = Math.floor(c.x / 3600000) * 3600000;
    if (!map[hour]) map[hour] = { ...c, x: hour, v: 0 };
    else map[hour].c = c.c;
  });

  volumes.forEach(([ts, vol]) => {
    const hour = Math.floor(ts / 3600000) * 3600000;
    if (map[hour]) map[hour].v += vol;
  });

  return Object.values(map);
}

/* ============================
   Main candles endpoint
============================ */

export async function getMarketCandles(coinId, tf) {
  let days = 7;

if (tf === "1h") days = 14;     // 7 days of hourly data
if (tf === "1d") days = 180;   // 6 months
if (tf === "7d") days = 365;   // 1 year;

  // Fetch candles
  const ohlcUrl = `${BASE}/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`;
  const ohlcRes = await cgFetch(ohlcUrl);
  if (!ohlcRes.ok) throw new Error("Failed to fetch OHLC");

  const rawCandles = await ohlcRes.json();

  const candles = rawCandles.map(c => ({
    x: c[0],
    o: c[1],
    h: c[2],
    l: c[3],
    c: c[4]
  }));

  // Fetch volume
  const volUrl = `${BASE}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`;
  const volRes = await cgFetch(volUrl);
  if (!volRes.ok) throw new Error("Failed to fetch volume");

  const volData = await volRes.json();
  const volumes = volData.total_volumes;

  if (tf === "1h") {
    return groupByHour(candles, volumes);
  }

  // attach volume directly for 1d / 7d
  return candles.map((c, i) => ({
    ...c,
    v: volumes[i]?.[1] || 0
  }));
}


/* ============================
   Line chart data (AI analysis)
============================ */

export async function getMarketChart(coinId, days = 7) {
  const url = `${BASE}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`;
  const res = await cgFetch(url);
  if (!res.ok) throw new Error("Failed to fetch market chart");

  const data = await res.json();
  return data.prices;
}
