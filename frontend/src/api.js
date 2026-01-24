import { API_BASE } from "./api";

export async function createAgent(userAddress) {
  const res = await fetch(`${API_BASE}/agent/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userAddress }),
  });

  return res.json();
}

export async function fundAgent(userAddress, amount) {
  const res = await fetch(`${API_BASE}/agent/fund`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userAddress, amount }),
  });

  return res.json();
}

export async function getAgentBalance(agentAddress) {
  const res = await fetch(`${API_BASE}/agent/balance/${agentAddress}`);
  return res.json();
}
