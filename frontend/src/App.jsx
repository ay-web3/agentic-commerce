import { useState } from "react";
import { connectWallet } from "./web3";
import { ethers } from "ethers";
import { CONTRACT_ADDRESS, ABI, USDC_ADDRESS, USDC_ABI } from "./contract";

function App() {
  const [address, setAddress] = useState("");
  const [productId, setProductId] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [txHash, setTxHash] = useState("");
  const [loading, setLoading] = useState(false);

  async function connect() {
    const { address } = await connectWallet();
    setAddress(address);
  }

  async function buyAndAnalyze() {
  const pid = parseInt(productId, 10);

  if (!pid || pid <= 0) {
    alert("Enter a valid product ID (e.g. 1)");
    return;
  }

  try {
    setLoading(true);
    setAnalysis("");

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
    const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);

    const price = await contract.productPrices(pid);

    const owner = await signer.getAddress();
    const allowance = await usdc.allowance(owner, CONTRACT_ADDRESS);

    if (allowance < price) {
      const approveTx = await usdc.approve(CONTRACT_ADDRESS, price);
      await approveTx.wait();
    }

    const receiptId = ethers.id(Date.now().toString());

    const tx = await contract.payForProduct(pid, "AI analysis request", receiptId);
    setTxHash(tx.hash);

    await tx.wait();

    const res = await fetch("https://turbo-garbanzo-96j5wvvp44527wp5-3000.app.github.dev/ai-query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: `Tell me about product ${pid} and analyze its performance`
      }),
    });

    const data = await res.json();
    setAnalysis(data.analysis || JSON.stringify(data, null, 2));

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
        placeholder="Product ID"
        value={productId}
        onChange={(e) => setProductId(e.target.value)}
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
