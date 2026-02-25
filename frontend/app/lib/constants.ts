// Contract addresses — update these after deployment
export const CONTRACTS = {
  SYNTHETIC_BTC: process.env.NEXT_PUBLIC_SBTC_ADDRESS || "0x0",
  SHIELDED_VAULT: process.env.NEXT_PUBLIC_VAULT_ADDRESS || "0x0",
  MARKET_LOGIC: process.env.NEXT_PUBLIC_MARKET_LOGIC_ADDRESS || "0x0",
  MARKET_FACTORY: process.env.NEXT_PUBLIC_MARKET_FACTORY_ADDRESS || "0x0",
  ORACLE_ADAPTER: process.env.NEXT_PUBLIC_ORACLE_ADDRESS || "0x0",
};

// Convenience exports used throughout the app
export const SBTC_ADDRESS = CONTRACTS.SYNTHETIC_BTC; // legacy
export const VAULT_ADDRESS = CONTRACTS.SHIELDED_VAULT;

// USDC on Starknet Sepolia — override via NEXT_PUBLIC_USDC_ADDRESS in .env.local
export const USDC_ADDRESS =
  process.env.NEXT_PUBLIC_USDC_ADDRESS ||
  "0x053b40a647cedfca6ca84f542a0fe36736031905a9639a7f19a3c1e66bfd5080";

// STRK on Starknet Sepolia (native token, received from Atomiq Lightning swap)
export const STRK_ADDRESS = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";
export const MARKET_LOGIC_ADDRESS = CONTRACTS.MARKET_LOGIC;
export const MARKET_FACTORY_ADDRESS = CONTRACTS.MARKET_FACTORY;
export const ORACLE_ADDRESS = CONTRACTS.ORACLE_ADAPTER;

export const NETWORK = process.env.NEXT_PUBLIC_NETWORK || "sepolia";

// Outcome labels
export const OUTCOMES: Record<number, string> = {
  0: "NO",
  1: "YES",
};

// Market resolution status
export const RESOLUTION_STATUS: Record<number, string> = {
  0: "None",
  1: "Proposed",
  2: "Disputed",
  3: "Finalized",
};

