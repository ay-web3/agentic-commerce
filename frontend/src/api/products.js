const API_BASE = "https://super-invention-qvp46rrwg67cxjvj-3000.app.github.dev";

export async function searchProducts(query) {
  if (!query.trim()) return [];

  const res = await fetch(
    `${API_BASE}/search-product?q=${encodeURIComponent(query)}`
  );

  const data = await res.json();
  return data.ids || [];
}
