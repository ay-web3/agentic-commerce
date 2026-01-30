import fetch from "node-fetch";

export async function loadMemeCoins(limit = 300) {
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&category=meme-token&order=market_cap_desc&per_page=${limit}&page=1`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load meme coins");

  const data = await res.json();

  return data.map(c => c.id);
}
