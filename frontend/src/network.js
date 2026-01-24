export async function ensureArcNetwork() {
  if (!window.ethereum) {
    throw new Error("MetaMask not found");
  }

  const ARC_CHAIN_ID = "0x4CEF52"; // change if different

  const currentChainId = await window.ethereum.request({
    method: "eth_chainId",
  });

  if (currentChainId === ARC_CHAIN_ID) return;

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ARC_CHAIN_ID }],
    });
  } catch (err) {
    if (err.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: ARC_CHAIN_ID,
          chainName: "Arc Testnet",
          rpcUrls: ["https://rpc.testnet.arc.network"],
          nativeCurrency: {
            name: "ARC",
            symbol: "ARC",
            decimals: 18,
          },
          blockExplorerUrls: ["https://testnet.arcscan.app"],
        }],
      });
    } else {
      throw err;
    }
  }
}