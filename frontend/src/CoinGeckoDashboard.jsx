import { useEffect, useState } from "react";
import CryptoChart from "./components/CryptoChart";

const API_BASE = "https://super-invention-qvp46rrwg67cxjvj-3000.app.github.dev";

export default function CoinGeckoDashboard({ userAddress }) {
  const [coins, setCoins] = useState([]);
  const [allCoins, setAllCoins] = useState([]);
  const [selectedCoin, setSelectedCoin] = useState(null);

  const [preset, setPreset] = useState("coins");
  const [mode, setMode] = useState("general");
  const [customQuery, setCustomQuery] = useState("");

  const [searchText, setSearchText] = useState("");
  const [suggestions, setSuggestions] = useState([]);

  const [portfolio, setPortfolio] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);

  /* ======================
     Load preset coins
  ====================== */

  async function loadMarket() {
    try {
      const res = await fetch(`${API_BASE}/crypto/preset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preset,
          userCoins: portfolio.map(c => c.id)
        })
      });

      const data = await res.json();
      setCoins(Array.isArray(data.coins) ? data.coins : []);
    } catch (err) {
      console.error("Failed to load coins:", err);
      setCoins([]);
    }
  }

  useEffect(() => {
    loadMarket();
    setSelectedCoin(null);
    setSearchText("");
    setSuggestions([]);
  }, [preset]);

  /* ======================
     Load all coins once (custom)
  ====================== */

  async function loadAllCoins() {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false"
    );
    const data = await res.json();

    setAllCoins(
      data.map(c => ({
        id: c.id,
        name: c.name,
        symbol: c.symbol,
        price: c.current_price
      }))
    );
  }

  useEffect(() => {
    loadAllCoins();
  }, []);

  /* ======================
     Search logic
  ====================== */

  function handleSearch(q) {
    setSearchText(q);

    if (q.length < 2) {
      setSuggestions([]);
      return;
    }

    let source = coins;

    if (preset === "coins") source = coins.slice(0, 22);
    if (preset === "meme_coins") source = coins;
    if (preset === "user_custom") source = allCoins;

    const filtered = source
      .filter(
        c =>
          c.name.toLowerCase().includes(q.toLowerCase()) ||
          c.symbol.toLowerCase().includes(q.toLowerCase())
      )
      .slice(0, 8);

    setSuggestions(filtered);
  }

  function selectCoin(coin) {
    setSelectedCoin(coin);
    setSearchText(`${coin.name} (${coin.symbol.toUpperCase()})`);
    setSuggestions([]);

    if (preset === "user_custom") {
      if (!portfolio.find(p => p.id === coin.id)) {
        setPortfolio(prev => [...prev, coin]);
      }
    }
  }

  /* ======================
     AI Analysis
  ====================== */

  async function analyze() {
    if (!selectedCoin && mode !== "portfolio") {
      alert("Select a coin first");
      return;
    }

    setLoading(true);
    setAnalysis(null);

    try {
      const res = await fetch(`${API_BASE}/ai/crypto-analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userAddress,
          coinId: selectedCoin?.id || null,
          mode,
          preset,
          customQuery,
          portfolio: portfolio.map(c => c.id)
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setAnalysis(data.analysis);
    } catch (err) {
      alert("AI request failed");
      console.error(err);
    }

    setLoading(false);
  }

  /* ======================
     UI
  ====================== */

  return (
  <div style={{ marginTop: 40 }}>

    {/* ===== Top Bar ===== */}
    <div
      className="glass-card"
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 12
      }}
    >
      <h3 style={{ margin: 0 }}>📊 Crypto AI</h3>

      <div style={{ display: "flex", gap: 10 }}>
        <select value={preset} onChange={e => setPreset(e.target.value)}>
          <option value="coins">Top Coins</option>
          <option value="meme_coins">Meme Coins</option>
          <option value="user_custom">Custom</option>
        </select>

        <select value={mode} onChange={e => setMode(e.target.value)}>
          <option value="general">General</option>
          <option value="volatility">Volatility</option>
          <option value="crash">Crash</option>
          <option value="longterm">Long term</option>
          <option value="meme">Meme</option>
          <option value="portfolio">Portfolio</option>
          <option value="debate">Debate</option>
          <option value="backtest">Backtest</option>
          <option value="custom">Custom</option>
        </select>
      </div>
    </div>

    {/* ===== Main Layout ===== */}
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "420px 1fr",
        gap: 20,
        marginTop: 16
      }}
    >
      {/* ===== Left Panel ===== */}
      <div className="glass-card" style={{ padding: 16 }}>
        <h4>Select Coin</h4>

        {/* Search */}
        <div style={{ position: "relative" }}>
          <input
            placeholder="Search coin (BTC, ETH, SOL...)"
            value={searchText}
            onChange={e => handleSearch(e.target.value)}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "#020617",
              color: "#fff"
            }}
          />

          {suggestions.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                background: "#020617",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 8,
                marginTop: 4,
                zIndex: 20,
                maxHeight: 240,
                overflowY: "auto"
              }}
            >
              {suggestions.map(c => (
                <div
                  key={c.id}
                  onClick={() => selectCoin(c)}
                  style={{
                    padding: 8,
                    cursor: "pointer",
                    borderBottom: "1px solid rgba(255,255,255,0.05)"
                  }}
                >
                  {c.name} ({c.symbol.toUpperCase()})
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected coin */}
        {selectedCoin && (
          <div
            style={{
              marginTop: 12,
              padding: 10,
              borderRadius: 8,
              background: "rgba(0,240,255,0.08)",
              border: "1px solid rgba(0,240,255,0.3)"
            }}
          >
            ✅ {selectedCoin.name} ({selectedCoin.symbol.toUpperCase()})
          </div>
        )}

        {/* Custom query */}
        {mode === "custom" && (
          <textarea
            value={customQuery}
            onChange={e => setCustomQuery(e.target.value)}
            placeholder="Enter custom research..."
            rows={3}
            style={{
              width: "100%",
              marginTop: 12,
              padding: 8,
              borderRadius: 6,
              background: "#020617",
              color: "#fff"
            }}
          />
        )}

        {/* Run button */}
        <button
          className="btn-glow"
          onClick={analyze}
          disabled={loading || !userAddress}
          style={{ marginTop: 16, width: "100%" }}
        >
          {loading ? "Running AI..." : "Run Crypto AI (x402)"}
        </button>

        {/* Portfolio */}
        {portfolio.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <h4>💼 Portfolio</h4>
            {portfolio.map(c => (
              <div key={c.id} style={{ fontSize: 13, opacity: 0.9 }}>
                {c.name}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== Right Panel ===== */}
      <div className="glass-card" style={{ padding: 16 }}>
  <h4>Chart</h4>

  {selectedCoin ? (
    <CryptoChart coin={selectedCoin.id} />
  ) : (
    <div style={{ opacity: 0.6 }}>Select a coin to view chart</div>
  )}

  <h4 style={{ marginTop: 20 }}>AI Result</h4>

  {!analysis && <div style={{ opacity: 0.6 }}>Run analysis to see result...</div>}

  {analysis && (
    <pre>...</pre>
  )}

        {analysis && (
          <pre
            style={{
              marginTop: 10,
              background: "#020617",
              padding: 16,
              borderRadius: 10,
              maxHeight: 500,
              overflow: "auto"
            }}
          >
            {JSON.stringify(analysis, null, 2)}
          </pre>
        )}
      </div>
    </div>
  </div>
);
}
