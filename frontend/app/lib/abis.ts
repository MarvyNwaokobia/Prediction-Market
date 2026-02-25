// ─── sBTC (SyntheticBTC) ─────────────────────────────────────────────────────
export const SBTC_ABI = [
  { type: "function", name: "mint", inputs: [{ name: "recipient", type: "core::starknet::contract_address::ContractAddress" }, { name: "amount", type: "core::integer::u256" }], outputs: [], state_mutability: "external" },
  { type: "function", name: "burn", inputs: [{ name: "amount", type: "core::integer::u256" }], outputs: [], state_mutability: "external" },
  { type: "function", name: "balance_of", inputs: [{ name: "account", type: "core::starknet::contract_address::ContractAddress" }], outputs: [{ type: "core::integer::u256" }], state_mutability: "view" },
  { type: "function", name: "approve", inputs: [{ name: "spender", type: "core::starknet::contract_address::ContractAddress" }, { name: "amount", type: "core::integer::u256" }], outputs: [{ type: "core::bool" }], state_mutability: "external" },
  { type: "function", name: "transfer", inputs: [{ name: "recipient", type: "core::starknet::contract_address::ContractAddress" }, { name: "amount", type: "core::integer::u256" }], outputs: [{ type: "core::bool" }], state_mutability: "external" },
  { type: "function", name: "transfer_from", inputs: [{ name: "sender", type: "core::starknet::contract_address::ContractAddress" }, { name: "recipient", type: "core::starknet::contract_address::ContractAddress" }, { name: "amount", type: "core::integer::u256" }], outputs: [{ type: "core::bool" }], state_mutability: "external" },
  { type: "function", name: "allowance", inputs: [{ name: "owner", type: "core::starknet::contract_address::ContractAddress" }, { name: "spender", type: "core::starknet::contract_address::ContractAddress" }], outputs: [{ type: "core::integer::u256" }], state_mutability: "view" },
  { type: "function", name: "total_supply", inputs: [], outputs: [{ type: "core::integer::u256" }], state_mutability: "view" },
] as const;

// ─── USDC ERC-20 (Starknet Sepolia) ────────────────────────────────────────────
export const USDC_ABI = [
  { type: "function", name: "balance_of", inputs: [{ name: "account", type: "core::starknet::contract_address::ContractAddress" }], outputs: [{ type: "core::integer::u256" }], state_mutability: "view" },
  { type: "function", name: "approve", inputs: [{ name: "spender", type: "core::starknet::contract_address::ContractAddress" }, { name: "amount", type: "core::integer::u256" }], outputs: [{ type: "core::bool" }], state_mutability: "external" },
  { type: "function", name: "transfer", inputs: [{ name: "recipient", type: "core::starknet::contract_address::ContractAddress" }, { name: "amount", type: "core::integer::u256" }], outputs: [{ type: "core::bool" }], state_mutability: "external" },
  { type: "function", name: "transfer_from", inputs: [{ name: "sender", type: "core::starknet::contract_address::ContractAddress" }, { name: "recipient", type: "core::starknet::contract_address::ContractAddress" }, { name: "amount", type: "core::integer::u256" }], outputs: [{ type: "core::bool" }], state_mutability: "external" },
  { type: "function", name: "allowance", inputs: [{ name: "owner", type: "core::starknet::contract_address::ContractAddress" }, { name: "spender", type: "core::starknet::contract_address::ContractAddress" }], outputs: [{ type: "core::integer::u256" }], state_mutability: "view" },
  { type: "function", name: "total_supply", inputs: [], outputs: [{ type: "core::integer::u256" }], state_mutability: "view" },
] as const;

// ─── Market struct (matches Cairo Market struct in market_logic.cairo) ────────
export const MARKET_STRUCT = {
  type: "struct",
  name: "btc_prediction_market::contracts::market_logic::Market",
  members: [
    { name: "id", type: "core::integer::u64" },
    { name: "question", type: "core::felt252" },
    { name: "end_time", type: "core::integer::u64" },
    { name: "resolved", type: "core::bool" },
    { name: "winning_outcome", type: "core::integer::u8" },
    { name: "yes_pool", type: "core::integer::u256" },
    { name: "no_pool", type: "core::integer::u256" },
    { name: "total_liquidity", type: "core::integer::u256" },
    { name: "creator", type: "core::starknet::contract_address::ContractAddress" },
  ],
} as const;

// ─── MarketLogic ─────────────────────────────────────────────────────────────
export const MARKET_ABI = [
  MARKET_STRUCT,
  { type: "function", name: "create_market", inputs: [{ name: "question", type: "core::felt252" }, { name: "end_time", type: "core::integer::u64" }, { name: "initial_liquidity", type: "core::integer::u256" }], outputs: [{ type: "core::integer::u64" }], state_mutability: "external" },
  { type: "function", name: "record_shielded_bet", inputs: [{ name: "market_id", type: "core::integer::u64" }, { name: "outcome", type: "core::integer::u8" }, { name: "amount", type: "core::integer::u256" }], outputs: [], state_mutability: "external" },
  { type: "function", name: "resolve_market", inputs: [{ name: "market_id", type: "core::integer::u64" }, { name: "winning_outcome", type: "core::integer::u8" }], outputs: [], state_mutability: "external" },
  { type: "function", name: "calculate_payout", inputs: [{ name: "market_id", type: "core::integer::u64" }, { name: "bet_amount", type: "core::integer::u256" }], outputs: [{ type: "core::integer::u256" }], state_mutability: "view" },
  { type: "function", name: "get_winning_outcome", inputs: [{ name: "market_id", type: "core::integer::u64" }], outputs: [{ type: "core::integer::u8" }], state_mutability: "view" },
  { type: "function", name: "get_market", inputs: [{ name: "market_id", type: "core::integer::u64" }], outputs: [{ type: "btc_prediction_market::contracts::market_logic::Market" }], state_mutability: "view" },
  { type: "function", name: "get_market_count", inputs: [], outputs: [{ type: "core::integer::u64" }], state_mutability: "view" },
  { type: "function", name: "get_yes_pool", inputs: [{ name: "market_id", type: "core::integer::u64" }], outputs: [{ type: "core::integer::u256" }], state_mutability: "view" },
  { type: "function", name: "get_no_pool", inputs: [{ name: "market_id", type: "core::integer::u64" }], outputs: [{ type: "core::integer::u256" }], state_mutability: "view" },
  { type: "function", name: "set_vault_address", inputs: [{ name: "vault", type: "core::starknet::contract_address::ContractAddress" }], outputs: [], state_mutability: "external" },
  { type: "function", name: "set_oracle_address", inputs: [{ name: "oracle", type: "core::starknet::contract_address::ContractAddress" }], outputs: [], state_mutability: "external" },
] as const;

// ─── ShieldedVault ────────────────────────────────────────────────────────────
export const VAULT_ABI = [
  { type: "function", name: "deposit", inputs: [{ name: "commitment", type: "core::felt252" }, { name: "amount", type: "core::integer::u256" }], outputs: [], state_mutability: "external" },
  { type: "function", name: "withdraw", inputs: [{ name: "nullifier", type: "core::felt252" }, { name: "root", type: "core::felt252" }, { name: "recipient", type: "core::starknet::contract_address::ContractAddress" }, { name: "amount", type: "core::integer::u256" }], outputs: [], state_mutability: "external" },
  { type: "function", name: "place_bet", inputs: [{ name: "nullifier", type: "core::felt252" }, { name: "root", type: "core::felt252" }, { name: "market_id", type: "core::integer::u64" }, { name: "outcome", type: "core::integer::u8" }, { name: "amount", type: "core::integer::u256" }, { name: "new_commitment", type: "core::felt252" }], outputs: [], state_mutability: "external" },
  { type: "function", name: "claim_winnings", inputs: [{ name: "nullifier", type: "core::felt252" }, { name: "root", type: "core::felt252" }, { name: "market_id", type: "core::integer::u64" }, { name: "new_commitment", type: "core::felt252" }], outputs: [], state_mutability: "external" },
  { type: "function", name: "get_root", inputs: [], outputs: [{ type: "core::felt252" }], state_mutability: "view" },
  { type: "function", name: "get_tree_size", inputs: [], outputs: [{ type: "core::integer::u64" }], state_mutability: "view" },
  { type: "function", name: "get_commitment", inputs: [{ name: "index", type: "core::integer::u64" }], outputs: [{ type: "core::felt252" }], state_mutability: "view" },
  { type: "function", name: "is_nullifier_spent", inputs: [{ name: "nullifier", type: "core::felt252" }], outputs: [{ type: "core::bool" }], state_mutability: "view" },
  { type: "function", name: "is_known_root", inputs: [{ name: "root", type: "core::felt252" }], outputs: [{ type: "core::bool" }], state_mutability: "view" },
  { type: "function", name: "set_market_contract", inputs: [{ name: "market_contract", type: "core::starknet::contract_address::ContractAddress" }], outputs: [], state_mutability: "external" },
  { type: "function", name: "set_token_contract", inputs: [{ name: "token_contract", type: "core::starknet::contract_address::ContractAddress" }], outputs: [], state_mutability: "external" },
] as const;

// ─── MarketFactory ────────────────────────────────────────────────────────────
export const FACTORY_ABI = [
  { type: "function", name: "create_market", inputs: [{ name: "question", type: "core::felt252" }, { name: "end_time", type: "core::integer::u64" }], outputs: [{ type: "core::integer::u64" }], state_mutability: "external" },
  { type: "function", name: "get_market_contract", inputs: [], outputs: [{ type: "core::starknet::contract_address::ContractAddress" }], state_mutability: "view" },
  { type: "function", name: "get_vault_contract", inputs: [], outputs: [{ type: "core::starknet::contract_address::ContractAddress" }], state_mutability: "view" },
  { type: "function", name: "get_sbtc_contract", inputs: [], outputs: [{ type: "core::starknet::contract_address::ContractAddress" }], state_mutability: "view" },
  { type: "function", name: "get_oracle_contract", inputs: [], outputs: [{ type: "core::starknet::contract_address::ContractAddress" }], state_mutability: "view" },
  { type: "function", name: "get_all_markets", inputs: [], outputs: [{ type: "core::array::Array::<core::integer::u64>" }], state_mutability: "view" },
  {
    type: "function", name: "set_contracts",
    inputs: [
      { name: "market_contract", type: "core::starknet::contract_address::ContractAddress" },
      { name: "vault_contract", type: "core::starknet::contract_address::ContractAddress" },
      { name: "sbtc_contract", type: "core::starknet::contract_address::ContractAddress" },
      { name: "oracle_contract", type: "core::starknet::contract_address::ContractAddress" },
    ],
    outputs: [], state_mutability: "external"
  },
] as const;

// ─── OracleAdapter ────────────────────────────────────────────────────────────
export const ORACLE_ABI = [
  { type: "function", name: "propose_resolution", inputs: [{ name: "market_id", type: "core::integer::u64" }, { name: "outcome", type: "core::integer::u8" }], outputs: [], state_mutability: "external" },
  { type: "function", name: "dispute_resolution", inputs: [{ name: "market_id", type: "core::integer::u64" }], outputs: [], state_mutability: "external" },
  { type: "function", name: "finalize_resolution", inputs: [{ name: "market_id", type: "core::integer::u64" }], outputs: [], state_mutability: "external" },
  { type: "function", name: "get_proposed_outcome", inputs: [{ name: "market_id", type: "core::integer::u64" }], outputs: [{ type: "core::integer::u8" }], state_mutability: "view" },
  { type: "function", name: "get_resolution_status", inputs: [{ name: "market_id", type: "core::integer::u64" }], outputs: [{ type: "core::integer::u8" }], state_mutability: "view" },
  { type: "function", name: "set_market_contract", inputs: [{ name: "market_contract", type: "core::starknet::contract_address::ContractAddress" }], outputs: [], state_mutability: "external" },
  { type: "function", name: "set_dispute_window", inputs: [{ name: "window", type: "core::integer::u64" }], outputs: [], state_mutability: "external" },
] as const;
