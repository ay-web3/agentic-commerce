export const CONTRACT_ADDRESS = "0x236beE9674C34103db639B50ec62eD2166b837b6";

export const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";

export const ABI = [
  "function payForProduct(uint256 productId, string task, bytes32 receiptId)",
  "function productPrices(uint256) view returns (uint256)"
];

export const USDC_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)"
];
