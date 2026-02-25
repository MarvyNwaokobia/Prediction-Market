use btc_prediction_market::contracts::market_logic::{
    IMarketLogicDispatcher, IMarketLogicDispatcherTrait,
};
use btc_prediction_market::contracts::shielded_vault::{
    IShieldedVaultDispatcher, IShieldedVaultDispatcherTrait,
};
use btc_prediction_market::contracts::synthetic_btc::{
    ISyntheticBTCDispatcher, ISyntheticBTCDispatcherTrait,
};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_block_timestamp,
    start_cheat_caller_address, stop_cheat_block_timestamp, stop_cheat_caller_address,
};
use starknet::ContractAddress;

fn OWNER() -> ContractAddress {
    0x1.try_into().unwrap()
}
fn USER1() -> ContractAddress {
    0x2.try_into().unwrap()
}
fn USER2() -> ContractAddress {
    0x3.try_into().unwrap()
}

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

fn deploy_vault(
    sbtc_address: ContractAddress, market_address: ContractAddress,
) -> IShieldedVaultDispatcher {
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

// ─── TEST 1: sBTC Mint and Balance
// ────────────────────────────────────────────
#[test]
fn test_sbtc_mint() {
    let sbtc = deploy_sbtc();

    start_cheat_caller_address(sbtc.contract_address, OWNER());
    sbtc.mint(USER1(), 1000_u256);
    stop_cheat_caller_address(sbtc.contract_address);

    assert(sbtc.balance_of(USER1()) == 1000_u256, 'Balance should be 1000');
    assert(sbtc.total_supply() == 1000_u256, 'Supply should be 1000');
}

// ─── TEST 2: sBTC Transfer
// ────────────────────────────────────────────────────
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

// ─── TEST 3: sBTC Burn
// ────────────────────────────────────────────────────────
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

// ─── TEST 4: Vault Deposit
// ────────────────────────────────────────────────────
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

// ─── TEST 5: Nullifier Tracking
// ───────────────────────────────────────────────
#[test]
fn test_nullifier_not_spent_initially() {
    let sbtc = deploy_sbtc();
    let market = deploy_market_logic();
    let vault = deploy_vault(sbtc.contract_address, market.contract_address);

    let nullifier: felt252 = 0xABCDEF;
    assert(!vault.is_nullifier_spent(nullifier), 'Should not be spent');
}

// ─── TEST 6: Market Creation
// ──────────────────────────────────────────────────
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

// ─── TEST 7: Market Resolution + Payout
// ──────────────────────────────────────
#[test]
fn test_market_resolution_and_payout() {
    let market = deploy_market_logic();
    let vault_addr: ContractAddress = 0x999.try_into().unwrap();

    // Set vault so bets can be recorded
    start_cheat_caller_address(market.contract_address, OWNER());
    market.set_vault_address(vault_addr);
    start_cheat_block_timestamp(market.contract_address, 1000_u64);
    let market_id = market.create_market('BTC ETF approved?', 5000_u64, 200_u256);
    stop_cheat_caller_address(market.contract_address);

    // Record bets from vault
    start_cheat_caller_address(market.contract_address, vault_addr);
    market.record_shielded_bet(market_id, 1, 100_u256); // 100 on YES
    market.record_shielded_bet(market_id, 0, 50_u256); // 50 on NO
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

// ─── TEST 8: Root History
// ─────────────────────────────────────────────────────
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

// ─── TEST 9: Full bet → claim winnings cycle
// ──────────────────────────────────
// Deposit → place_bet → market resolves → claim_winnings
#[test]
fn test_full_bet_and_claim_cycle() {
    let sbtc = deploy_sbtc();
    let market = deploy_market_logic();
    let vault = deploy_vault(sbtc.contract_address, market.contract_address);

    // Wire market to accept vault bets
    start_cheat_caller_address(market.contract_address, OWNER());
    market.set_vault_address(vault.contract_address);
    stop_cheat_caller_address(market.contract_address);

    // Mint and approve sBTC
    start_cheat_caller_address(sbtc.contract_address, OWNER());
    sbtc.mint(USER1(), 1000_u256);
    stop_cheat_caller_address(sbtc.contract_address);

    start_cheat_caller_address(sbtc.contract_address, USER1());
    sbtc.approve(vault.contract_address, 1000_u256);
    stop_cheat_caller_address(sbtc.contract_address);

    // Create a market (end_time = 5000)
    start_cheat_block_timestamp(market.contract_address, 100_u64);
    start_cheat_caller_address(market.contract_address, OWNER());
    let market_id = market.create_market('BTC 100k?', 5000_u64, 0_u256);
    stop_cheat_caller_address(market.contract_address);
    stop_cheat_block_timestamp(market.contract_address);

    // USER1 deposits — commitment = pedersen(secret=0xAAA, amount=1000)
    let commitment: felt252 = 0xAAA;
    start_cheat_caller_address(vault.contract_address, USER1());
    vault.deposit(commitment, 1000_u256);
    stop_cheat_caller_address(vault.contract_address);

    let root_after_deposit = vault.get_root();

    // USER1 places bet using nullifier=commitment (MVP scheme)
    // Bets 600, keeps 400 in new commitment
    let nullifier: felt252 = 0xAAA;
    let new_commitment: felt252 = 0xBBB;

    start_cheat_block_timestamp(market.contract_address, 100_u64);
    start_cheat_block_timestamp(vault.contract_address, 100_u64);
    start_cheat_caller_address(vault.contract_address, USER1());
    vault.place_bet(nullifier, root_after_deposit, market_id, 1, 600_u256, new_commitment);
    stop_cheat_caller_address(vault.contract_address);
    stop_cheat_block_timestamp(vault.contract_address);
    stop_cheat_block_timestamp(market.contract_address);

    // Nullifier must now be spent
    assert(vault.is_nullifier_spent(nullifier), 'Nullifier should be spent');
    // YES pool should reflect the bet
    assert(market.get_yes_pool(market_id) == 600_u256, 'YES pool should be 600');

    // Resolve YES wins after market ends
    start_cheat_block_timestamp(market.contract_address, 6000_u64);
    start_cheat_caller_address(market.contract_address, OWNER());
    market.resolve_market(market_id, 1);
    stop_cheat_caller_address(market.contract_address);
    stop_cheat_block_timestamp(market.contract_address);

    // Claim winnings — new_commitment2 receives the payout
    // The claim nullifier is `new_commitment` (the bet receipt note), which is
    // unspent. bet_exists is keyed on (new_commitment, market_id).
    let winning_commitment: felt252 = 0xCCC;
    let root_for_claim = vault.get_root();

    start_cheat_caller_address(vault.contract_address, USER1());
    vault.claim_winnings(new_commitment, root_for_claim, market_id, winning_commitment);
    stop_cheat_caller_address(vault.contract_address);

    // new_commitment (bet receipt) should now be spent after claiming
    assert(vault.is_nullifier_spent(new_commitment), 'Claim nullifier should be spent');
    // Tree grew: deposit(1) + bet remainder(1) + winnings(1) = 3
    assert(vault.get_tree_size() == 3, 'Tree should have 3 leaves');
}

// ─── TEST 10: Double-spend nullifier protection
// ───────────────────────────────
#[test]
#[should_panic(expected: 'Nullifier already spent')]
fn test_double_spend_nullifier() {
    let sbtc = deploy_sbtc();
    let market = deploy_market_logic();
    let vault = deploy_vault(sbtc.contract_address, market.contract_address);

    start_cheat_caller_address(market.contract_address, OWNER());
    market.set_vault_address(vault.contract_address);
    stop_cheat_caller_address(market.contract_address);

    start_cheat_caller_address(sbtc.contract_address, OWNER());
    sbtc.mint(USER1(), 2000_u256);
    stop_cheat_caller_address(sbtc.contract_address);

    start_cheat_caller_address(sbtc.contract_address, USER1());
    sbtc.approve(vault.contract_address, 2000_u256);
    stop_cheat_caller_address(sbtc.contract_address);

    start_cheat_block_timestamp(market.contract_address, 100_u64);
    start_cheat_caller_address(market.contract_address, OWNER());
    let market_id = market.create_market('Double spend test', 5000_u64, 0_u256);
    stop_cheat_caller_address(market.contract_address);
    stop_cheat_block_timestamp(market.contract_address);

    let commitment: felt252 = 0xDDD;
    start_cheat_caller_address(vault.contract_address, USER1());
    vault.deposit(commitment, 1000_u256);
    stop_cheat_caller_address(vault.contract_address);

    let root = vault.get_root();

    start_cheat_block_timestamp(market.contract_address, 100_u64);
    start_cheat_block_timestamp(vault.contract_address, 100_u64);
    start_cheat_caller_address(vault.contract_address, USER1());

    // First bet — succeeds
    vault.place_bet(commitment, root, market_id, 1, 300_u256, 0xEEE);

    // Second bet with same nullifier — must panic
    vault.place_bet(commitment, root, market_id, 0, 300_u256, 0xFFF);
    stop_cheat_caller_address(vault.contract_address);
    stop_cheat_block_timestamp(vault.contract_address);
    stop_cheat_block_timestamp(market.contract_address);
}

// ─── TEST 11: Duplicate commitment rejected
// ────────────────────────────────────
#[test]
#[should_panic(expected: 'Commitment already exists')]
fn test_duplicate_commitment_rejected() {
    let sbtc = deploy_sbtc();
    let market = deploy_market_logic();
    let vault = deploy_vault(sbtc.contract_address, market.contract_address);

    start_cheat_caller_address(sbtc.contract_address, OWNER());
    sbtc.mint(USER1(), 2000_u256);
    stop_cheat_caller_address(sbtc.contract_address);

    start_cheat_caller_address(sbtc.contract_address, USER1());
    sbtc.approve(vault.contract_address, 2000_u256);
    stop_cheat_caller_address(sbtc.contract_address);

    let commitment: felt252 = 0x123;
    start_cheat_caller_address(vault.contract_address, USER1());
    vault.deposit(commitment, 500_u256);
    // Depositing the same commitment again must be rejected
    vault.deposit(commitment, 500_u256);
    stop_cheat_caller_address(vault.contract_address);
}

// ─── TEST 12: sBTC allowance enforced on deposit
// ──────────────────────────────
#[test]
#[should_panic(expected: 'Insufficient allowance')]
fn test_deposit_requires_allowance() {
    let sbtc = deploy_sbtc();
    let market = deploy_market_logic();
    let vault = deploy_vault(sbtc.contract_address, market.contract_address);

    start_cheat_caller_address(sbtc.contract_address, OWNER());
    sbtc.mint(USER1(), 1000_u256);
    stop_cheat_caller_address(sbtc.contract_address);

    // No approval given — must fail on transfer_from inside deposit
    let commitment: felt252 = 0x456;
    start_cheat_caller_address(vault.contract_address, USER1());
    vault.deposit(commitment, 500_u256);
    stop_cheat_caller_address(vault.contract_address);
}

// ─── TEST 13: Commitment leaf retrieval
// ───────────────────────────────────────
#[test]
fn test_commitment_leaf_retrieval() {
    let sbtc = deploy_sbtc();
    let market = deploy_market_logic();
    let vault = deploy_vault(sbtc.contract_address, market.contract_address);

    start_cheat_caller_address(sbtc.contract_address, OWNER());
    sbtc.mint(USER1(), 1000_u256);
    stop_cheat_caller_address(sbtc.contract_address);

    start_cheat_caller_address(sbtc.contract_address, USER1());
    sbtc.approve(vault.contract_address, 1000_u256);
    stop_cheat_caller_address(sbtc.contract_address);

    let commitment: felt252 = 0x789;
    start_cheat_caller_address(vault.contract_address, USER1());
    vault.deposit(commitment, 500_u256);
    stop_cheat_caller_address(vault.contract_address);

    assert(vault.get_commitment(0) == commitment, 'Leaf 0 should be the commitment');
}

// ─── TEST 14: sBTC name, symbol, decimals
// ────────────────────────────────────
#[test]
fn test_sbtc_metadata() {
    let sbtc = deploy_sbtc();
    assert(sbtc.get_name() == 'Synthetic Bitcoin', 'Wrong name');
    assert(sbtc.get_symbol() == 'sBTC', 'Wrong symbol');
    assert(sbtc.get_decimals() == 8_u8, 'Wrong decimals');
}

// ─── TEST 15: sBTC approve and allowance
// ─────────────────────────────────────
#[test]
fn test_sbtc_approve_and_allowance() {
    let sbtc = deploy_sbtc();

    start_cheat_caller_address(sbtc.contract_address, USER1());
    sbtc.approve(USER2(), 750_u256);
    stop_cheat_caller_address(sbtc.contract_address);

    assert(sbtc.allowance(USER1(), USER2()) == 750_u256, 'Allowance should be 750');
}

// ─── TEST 16: sBTC transfer_from decrements allowance
// ────────────────────────
#[test]
fn test_sbtc_transfer_from() {
    let sbtc = deploy_sbtc();

    start_cheat_caller_address(sbtc.contract_address, OWNER());
    sbtc.mint(USER1(), 1000_u256);
    stop_cheat_caller_address(sbtc.contract_address);

    start_cheat_caller_address(sbtc.contract_address, USER1());
    sbtc.approve(USER2(), 500_u256);
    stop_cheat_caller_address(sbtc.contract_address);

    start_cheat_caller_address(sbtc.contract_address, USER2());
    sbtc.transfer_from(USER1(), USER2(), 300_u256);
    stop_cheat_caller_address(sbtc.contract_address);

    assert(sbtc.balance_of(USER1()) == 700_u256, 'USER1 should have 700');
    assert(sbtc.balance_of(USER2()) == 300_u256, 'USER2 should have 300');
    assert(sbtc.allowance(USER1(), USER2()) == 200_u256, 'Remaining allowance = 200');
}
