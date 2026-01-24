dotenv.config();

import express from "express";
import dotenv from "dotenv";
import { ethers } from "ethers";
import fs from "fs";
import fetch from "node-fetch";
import cors from "cors";
import crypto from "crypto";
import { GoogleAuth } from "google-auth-library";
import {
  indexProducts,
  findProductIdsFromText,
  findBestProductId
} from "./productRegistry.js";

const USDC_ADDRESS = process.env.USDC_ADDRESS;




/* =======================
   CONFIG
======================= */
const PRODUCT_PRICE = "0.001";
const PORT = 3000;
const ARC_RPC_URL = "https://rpc.testnet.arc.network";

const X402_CONTRACT_ADDRESS = "0x12d6DaaD7d9f86221e5920E7117d5848EC0528e6";
const AGENT_MANAGER_ADDRESS = process.env.AGENT_MANAGER_ADDRESS;

console.log("X402_CONTRACT_ADDRESS:", X402_CONTRACT_ADDRESS);
console.log("USDC_ADDRESS:", process.env.USDC_ADDRESS);
console.log("AGENT_MANAGER_ADDRESS:", AGENT_MANAGER_ADDRESS);

/* =======================
   BLOCKCHAIN
======================= */

const provider = new ethers.JsonRpcProvider(ARC_RPC_URL);
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
console.log("Backend signer address:", await signer.getAddress());
const agentProvider = new ethers.JsonRpcProvider(ARC_RPC_URL);

const agentSigner = new ethers.Wallet(
  process.env.AGENT_PRIVATE_KEY,
  agentProvider
);
const AGENT_MANAGER_ABI = [
  "function userToAgent(address) view returns (address)"
];

const AGENT_WALLET_ABI = [
  "function execute(address target,uint256 value,bytes data,uint256 amountUSDC)"
];

const X402_ABI = [
  "function pay(uint256 datasetId)"
];
const agenticCommerce = new ethers.Contract(
  X402_CONTRACT_ADDRESS,
  [
    "function payForProduct(uint256 productId, string task, bytes32 receiptId)",
  ],
  agentSigner
);


/* =======================
   PRODUCT CACHE
======================= */

let PRODUCT_CACHE = [];
let PRODUCT_MAP = {};

async function fetchAllProducts() {
  let all = [];
  let skip = 0;
  const limit = 100;

  while (true) {
    const res = await fetch(`https://dummyjson.com/products?limit=${limit}&skip=${skip}`);
    const data = await res.json();

    all.push(...data.products);
    if (data.products.length < limit) break;
    skip += limit;
  }
  return all;
}

async function ensureApproval(agentWalletAddress, priceUSDC) {
  const iface = new ethers.Interface([
    "function approve(address,uint256)"
  ]);

  const amount = ethers.parseUnits("1000000", 6);

  const calldata = iface.encodeFunctionData("approve", [
    X402_CONTRACT_ADDRESS,
    amount
  ]);

  const managerWrite = new ethers.Contract(
    AGENT_MANAGER_ADDRESS,
    ["function executeFromAgent(address,address,uint256,bytes,uint256)"],
    signer
  );

  const tx = await managerWrite.executeFromAgent(
    agentWalletAddress,
    USDC_ADDRESS,
    0,
    calldata,
    0
  );

  await tx.wait();
}


async function initProducts() {
  PRODUCT_CACHE = await fetchAllProducts();
  PRODUCT_MAP = {};
  for (const p of PRODUCT_CACHE) PRODUCT_MAP[p.id] = p.title;
  console.log(`✅ Loaded ${PRODUCT_CACHE.length} products`);
}
async function agentPayForAccess(userAddress, productId, task, priceUSDC) {

  const managerRead = new ethers.Contract(
    AGENT_MANAGER_ADDRESS,
    AGENT_MANAGER_ABI,
    provider
  );

  const agentWalletAddress = await managerRead.userToAgent(userAddress);
  if (agentWalletAddress === ethers.ZeroAddress) {
    throw new Error("User has no agent wallet");
  }

  const iface = new ethers.Interface([
    "function payForProduct(uint256,string,bytes32)"
  ]);

  const receiptId = ethers.id(Date.now().toString());

  const calldata = iface.encodeFunctionData("payForProduct", [
    productId,
    task,
    receiptId
  ]);

  const managerWrite = new ethers.Contract(
    AGENT_MANAGER_ADDRESS,
    ["function executeFromAgent(address,address,uint256,bytes,uint256)"],
    signer
  );

  const price = ethers.parseUnits(priceUSDC.toString(), 6);

  // ✅ 1. Agent approves USDC
  await ensureApproval(agentWalletAddress);

  // ✅ 2. Agent pays X402 contract
  const tx = await managerWrite.executeFromAgent(
    agentWalletAddress,
    X402_CONTRACT_ADDRESS,
    0,
    calldata,
    price
  );

  await tx.wait();

  return tx.hash;
}



/* =======================
   GEMINI
======================= */

const auth = new GoogleAuth({
  credentials: JSON.parse(fs.readFileSync("./secrets/gemini-sa.json", "utf8")),
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
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    }),
  });

  const data = await res.json();
  if (!data.candidates) throw new Error("Gemini failed");

  return data.candidates[0].content.parts[0].text;
}

/* =======================
   EXPRESS
======================= */

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (_, res) => res.send("Agentic Commerce AI API running"));


/* =======================
   AGENT ON-CHAIN PAYMENT
======================= */



/* =======================
   X402 VERIFICATION
======================= */

async function verifyContractPayment(txHash, expectedId, minAmount) {
  const receipt = await provider.waitForTransaction(txHash, 1);
  if (!receipt || receipt.status !== 1) return false;

  const iface = new ethers.Interface([
    "event ProductPaid(address indexed buyer, uint256 indexed productId, uint256 amount)"
  ]);

  const expectedAmount = ethers.parseUnits(minAmount.toString(), 6);

  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);

      if (parsed.name !== "ProductPaid") continue;

      const productId = parsed.args.productId;
      const amount = parsed.args.amount;

      console.log("FOUND EVENT:", {
        productId: productId.toString(),
        amount: amount.toString()
      });

      if (
        productId.toString() === expectedId.toString() &&
        amount >= expectedAmount
      ) {
        return true;
      }

    } catch {}
  }

  return false;
}


/* =======================
   PAID DATASET
======================= */

app.get("/dataset", async (req, res) => {
  let payment;
  try {
    payment = JSON.parse(req.headers["x-payment"]);
  } catch {
    return res.status(402).json({ error: "Invalid payment header" });
  }

  const valid = await verifyContractPayment(payment.txHash, payment.datasetId, payment.amount);
  if (!valid) return res.status(402).json({ error: "Payment not verified" });

  const data = await fetch(`https://dummyjson.com/products/${payment.datasetId}`).then(r => r.json());
  res.json(data);
});

app.get("/search-product", (req, res) => {
  const q = req.query.q || "";

  if (!q.trim()) {
    return res.status(400).json({ error: "Missing query param q" });
  }

  const ids = findProductIdsFromText(q);

  res.json({
    query: q,
    ids
  });
});

/* =======================
   PRODUCT PICKER
======================= */

app.post("/pick-product", (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: "Prompt required" });

  const productId = findBestProductId(prompt) || 1;

  res.json({ productId });
});


/* =======================
   AI ANALYSIS
======================= */

app.post("/ai-query", async (req, res) => {
  try {
    const { productId, task, userAddress, mode, customQuery } = req.body;

    if (!productId || !userAddress) {
      return res.status(400).json({ error: "Missing productId or userAddress" });
    }

    const finalMode = mode || task || "analysis";

    if (finalMode === "Custom research" && (!customQuery || !customQuery.trim())) {
      return res.status(400).json({ error: "Custom research query is empty" });
    }

    // 1. Pay
    const txHash = await agentPayForAccess(
      userAddress,
      productId,
      finalMode,
      PRODUCT_PRICE
    );

    // 2. Verify
    const isValid = await verifyContractPayment(txHash, productId, PRODUCT_PRICE);
    if (!isValid) return res.status(402).json({ error: "Payment failed" });

    // 3. Load data
    const product = await fetch(
      `https://dummyjson.com/products/${productId}`
    ).then(r => r.json());

    const comments = await fetch(
      `https://dummyjson.com/comments?limit=20`
    ).then(r => r.json());

    // 4. Build prompt
    let prompt = "";

    if (finalMode === "Analyze profitability") {
      prompt = `
Give a short profitability analysis.

Product:
${JSON.stringify(product, null, 2)}
`;
    }
    else if (finalMode === "Analyze sentiment") {
      prompt = `
Analyze customer sentiment and risks.

Product:
${JSON.stringify(product, null, 2)}
`;
    }
    else if (finalMode === "Generate marketing ideas") {
      prompt = `
Generate marketing ideas for this product.

Product:
${JSON.stringify(product, null, 2)}
`;
    }
    else if (finalMode === "Custom research") {
      prompt = `
User custom request:
${customQuery}

Rules:
- Use ONLY the product data
- Be concise
- No filler

Product:
${JSON.stringify(product, null, 2)}
`;
    }
    else {
      prompt = `
User task: ${finalMode}

Product:
${JSON.stringify(product, null, 2)}
`;
    }

    // 5. AI
    const analysis = await callGemini(prompt);

    res.json({
      txHash,
      productId,
      mode: finalMode,
      analysis
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "AI failed" });
  }
});



/* =======================
   EXTRA AI ENDPOINTS 
======================= */

app.post("/ai-profit-check", async (req, res) => {
  const { productId } = req.body;

  const product = await fetch(`https://dummyjson.com/products/${productId}`).then(r => r.json());

  const prompt = `
You are a dropshipping analyst.

Return JSON:

{
  "costPrice": number,
  "sellPrice": number,
  "adsCost": number,
  "shipping": number,
  "profit": number,
  "marginPercent": number,
  "verdict": "good | risky | bad"
}

Product:
${JSON.stringify(product, null, 2)}
`;

  const ai = await callGemini(prompt);
  res.json(JSON.parse(ai));
});


app.post("/ai-sentiment", async (req, res) => {
  const comments = await fetch("https://dummyjson.com/comments?limit=30").then(r => r.json());

  const prompt = `
Analyze customer sentiment and risk.

Return JSON:

{
  "score": 0-100,
  "riskLevel": "low | medium | high",
  "commonComplaints": [],
  "summary": ""
}

Comments:
${JSON.stringify(comments.comments, null, 2)}
`;

  const ai = await callGemini(prompt);
  res.json(JSON.parse(ai));
});


app.post("/ai-cart", async (req, res) => {
  const { budget } = req.body;

  const products = PRODUCT_CACHE.slice(0, 50).map(p => ({
    id: p.id,
    title: p.title,
    price: p.price,
    category: p.category
  }));

  const prompt = `
Select products to build a cart under $${budget}.

Return JSON:

{
  "items": [{ "id": number, "qty": number }],
  "total": number,
  "reasoning": "..."
}

Products:
${JSON.stringify(products, null, 2)}
`;

  const ai = await callGemini(prompt);
  res.json({ cart: JSON.parse(ai) });
});


app.post("/ai-users-persona", async (req, res) => {
  const users = await fetch("https://dummyjson.com/users?limit=50").then(r => r.json());

  const prompt = `
You are a marketing analyst.

Build 3 buyer personas.

Return JSON:
[
  {
    "name": "",
    "ageRange": "",
    "interests": [],
    "buyingBehavior": "",
    "recommendedProducts": []
  }
]

Users:
${JSON.stringify(users.users, null, 2)}
`;

  const ai = await callGemini(prompt);
  res.json(JSON.parse(ai));
});


app.post("/ai-marketing-content", async (req, res) => {
  const { productName } = req.body;

  const posts = await fetch("https://dummyjson.com/posts?limit=50").then(r => r.json());

  const prompt = `
Generate marketing copy for product "${productName}".

Return JSON:
{
  "headline": "",
  "shortAd": "",
  "longDescription": "",
  "cta": ""
}

Posts style reference:
${JSON.stringify(posts.posts.slice(0, 10), null, 2)}
`;

  const ai = await callGemini(prompt);
  res.json(JSON.parse(ai));
});


app.post("/ai-business-tasks", async (req, res) => {
  const { businessType } = req.body;

  const todos = await fetch("https://dummyjson.com/todos?limit=50").then(r => r.json());

  const prompt = `
You are an ecommerce operations manager.

Create a task plan for: ${businessType}

Return JSON:
{
  "today": [],
  "thisWeek": [],
  "automationCandidates": []
}

Reference tasks:
${JSON.stringify(todos.todos, null, 2)}
`;

  const ai = await callGemini(prompt);
  res.json(JSON.parse(ai));
});


app.post("/ai-meal-planner", async (req, res) => {
  const { diet } = req.body;

  const recipes = await fetch("https://dummyjson.com/recipes?limit=50").then(r => r.json());

  const prompt = `
Create a 3-day meal plan for diet: ${diet}

Return JSON:
{
  "day1": [],
  "day2": [],
  "day3": [],
  "shoppingList": []
}

Recipes:
${JSON.stringify(recipes.recipes.slice(0, 20), null, 2)}
`;

  const ai = await callGemini(prompt);
  res.json(JSON.parse(ai));
});


/* =======================
   START
======================= */

(async () => {
  await initProducts();
  indexProducts(PRODUCT_CACHE);
  console.log("TEST search lip:", findProductIdsFromText("lip"));
console.log("TEST search phone:", findProductIdsFromText("phone"));
  app.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));
})();
