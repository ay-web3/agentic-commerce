import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const RPC_URL = "https://rpc.testnet.arc.network";
const CONTRACT_ADDRESS = "0x12d6DaaD7d9f86221e5920E7117d5848EC0528e6";

const ABI = [
  "function setProductPrice(uint256 productId, uint256 price) external"
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  console.log("Merchant:", await wallet.getAddress());

  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

  const price = ethers.parseUnits("0.001", 6); // 0.001 USDC

  for (let id = 1; id <= 194; id++) {
    console.log(`Setting price for product ${id}`);

    const tx = await contract.setProductPrice(id, price);
    await tx.wait();
  }

  console.log("✅ All products priced");
}

main().catch(console.error);
