export const ARC_CHAIN = {
  chainId: "0x4CEF52", 
  chainName: "Arc Testnet",
  rpcUrls: ["https://rpc.testnet.arc.network"],
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18,
  },
  blockExplorerUrls: ["https://testnet.arcscan.app"],
};

export async function switchToArc() {
  if (!window.ethereum) throw new Error("MetaMask not installed");

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ARC_CHAIN.chainId }],
    });
  } catch (err) {
    // Chain not added
    if (err.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [ARC_CHAIN],
      });
    } else {
      throw err;
    }
  }
}
