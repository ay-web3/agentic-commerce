import express from "express";
import dotenv from "dotenv";
import { ethers } from "ethers";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "viem/chains";
import fs from "fs";
import { GoogleAuth } from "google-auth-library";
import fetch from "node-fetch";


dotenv.config();

/* =======================
   CONFIG
======================= */

const CONTRACT_ADDRESS = "0x236beE9674C34103db639B50ec62eD2166b837b6";
const ARC_RPC_URL = "https://rpc.testnet.arc.network";
const PORT = 3000;

/* =======================
   BLOCKCHAIN CLIENTS
======================= */

const provider = new ethers.JsonRpcProvider(ARC_RPC_URL);

const account = privateKeyToAccount(process.env.PRIVATE_KEY);

const walletClient = createWalletClient({
  account,
  chain: arcTestnet,
  transport: http(ARC_RPC_URL),
});

const auth = new GoogleAuth({
  credentials: JSON.parse(
    fs.readFileSync("./secrets/gemini-sa.json", "utf8")
  ),
  scopes: [
  "https://www.googleapis.com/auth/cloud-platform",
  "https://www.googleapis.com/auth/generative-language"
],
});

async function getAccessToken() {
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  return tokenResponse.token;
}

async function callGemini(prompt) {
  const token = await getAccessToken();

  const PROJECT_ID = "my-project-ay-63015";
  const LOCATION = "us-central1";

  const url = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/gemini-2.0-flash-001:generateContent`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
    }),
  });

  const data = await res.json();

  if (!data.candidates) {
    console.error("Vertex Gemini error:", data);
    throw new Error("Gemini failed");
  }

  return data.candidates[0].content.parts[0].text;
}




/* =======================
   EXPRESS SETUP
======================= */

import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

app.post("/pick-product", async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) return res.status(400).json({ error: "Prompt required" });

  const productId = await extractProductIdFromAPI(prompt);

  res.json({ productId });
});


app.get("/", (req, res) => {
  res.send("AI Commerce API is running");
});

/* =======================
   SMART CONTRACT HELPERS
======================= */

async function payForProduct(productId, task) {
  const abi = [
    {
      type: "function",
      name: "payForProduct",
      stateMutability: "nonpayable",
      inputs: [
        { name: "productId", type: "uint256" },
        { name: "task", type: "string" },
        { name: "receiptId", type: "bytes32" }
      ],
      outputs: []
    }
  ];

  const receiptId = ethers.id(Date.now().toString());

  const hash = await walletClient.writeContract({
    address: CONTRACT_ADDRESS,
    abi,
    functionName: "payForProduct",
    args: [productId, task, receiptId],
  });

  return hash;
}


async function verifyContractPayment(txHash, expectedProductId, minAmount) {
  // wait until receipt exists
  const receipt = await provider.waitForTransaction(txHash, 1);

  if (!receipt || !receipt.logs) return false;

  const iface = new ethers.Interface([
    "event ProductPaid(address indexed buyer, uint256 indexed productId, uint256 amount)"
  ]);

  for (const log of receipt.logs) {
    // only logs from your contract
    if (log.address.toLowerCase() !== CONTRACT_ADDRESS.toLowerCase()) continue;

    try {
      const parsed = iface.parseLog(log);

      const productId = Number(parsed.args.productId);
      const amount = parsed.args.amount;

      const requiredAmount = ethers.parseUnits(minAmount, 6);

      console.log("✅ Found ProductPaid:", { productId, amount: amount.toString() });

      if (productId === Number(expectedProductId) && amount >= requiredAmount) {
        return true;
      }
    } catch (err) {
      // ignore non-matching logs
    }
  }

  return false;
}

/* =======================
   PAID PRODUCT API
======================= */

app.get("/product", async (req, res) => {
  let paymentData;

  try {
    paymentData = JSON.parse(req.headers["x-payment"]);
  } catch {
    return res.status(402).json({ error: "Invalid payment format" });
  }

  if (
    paymentData.chain !== "arc-testnet" ||
    paymentData.token !== "USDC" ||
    paymentData.contract !== CONTRACT_ADDRESS ||
    !paymentData.txHash ||
    !paymentData.amount ||
    !paymentData.productId
  ) {
    return res.status(402).json({ error: "Invalid payment details" });
  }

  const productId = req.query.id;

  if (!productId) {
    return res.status(400).json({ error: "Product id is required" });
  }

  if (Number(productId) !== Number(paymentData.productId)) {
    return res.status(402).json({ error: "Product mismatch" });
  }

  const isValid = await verifyContractPayment(
    paymentData.txHash,
    paymentData.productId,
    paymentData.amount
  );

  if (!isValid) {
    return res.status(402).json({ error: "Smart contract payment not verified" });
  }

  try {
    const response = await fetch(`https://dummyjson.com/products/${productId}`);
    const product = await response.json();
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

async function extractProductIdFromAPI(userPrompt) {
  // 1. Fetch real products
  const res = await fetch("https://dummyjson.com/products?limit=20");
  const data = await res.json();

  const products = data.products;

  // 2. Build readable list for AI
  const productListText = products
    .map(p => `${p.id}: ${p.title} (${p.category})`)
    .join("\n");

  // 3. Ask Gemini to select
  const aiPrompt = `
You are selecting a product ID from a store catalog.

Available products:
${productListText}

User request:
"${userPrompt}"

Rules:
- Return ONLY the product ID number (1 to 20)
- No words
- No explanation
- If unclear, return 1
`;

  const text = await callGemini(aiPrompt);

  const id = Number(text.trim());

  if (!id || id < 1 || id > 20) return 1;

  return id;
}

/* =======================
   AI AGENT ENDPOINT
======================= */

app.post("/ai-query", async (req, res) => {
  try {
    const { txHash, productId } = req.body;

    if (!txHash || !productId) {
      return res.status(400).json({ error: "Missing txHash or productId" });
    }

    const isValid = await verifyContractPayment(txHash, productId, "1");

    if (!isValid) {
      return res.status(402).json({ error: "Payment not verified" });
    }

    const response = await fetch(`https://dummyjson.com/products/${productId}`);
    const productData = await response.json();

    const analysis = await callGemini(`
Analyze this product performance:

${JSON.stringify(productData, null, 2)}
`);

    res.json({
      productId,
      txHash,
      analysis
    });

  } catch (err) {
    console.error("AI agent error:", err);
    res.status(500).json({ error: "AI processing failed" });
  }
});




/* =======================
   START SERVER
======================= */

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
