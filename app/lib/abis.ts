export const SBTC_ABI = [
  { type: "function", name: "mint", inputs: [{ name: "recipient", type: "core::starknet::contract_address::ContractAddress" }, { name: "amount", type: "core::integer::u256" }], outputs: [], state_mutability: "external" },
  { type: "function", name: "balance_of", inputs: [{ name: "account", type: "core::starknet::contract_address::ContractAddress" }], outputs: [{ type: "core::integer::u256" }], state_mutability: "view" },
  { type: "function", name: "approve", inputs: [{ name: "spender", type: "core::starknet::contract_address::ContractAddress" }, { name: "amount", type: "core::integer::u256" }], outputs: [{ type: "core::bool" }], state_mutability: "external" },
  { type: "function", name: "transfer", inputs: [{ name: "recipient", type: "core::starknet::contract_address::ContractAddress" }, { name: "amount", type: "core::integer::u256" }], outputs: [{ type: "core::bool" }], state_mutability: "external" },
  { type: "function", name: "total_supply", inputs: [], outputs: [{ type: "core::integer::u256" }], state_mutability: "view" },
] as const;

export const MARKET_ABI = [
  { type: "function", name: "create_market", inputs: [{ name: "question", type: "core::felt252" }, { name: "end_time", type: "core::integer::u64" }, { name: "initial_liquidity", type: "core::integer::u256" }], outputs: [{ type: "core::integer::u64" }], state_mutability: "external" },
  { type: "function", name: "get_market", inputs: [{ name: "market_id", type: "core::integer::u64" }], outputs: [{ type: "btc_prediction_market::contracts::market_logic::Market" }], state_mutability: "view" },
  { type: "function", name: "get_market_count", inputs: [], outputs: [{ type: "core::integer::u64" }], state_mutability: "view" },
  { type: "function", name: "get_yes_pool", inputs: [{ name: "market_id", type: "core::integer::u64" }], outputs: [{ type: "core::integer::u256" }], state_mutability: "view" },
  { type: "function", name: "get_no_pool", inputs: [{ name: "market_id", type: "core::integer::u64" }], outputs: [{ type: "core::integer::u256" }], state_mutability: "view" },
  { type: "function", name: "calculate_payout", inputs: [{ name: "market_id", type: "core::integer::u64" }, { name: "bet_amount", type: "core::integer::u256" }], outputs: [{ type: "core::integer::u256" }], state_mutability: "view" },
] as const;

export const VAULT_ABI = [
  { type: "function", name: "deposit", inputs: [{ name: "commitment", type: "core::felt252" }, { name: "amount", type: "core::integer::u256" }], outputs: [], state_mutability: "external" },
  { type: "function", name: "place_bet", inputs: [{ name: "nullifier", type: "core::felt252" }, { name: "root", type: "core::felt252" }, { name: "market_id", type: "core::integer::u64" }, { name: "outcome", type: "core::integer::u8" }, { name: "amount", type: "core::integer::u256" }, { name: "new_commitment", type: "core::felt252" }], outputs: [], state_mutability: "external" },
  { type: "function", name: "get_root", inputs: [], outputs: [{ type: "core::felt252" }], state_mutability: "view" },
  { type: "function", name: "get_tree_size", inputs: [], outputs: [{ type: "core::integer::u64" }], state_mutability: "view" },
  { type: "function", name: "is_nullifier_spent", inputs: [{ name: "nullifier", type: "core::felt252" }], outputs: [{ type: "core::bool" }], state_mutability: "view" },
  { type: "function", name: "is_known_root", inputs: [{ name: "root", type: "core::felt252" }], outputs: [{ type: "core::bool" }], state_mutability: "view" },
] as const;
