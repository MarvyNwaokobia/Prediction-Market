use starknet::ContractAddress;
use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait,
    start_cheat_caller_address, stop_cheat_caller_address,
    start_cheat_block_timestamp, stop_cheat_block_timestamp,
};
use btc_prediction_market::contracts::synthetic_btc::{ISyntheticBTCDispatcher, ISyntheticBTCDispatcherTrait};
use btc_prediction_market::contracts::shielded_vault::{IShieldedVaultDispatcher, IShieldedVaultDispatcherTrait};
use btc_prediction_market::contracts::market_logic::{IMarketLogicDispatcher, IMarketLogicDispatcherTrait};

fn OWNER() -> ContractAddress { starknet::contract_address_const::<0x1>() }
fn USER1() -> ContractAddress { starknet::contract_address_const::<0x2>() }
fn USER2() -> ContractAddress { starknet::contract_address_const::<0x3>() }

fn deploy_sbtc() -> ISyntheticBTCDispatcher {
    let contract = declare("SyntheticBTC").unwrap().contract_class();
    let mut calldata = array![];
    OWNER().serialize(ref calldata);
    let (address, _) = contract.deploy(@calldata).unwrap();
    ISyntheticBTCDispatcher { contract_address: address }
}

fn deploy_market_logic() -> IMarketLogicDispatcher {
    let contract = declare("MarketLogic").unwrap().contract_class();
    let mut calldata = array![];
    OWNER().serialize(ref calldata);
    let (address, _) = contract.deploy(@calldata).unwrap();
    IMarketLogicDispatcher { contract_address: address }
}

fn deploy_vault(sbtc_address: ContractAddress, market_address: ContractAddress) -> IShieldedVaultDispatcher {
    let contract = declare("ShieldedVault").unwrap().contract_class();
    let mut calldata = array![];
    OWNER().serialize(ref calldata);
    let (address, _) = contract.deploy(@calldata).unwrap();
    let vault = IShieldedVaultDispatcher { contract_address: address };

    // Wire up contracts
    start_cheat_caller_address(address, OWNER());
    vault.set_sbtc_contract(sbtc_address);
    vault.set_market_contract(market_address);
    stop_cheat_caller_address(address);

    vault
}

// ─── TEST 1: sBTC Mint and Balance ────────────────────────────────────────────
#[test]
fn test_sbtc_mint() {
    let sbtc = deploy_sbtc();

    start_cheat_caller_address(sbtc.contract_address, OWNER());
    sbtc.mint(USER1(), 1000_u256);
    stop_cheat_caller_address(sbtc.contract_address);

    assert(sbtc.balance_of(USER1()) == 1000_u256, 'Balance should be 1000');
    assert(sbtc.total_supply() == 1000_u256, 'Supply should be 1000');
}

// ─── TEST 2: sBTC Transfer ────────────────────────────────────────────────────
#[test]
fn test_sbtc_transfer() {
    let sbtc = deploy_sbtc();

    start_cheat_caller_address(sbtc.contract_address, OWNER());
    sbtc.mint(USER1(), 1000_u256);
    stop_cheat_caller_address(sbtc.contract_address);

    start_cheat_caller_address(sbtc.contract_address, USER1());
    sbtc.transfer(USER2(), 400_u256);
    stop_cheat_caller_address(sbtc.contract_address);

    assert(sbtc.balance_of(USER1()) == 600_u256, 'USER1 should have 600');
    assert(sbtc.balance_of(USER2()) == 400_u256, 'USER2 should have 400');
}

// ─── TEST 3: sBTC Burn ────────────────────────────────────────────────────────
#[test]
fn test_sbtc_burn() {
    let sbtc = deploy_sbtc();

    start_cheat_caller_address(sbtc.contract_address, OWNER());
    sbtc.mint(USER1(), 1000_u256);
    sbtc.burn(USER1(), 300_u256);
    stop_cheat_caller_address(sbtc.contract_address);

    assert(sbtc.balance_of(USER1()) == 700_u256, 'Balance should be 700');
    assert(sbtc.total_supply() == 700_u256, 'Supply should be 700');
}

// ─── TEST 4: Vault Deposit ────────────────────────────────────────────────────
#[test]
fn test_vault_deposit() {
    let sbtc = deploy_sbtc();
    let market = deploy_market_logic();
    let vault = deploy_vault(sbtc.contract_address, market.contract_address);

    // Mint sBTC to USER1
    start_cheat_caller_address(sbtc.contract_address, OWNER());
    sbtc.mint(USER1(), 1000_u256);
    stop_cheat_caller_address(sbtc.contract_address);

    // USER1 approves vault
    start_cheat_caller_address(sbtc.contract_address, USER1());
    sbtc.approve(vault.contract_address, 500_u256);
    stop_cheat_caller_address(sbtc.contract_address);

    // USER1 deposits with a commitment
    let commitment: felt252 = 0xDEADBEEF;
    start_cheat_caller_address(vault.contract_address, USER1());
    vault.deposit(commitment, 500_u256);
    stop_cheat_caller_address(vault.contract_address);

    // Tree should have 1 leaf
    assert(vault.get_tree_size() == 1, 'Tree size should be 1');
    // Vault holds the sBTC
    assert(sbtc.balance_of(vault.contract_address) == 500_u256, 'Vault should hold 500');
    // User balance reduced
    assert(sbtc.balance_of(USER1()) == 500_u256, 'User should have 500 left');
}

// ─── TEST 5: Nullifier Tracking ───────────────────────────────────────────────
#[test]
fn test_nullifier_not_spent_initially() {
    let sbtc = deploy_sbtc();
    let market = deploy_market_logic();
    let vault = deploy_vault(sbtc.contract_address, market.contract_address);

    let nullifier: felt252 = 0xABCDEF;
    assert(!vault.is_nullifier_spent(nullifier), 'Should not be spent');
}

// ─── TEST 6: Market Creation ──────────────────────────────────────────────────
#[test]
fn test_market_creation() {
    let market = deploy_market_logic();

    start_cheat_block_timestamp(market.contract_address, 1000_u64);
    start_cheat_caller_address(market.contract_address, OWNER());
    let market_id = market.create_market('Will BTC hit 100k?', 9999_u64, 0_u256);
    stop_cheat_caller_address(market.contract_address);
    stop_cheat_block_timestamp(market.contract_address);

    assert(market_id == 0, 'First market should be id 0');
    assert(market.get_market_count() == 1, 'Should have 1 market');

    let m = market.get_market(0);
    assert(m.question == 'Will BTC hit 100k?', 'Wrong question');
    assert(!m.resolved, 'Should not be resolved');
    assert(m.winning_outcome == 2, 'Should be unresolved');
}

// ─── TEST 7: Market Resolution + Payout ──────────────────────────────────────
#[test]
fn test_market_resolution_and_payout() {
    let market = deploy_market_logic();
    let vault_addr = starknet::contract_address_const::<0x999>();

    // Set vault so bets can be recorded
    start_cheat_caller_address(market.contract_address, OWNER());
    market.set_vault_address(vault_addr);
    start_cheat_block_timestamp(market.contract_address, 1000_u64);
    let market_id = market.create_market('BTC ETF approved?', 5000_u64, 200_u256);
    stop_cheat_caller_address(market.contract_address);

    // Record bets from vault
    start_cheat_caller_address(market.contract_address, vault_addr);
    market.record_shielded_bet(market_id, 1, 100_u256); // 100 on YES
    market.record_shielded_bet(market_id, 0, 50_u256);  // 50 on NO
    stop_cheat_caller_address(market.contract_address);

    // Resolve: YES wins
    start_cheat_block_timestamp(market.contract_address, 6000_u64);
    start_cheat_caller_address(market.contract_address, OWNER());
    market.resolve_market(market_id, 1);
    stop_cheat_caller_address(market.contract_address);
    stop_cheat_block_timestamp(market.contract_address);

    assert(market.get_winning_outcome(market_id) == 1, 'YES should win');

    // Payout: bet 100 on YES, YES pool=200(100+100 initial), NO pool=150(100+50)
    let payout = market.calculate_payout(market_id, 100_u256);
    assert(payout > 100_u256, 'Payout should exceed stake');
}

// ─── TEST 8: Root History ─────────────────────────────────────────────────────
#[test]
fn test_root_updates_on_deposit() {
    let sbtc = deploy_sbtc();
    let market = deploy_market_logic();
    let vault = deploy_vault(sbtc.contract_address, market.contract_address);

    start_cheat_caller_address(sbtc.contract_address, OWNER());
    sbtc.mint(USER1(), 2000_u256);
    stop_cheat_caller_address(sbtc.contract_address);

    start_cheat_caller_address(sbtc.contract_address, USER1());
    sbtc.approve(vault.contract_address, 2000_u256);
    stop_cheat_caller_address(sbtc.contract_address);

    let commitment1: felt252 = 0x111;
    let commitment2: felt252 = 0x222;

    start_cheat_caller_address(vault.contract_address, USER1());
    vault.deposit(commitment1, 500_u256);
    let root1 = vault.get_root();
    vault.deposit(commitment2, 500_u256);
    let root2 = vault.get_root();
    stop_cheat_caller_address(vault.contract_address);

    assert(root1 != root2, 'Root should change on deposit');
    assert(vault.get_tree_size() == 2, 'Tree should have 2 leaves');
    assert(vault.is_known_root(root1), 'Root1 should be in history');
    assert(vault.is_known_root(root2), 'Root2 should be current');
}
