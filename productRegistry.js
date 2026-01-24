let PRODUCTS = [];
let WORD_INDEX = new Map();

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text) {
  return normalize(text).split(" ");
}

export function indexProducts(products) {
  PRODUCTS = products;
  WORD_INDEX.clear();

  for (const p of products) {
    const text = `${p.title} ${p.category || ""} ${p.description || ""}`;
    const words = tokenize(text);

    for (const w of words) {
      if (!WORD_INDEX.has(w)) WORD_INDEX.set(w, new Set());
      WORD_INDEX.get(w).add(p.id);
    }
  }

  console.log("🧠 Product registry indexed:", products.length);
}

export function findProductIdsFromText(query) {
  const q = normalize(query);
  const tokens = tokenize(q);

  const results = new Map(); // id -> score

  for (const [word, ids] of WORD_INDEX.entries()) {
    for (const token of tokens) {
      if (word.startsWith(token) || word.includes(token)) {
        for (const id of ids) {
          results.set(id, (results.get(id) || 0) + 1);
        }
      }
    }
  }

  return [...results.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);
}

export function findBestProductId(text) {
  const ids = findProductIdsFromText(text);
  return ids.length ? ids[0] : null;
}
