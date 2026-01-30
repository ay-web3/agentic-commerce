import { useEffect, useState } from "react";
import { ethers } from "ethers";
import "./trust.css";
import CoinGeckoDashboard from "./CoinGeckoDashboard";

import { searchProducts } from "./api/products";
import { PRODUCT_MAP } from "./productMap";
import { ensureArcNetwork } from "./network";
import CryptoChart from "./components/CryptoChart";

import {
  USDC_ADDRESS,
  USDC_ABI,
  AGENT_MANAGER_ADDRESS,
  AGENT_MANAGER_ABI,
} from "./contract";

const API_BASE =
  "https://super-invention-qvp46rrwg67cxjvj-3000.app.github.dev";

function shortAddr(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function App() {
  /* =====================
     Wallet / Agent
  ===================== */
  const [address, setAddress] = useState("");
  const [agentWallet, setAgentWallet] = useState("");
  const [agentBalance, setAgentBalance] = useState("0");
  const [dailyLimit, setDailyLimit] = useState("10");
  const [fundAmount, setFundAmount] = useState("");
  
  /* =====================
     Product + AI
  ===================== */
  const [view, setView] = useState("commerce");
  const [searchText, setSearchText] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState(null);

  const [task, setTask] = useState("Analyze profitability");
  const [customQuery, setCustomQuery] = useState("");

  const [analysis, setAnalysis] = useState("");
  const [txHash, setTxHash] = useState("");
  const [step, setStep] = useState("");
  const [loading, setLoading] = useState(false);

  /* =====================
     Wallet
  ===================== */

  async function connectWallet() {
    try {
      await ensureArcNetwork();
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      setAddress(await signer.getAddress());
    } catch (err) {
      alert("Wallet connection failed");
    }
  }

  /* =====================
     Agent
  ===================== */

  async function loadAgentWallet() {
    if (!address) return;

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    const manager = new ethers.Contract(
      AGENT_MANAGER_ADDRESS,
      AGENT_MANAGER_ABI,
      signer
    );

    const agent = await manager.getMyAgent();

    if (agent && agent !== ethers.ZeroAddress) {
      setAgentWallet(agent);
      loadAgentBalance(agent);
    }
  }

  async function createAgentWallet() {
    try {
      setLoading(true);
      setStep("Creating AI Agent...");

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const manager = new ethers.Contract(
        AGENT_MANAGER_ADDRESS,
        AGENT_MANAGER_ABI,
        signer
      );

      const limit = ethers.parseUnits(dailyLimit, 6);
      const tx = await manager.createAgentWallet(limit);
      await tx.wait();

      await loadAgentWallet();
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
      setStep("");
    }
  }

  async function loadAgentBalance(agentAddr) {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);
    const bal = await usdc.balanceOf(agentAddr);
    setAgentBalance(ethers.formatUnits(bal, 6));
  }

  async function fundAgent() {
    try {
      setLoading(true);
      setStep("Funding agent wallet...");

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);

      const tx = await usdc.transfer(
        agentWallet,
        ethers.parseUnits(fundAmount, 6)
      );
      await tx.wait();

      await loadAgentBalance(agentWallet);
      setFundAmount("");
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
      setStep("");
    }
  }

  /* =====================
     Product Search
  ===================== */

  async function handleSearchChange(e) {
    const value = e.target.value;
    setSearchText(value);

    if (value.length < 2) {
      setSuggestions([]);
      return;
    }

    const ids = await searchProducts(value);
    setSuggestions(ids);
  }

  function selectProduct(id) {
    setSelectedProductId(id);
    setSearchText(PRODUCT_MAP[id]);
    setSuggestions([]);
  }

  /* =====================
     Buy & Analyze
  ===================== */

  async function buyAndAnalyze() {
    if (!selectedProductId) return alert("Select a product");
    if (!agentWallet) return alert("Create AI agent first");

    try {
      setLoading(true);
      setAnalysis("");
      setTxHash("");
      setStep("AI agent paying on-chain...");

      const res = await fetch(`${API_BASE}/ai-query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedProductId,
          task,
          mode: task,
          customQuery,
          userAddress: address,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI failed");

      setTxHash(data.txHash);
      setAnalysis(
        typeof data.analysis === "string"
          ? data.analysis
          : JSON.stringify(data.analysis, null, 2)
      );

      setStep("Done");
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
      setTimeout(() => setStep(""), 1500);
    }
  }

  useEffect(() => {
    if (address) loadAgentWallet();
  }, [address]);

  /* =====================
     UI
  ===================== */

  return (
    <>
      {/* NAVBAR */}
      <nav className="navbar">
        <div className="logo">AgenticCommerce</div>

        <div className="nav-links">
          <a onClick={() => setView("commerce")}>Commerce AI</a>
          <a onClick={() => setView("crypto")}>Crypto AI</a>
        </div>

        {!address ? (
          <button className="btn-glow" onClick={connectWallet}>
            Connect Wallet
          </button>
        ) : (
          <span>{shortAddr(address)}</span>
        )}
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-text">
          <h1>Autonomous AI Agents for On-Chain Commerce</h1>
          <p>
            Let AI analyze products, pay smart contracts, generate insights, and
            make decisions — fully decentralized.
          </p>

          <div style={{ marginBottom: 16 }}>
            <button onClick={() => setView("commerce")}>🛒 Commerce AI</button>
            <button onClick={() => setView("crypto")} style={{ marginLeft: 10 }}>
              📊 Crypto AI
            </button>
          </div>
        </div>

        <div className="hero-visual">
          <div className="agent-orb">🤖</div>
        </div>
      </section>

      {/* DASHBOARD */}
      <section id="dashboard">
        {view === "commerce" && (
          <>
            <h2 className="section-title">AI Agent Dashboard</h2>

            <div className="glass-card">
              <h3>AI Agent Wallet</h3>

              {!agentWallet && address && (
                <>
                  <input
                    placeholder="Daily limit (USDC)"
                    value={dailyLimit}
                    onChange={(e) => setDailyLimit(e.target.value)}
                  />
                  <br />
                  <br />
                  <button className="btn-glow" onClick={createAgentWallet}>
                    Create AI Agent
                  </button>
                </>
              )}

              {agentWallet && (
                <>
                  <p>Status: 🟢 Active</p>
                  <p>Address: {shortAddr(agentWallet)}</p>
                  <p>Balance: {agentBalance} USDC</p>

                  <input
                    placeholder="Fund amount"
                    value={fundAmount}
                    onChange={(e) => setFundAmount(e.target.value)}
                  />
                  <br />
                  <br />
                  <button className="btn-glow" onClick={fundAgent}>
                    Fund Agent
                  </button>
                </>
              )}
            </div>

            <div className="glass-card" style={{ marginTop: 24 }}>
              <h3>AI Assistant</h3>

              <input
                placeholder="Search product..."
                value={searchText}
                onChange={handleSearchChange}
                style={{ width: "100%" }}
              />

              {suggestions.map((id) => (
                <div
                  key={id}
                  className="table-row"
                  onClick={() => selectProduct(id)}
                >
                  {PRODUCT_MAP[id]}
                </div>
              ))}

              <select value={task} onChange={(e) => setTask(e.target.value)}>
                <option>Analyze profitability</option>
                <option>Analyze sentiment</option>
                <option>Generate marketing ideas</option>
                <option>Custom research</option>
              </select>

              {task === "Custom research" && (
                <textarea
                  placeholder="Describe what you want AI to research..."
                  value={customQuery}
                  onChange={(e) => setCustomQuery(e.target.value)}
                />
              )}

              <br />
              <br />

              <button
                className="btn-glow"
                onClick={buyAndAnalyze}
                disabled={loading}
              >
                {loading ? "Working..." : "Run AI Agent"}
              </button>

              {step && <p>⏳ {step}</p>}
              {analysis && <pre>{analysis}</pre>}
            </div>
          </>
        )}

        {view === "crypto" && (
          <>
            <h2 className="section-title">Crypto AI Dashboard</h2>
            <CryptoChart coin="bitcoin" />
            <CoinGeckoDashboard userAddress={address} />
          </>
        )}
      </section>

      {/* FOOTER */}
      <div className="footer">
        <div className="footer-inner">
          © 2026 Agentic Commerce · Built for ARC Hackathon
        </div>
      </div>
    </>
  );
}
