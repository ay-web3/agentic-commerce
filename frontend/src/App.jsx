import { useState } from "react";
import { connectWallet } from "./web3";
import { ethers } from "ethers";
import { CONTRACT_ADDRESS, ABI, USDC_ADDRESS, USDC_ABI } from "./contract";
const BACKEND_URL = "https://turbo-garbanzo-96j5wvvp44527wp5-3000.app.github.dev";

function App() {
  const [address, setAddress] = useState("");
  const [query, setQuery] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [txHash, setTxHash] = useState("");
  const [loading, setLoading] = useState(false);

  async function connect() {
    const { address } = await connectWallet();
    setAddress(address);
  }

  async function buyAndAnalyze() {
  if (!query.trim()) {
    alert("Enter a product description");
    return;
  }

  try {
    setLoading(true);
    setAnalysis("");

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
    const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);

    // 1. AI chooses product ID (via backend)
    const pickRes = await fetch(BACKEND_URL + "/pick-product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: query })
    });

    const pickData = await pickRes.json();

if (!pickRes.ok) {
  throw new Error(pickData.error || "Product selection failed");
}

const productId = pickData.productId;


    // 2. Read price
    const price = await contract.productPrices(productId);

    // 3. Approve USDC
    const allowance = await usdc.allowance(await signer.getAddress(), CONTRACT_ADDRESS);

    if (allowance < price) {
      const approveTx = await usdc.approve(CONTRACT_ADDRESS, price);
      await approveTx.wait();
    }

    // 4. Pay contract
    const receiptId = ethers.id(Date.now().toString());

    const tx = await contract.payForProduct(productId, query, receiptId);
    await tx.wait();

    setTxHash(tx.hash);

    // 5. Ask backend to verify + analyze
    const res = await fetch(BACKEND_URL + "/ai-query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        txHash: tx.hash,
        productId
      })
    });

    const data = await res.json();

    setAnalysis(data.analysis);

  } catch (err) {
    alert(err.message);
  } finally {
    setLoading(false);
  }
}


  return (
    <div style={{ padding: 30, maxWidth: 600 }}>
      <h2>Agentic Commerce AI</h2>

      {!address ? (
        <button onClick={connect}>Connect Wallet</button>
      ) : (
        <p>Connected: {address}</p>
      )}

      <input
  placeholder="Describe product (e.g. red lipstick, cheap perfume)"
  value={query}
  onChange={(e) => setQuery(e.target.value)}
        style={{ width: "100%", marginTop: 10 }}
      />

      <button onClick={buyAndAnalyze} disabled={loading} style={{ marginTop: 10 }}>
        {loading ? "Processing..." : "Buy & Analyze"}
      </button>

      {txHash && (
        <p>
          Tx:{" "}
          <a
            href={`https://testnet.arcscan.app/tx/${txHash}`}
            target="_blank"
          >
            View on ArcScan
          </a>
        </p>
      )}

      {analysis && (
        <>
          <h3>AI Result</h3>
          <pre>{analysis}</pre>
        </>
      )}
    </div>
  );
}

export default App;
