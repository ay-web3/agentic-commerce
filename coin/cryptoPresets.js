import fetch from "node-fetch";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

function cgFetch(url) {
  return fetch(url, {
    headers: {
      "x-cg-demo-api-key": process.env.COINGECKO_API_KEY
    }
  });
}

export async function getTopCoins(limit = 100) {
  const url = `${COINGECKO_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=false`;

  const res = await cgFetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error("Failed to fetch top coins: " + text);
  }

  const data = await res.json();

  return data.map(c => ({
    id: c.id,
    symbol: c.symbol,
    name: c.name,
    price: c.current_price,
    marketCap: c.market_cap,
    change24h: c.price_change_percentage_24h
  }));
}

export async function getMemeCoins(limit = 300) {
  const url = `${COINGECKO_BASE}/coins/markets?vs_currency=usd&order=volume_desc&per_page=250&page=1&sparkline=false`;

  const res = await cgFetch(url);
  if (!res.ok) throw new Error("Failed to fetch meme coins");

  const data = await res.json();

  const keywords = [
    "dog","inu","shib","pepe","elon","meme","cat","floki","baby","frog","wojak","bonk"
  ];

  const memeCoins = data.filter(c =>
    keywords.some(k =>
      c.name.toLowerCase().includes(k) ||
      c.symbol.toLowerCase().includes(k)
    )
  );

  return memeCoins.slice(0, limit).map(c => ({
    id: c.id,
    symbol: c.symbol,
    name: c.name,
    price: c.current_price,
    marketCap: c.market_cap,
    change24h: c.price_change_percentage_24h
  }));
}

export async function getUserCustomCoins(userCoins = []) {
  if (!userCoins.length) return [];

  const ids = userCoins.join(",");
  const url = `${COINGECKO_BASE}/coins/markets?vs_currency=usd&ids=${ids}&sparkline=false`;

  const res = await cgFetch(url);
  if (!res.ok) throw new Error("Failed to fetch user coins");

  const data = await res.json();

  return data.map(c => ({
    id: c.id,
    symbol: c.symbol,
    name: c.name,
    price: c.current_price,
    marketCap: c.market_cap,
    change24h: c.price_change_percentage_24h
  }));
}

export async function resolvePreset({ preset, userCoins = [], limit = 100 }) {
  switch (preset) {
    case "coins":
      return { preset: "coins", coins: await getTopCoins(limit) };

    case "meme_coins":
      return { preset: "meme_coins", coins: await getMemeCoins(300) };

    case "user_custom":
      return { preset: "user_custom", coins: await getUserCustomCoins(userCoins) };

    default:
      throw new Error("Invalid preset");
  }
}
