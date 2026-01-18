import { ethers } from "ethers";
import { switchToArc } from "./network";

export async function connectWallet() {
  if (!window.ethereum) throw new Error("MetaMask not installed");

  await switchToArc();

  await window.ethereum.request({ method: "eth_requestAccounts" });

  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();

  return { provider, signer, address };
}
