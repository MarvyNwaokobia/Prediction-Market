use btc_prediction_market::contracts::market_factory::{
    IMarketFactoryDispatcher, IMarketFactoryDispatcherTrait,
};
use btc_prediction_market::contracts::market_logic::{
    IMarketLogicDispatcher, IMarketLogicDispatcherTrait,
};
use btc_prediction_market::contracts::oracle_adapter::{
    IOracleAdapterDispatcher, IOracleAdapterDispatcherTrait,
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
fn VAULT() -> ContractAddress {
    0x99.try_into().unwrap()
}

fn deploy_market_logic() -> IMarketLogicDispatcher {
    let contract = declare("MarketLogic").unwrap().contract_class();
    let mut calldata = array![];
    OWNER().serialize(ref calldata);
    let (address, _) = contract.deploy(@calldata).unwrap();
    IMarketLogicDispatcher { contract_address: address }
}

fn deploy_factory(market_address: ContractAddress) -> IMarketFactoryDispatcher {
    let contract = declare("MarketFactory").unwrap().contract_class();
    let mut calldata = array![];
    OWNER().serialize(ref calldata);
    let (address, _) = contract.deploy(@calldata).unwrap();
    let factory = IMarketFactoryDispatcher { contract_address: address };

    start_cheat_caller_address(address, OWNER());
    factory
        .set_contracts(
            market_address,
            0x10.try_into().unwrap(),
            0x11.try_into().unwrap(),
            0x12.try_into().unwrap(),
        );
    stop_cheat_caller_address(address);
    factory
}

fn deploy_oracle(market_address: ContractAddress) -> IOracleAdapterDispatcher {
    let contract = declare("OracleAdapter").unwrap().contract_class();
    let mut calldata = array![];
    OWNER().serialize(ref calldata);
    let (address, _) = contract.deploy(@calldata).unwrap();
    let oracle = IOracleAdapterDispatcher { contract_address: address };

    start_cheat_caller_address(address, OWNER());
    oracle.set_market_contract(market_address);
    stop_cheat_caller_address(address);
    oracle
}

// ─── TEST 1: Factory creates market
// ──────────────────────────────────────────
#[test]
fn test_factory_creates_market() {
    let market = deploy_market_logic();
    let _factory = deploy_factory(market.contract_address);

    // Wire market to accept factory calls
    start_cheat_caller_address(market.contract_address, OWNER());
    market.set_vault_address(VAULT());
    stop_cheat_caller_address(market.contract_address);

    start_cheat_block_timestamp(market.contract_address, 100_u64);
    start_cheat_caller_address(market.contract_address, OWNER());
    let market_id = market.create_market('Will ETH flip BTC?', 9000_u64, 0_u256);
    stop_cheat_caller_address(market.contract_address);
    stop_cheat_block_timestamp(market.contract_address);

    assert(market_id == 0, 'Should be first market');
    let m = market.get_market(0);
    assert(m.question == 'Will ETH flip BTC?', 'Wrong question');
    assert(m.end_time == 9000_u64, 'Wrong end time');
}

// ─── TEST 2: Multiple markets
// ─────────────────────────────────────────────────
#[test]
fn test_multiple_markets() {
    let market = deploy_market_logic();

    start_cheat_block_timestamp(market.contract_address, 100_u64);
    start_cheat_caller_address(market.contract_address, OWNER());
    let id0 = market.create_market('BTC 100k by EOY?', 5000_u64, 0_u256);
    let id1 = market.create_market('Fed cuts rates?', 6000_u64, 0_u256);
    let id2 = market.create_market('ETF approved?', 7000_u64, 0_u256);
    stop_cheat_caller_address(market.contract_address);
    stop_cheat_block_timestamp(market.contract_address);

    assert(id0 == 0, 'First market id wrong');
    assert(id1 == 1, 'Second market id wrong');
    assert(id2 == 2, 'Third market id wrong');
    assert(market.get_market_count() == 3, 'Should have 3 markets');
}

// ─── TEST 3: Pool accounting
// ──────────────────────────────────────────────────
#[test]
fn test_pool_accounting() {
    let market = deploy_market_logic();

    start_cheat_caller_address(market.contract_address, OWNER());
    market.set_vault_address(VAULT());
    start_cheat_block_timestamp(market.contract_address, 100_u64);
    let market_id = market.create_market('BTC halving pump?', 5000_u64, 0_u256);
    stop_cheat_caller_address(market.contract_address);

    // Place bets from vault
    start_cheat_caller_address(market.contract_address, VAULT());
    market.record_shielded_bet(market_id, 1, 300_u256); // YES
    market.record_shielded_bet(market_id, 1, 200_u256); // YES
    market.record_shielded_bet(market_id, 0, 100_u256); // NO
    stop_cheat_caller_address(market.contract_address);
    stop_cheat_block_timestamp(market.contract_address);

    assert(market.get_yes_pool(market_id) == 500_u256, 'YES pool should be 500');
    assert(market.get_no_pool(market_id) == 100_u256, 'NO pool should be 100');
}

// ─── TEST 4: Oracle propose and finalize
// ──────────────────────────────────────
#[test]
fn test_oracle_propose_and_finalize() {
    let market = deploy_market_logic();
    let oracle = deploy_oracle(market.contract_address);

    // Wire oracle as authorized resolver in market
    start_cheat_caller_address(market.contract_address, OWNER());
    market.set_oracle_address(oracle.contract_address);
    market.set_vault_address(VAULT());
    start_cheat_block_timestamp(market.contract_address, 100_u64);
    let market_id = market.create_market('BTC above 80k?', 1000_u64, 0_u256);
    stop_cheat_caller_address(market.contract_address);
    stop_cheat_block_timestamp(market.contract_address);

    // Propose resolution at t=2000 (after market end)
    start_cheat_block_timestamp(oracle.contract_address, 2000_u64);
    start_cheat_caller_address(oracle.contract_address, OWNER());
    oracle.propose_resolution(market_id, 1); // YES wins
    stop_cheat_caller_address(oracle.contract_address);

    assert(oracle.get_proposed_outcome(market_id) == 1, 'Outcome should be YES');
    assert(oracle.get_resolution_status(market_id) == 1, 'Status should be PROPOSED');

    // Finalize after dispute window (86400 seconds later)
    stop_cheat_block_timestamp(oracle.contract_address);
    start_cheat_block_timestamp(oracle.contract_address, 2000_u64 + 86401_u64);
    start_cheat_block_timestamp(market.contract_address, 2000_u64 + 86401_u64);

    start_cheat_caller_address(oracle.contract_address, OWNER());
    oracle.finalize_resolution(market_id);
    stop_cheat_caller_address(oracle.contract_address);

    assert(oracle.get_resolution_status(market_id) == 3, 'Status should be FINALIZED');
    assert(market.get_winning_outcome(market_id) == 1, 'Market should show YES won');
}

// ─── TEST 5: Payout math correctness
// ─────────────────────────────────────────
#[test]
fn test_payout_math() {
    let market = deploy_market_logic();

    start_cheat_caller_address(market.contract_address, OWNER());
    market.set_vault_address(VAULT());
    start_cheat_block_timestamp(market.contract_address, 100_u64);
    // 200 initial liquidity = 100 YES + 100 NO
    let market_id = market.create_market('Payout test', 5000_u64, 200_u256);
    stop_cheat_caller_address(market.contract_address);

    // Add 100 more to YES pool
    start_cheat_caller_address(market.contract_address, VAULT());
    market.record_shielded_bet(market_id, 1, 100_u256);
    stop_cheat_caller_address(market.contract_address);
    stop_cheat_block_timestamp(market.contract_address);

    // YES pool = 200, NO pool = 100
    // Resolve YES wins
    start_cheat_block_timestamp(market.contract_address, 6000_u64);
    start_cheat_caller_address(market.contract_address, OWNER());
    market.resolve_market(market_id, 1);
    stop_cheat_caller_address(market.contract_address);
    stop_cheat_block_timestamp(market.contract_address);

    // Bet 100 on YES: payout = 100 + (100 * 100) / 200 = 100 + 50 = 150
    let payout = market.calculate_payout(market_id, 100_u256);
    assert(payout == 150_u256, 'Payout should be 150');
}

// ─── TEST 6: Cannot bet on resolved market
// ────────────────────────────────────
#[test]
#[should_panic(expected: 'Market already resolved')]
fn test_cannot_bet_on_resolved_market() {
    let market = deploy_market_logic();

    start_cheat_caller_address(market.contract_address, OWNER());
    market.set_vault_address(VAULT());
    start_cheat_block_timestamp(market.contract_address, 100_u64);
    let market_id = market.create_market('Resolved test', 1000_u64, 0_u256);
    stop_cheat_caller_address(market.contract_address);
    stop_cheat_block_timestamp(market.contract_address);

    start_cheat_block_timestamp(market.contract_address, 2000_u64);
    start_cheat_caller_address(market.contract_address, OWNER());
    market.resolve_market(market_id, 0);
    stop_cheat_caller_address(market.contract_address);

    // This should panic
    start_cheat_caller_address(market.contract_address, VAULT());
    market.record_shielded_bet(market_id, 1, 50_u256);
    stop_cheat_caller_address(market.contract_address);
    stop_cheat_block_timestamp(market.contract_address);
}

// ─── TEST 7: Only vault can record bets
// ───────────────────────────────────────
#[test]
#[should_panic(expected: 'Only vault can record bets')]
fn test_only_vault_can_record_bets() {
    let market = deploy_market_logic();

    start_cheat_caller_address(market.contract_address, OWNER());
    market.set_vault_address(VAULT());
    start_cheat_block_timestamp(market.contract_address, 100_u64);
    let market_id = market.create_market('Access control test', 5000_u64, 0_u256);
    stop_cheat_caller_address(market.contract_address);

    // USER1 tries to record bet directly — must be rejected
    start_cheat_caller_address(market.contract_address, USER1());
    market.record_shielded_bet(market_id, 1, 100_u256);
    stop_cheat_caller_address(market.contract_address);
    stop_cheat_block_timestamp(market.contract_address);
}

// ─── TEST 8: Cannot resolve market before end time
// ────────────────────────────
#[test]
#[should_panic(expected: 'Market not ended yet')]
fn test_cannot_resolve_before_end_time() {
    let market = deploy_market_logic();

    start_cheat_caller_address(market.contract_address, OWNER());
    market.set_vault_address(VAULT());
    start_cheat_block_timestamp(market.contract_address, 100_u64);
    let market_id = market.create_market('Early resolve test', 9999_u64, 0_u256);

    // Try to resolve while market is still live (t=100 < end=9999)
    market.resolve_market(market_id, 1);
    stop_cheat_caller_address(market.contract_address);
    stop_cheat_block_timestamp(market.contract_address);
}

// ─── TEST 9: Cannot resolve market twice
// ──────────────────────────────────────
#[test]
#[should_panic(expected: 'Already resolved')]
fn test_cannot_resolve_twice() {
    let market = deploy_market_logic();

    start_cheat_caller_address(market.contract_address, OWNER());
    market.set_vault_address(VAULT());
    start_cheat_block_timestamp(market.contract_address, 100_u64);
    let market_id = market.create_market('Double resolve test', 1000_u64, 0_u256);
    stop_cheat_caller_address(market.contract_address);
    stop_cheat_block_timestamp(market.contract_address);

    start_cheat_block_timestamp(market.contract_address, 2000_u64);
    start_cheat_caller_address(market.contract_address, OWNER());
    market.resolve_market(market_id, 1);
    // Second resolve must panic
    market.resolve_market(market_id, 0);
    stop_cheat_caller_address(market.contract_address);
    stop_cheat_block_timestamp(market.contract_address);
}

// ─── TEST 10: Oracle dispute flow
// ─────────────────────────────────────────────
// Verify that a disputed resolution cannot be finalized by a non-owner
// and that the owner can force-finalize after a dispute.
#[test]
fn test_oracle_dispute_then_owner_finalizes() {
    let market = deploy_market_logic();
    let oracle = deploy_oracle(market.contract_address);

    start_cheat_caller_address(market.contract_address, OWNER());
    market.set_oracle_address(oracle.contract_address);
    market.set_vault_address(VAULT());
    start_cheat_block_timestamp(market.contract_address, 100_u64);
    let market_id = market.create_market('Disputed market', 1000_u64, 0_u256);
    stop_cheat_caller_address(market.contract_address);
    stop_cheat_block_timestamp(market.contract_address);

    // Propose resolution at t=2000
    start_cheat_block_timestamp(oracle.contract_address, 2000_u64);
    start_cheat_caller_address(oracle.contract_address, OWNER());
    oracle.propose_resolution(market_id, 1);
    stop_cheat_caller_address(oracle.contract_address);
    assert(oracle.get_resolution_status(market_id) == 1, 'Should be PROPOSED');

    // USER1 disputes within the window
    start_cheat_caller_address(oracle.contract_address, USER1());
    oracle.dispute_resolution(market_id);
    stop_cheat_caller_address(oracle.contract_address);
    stop_cheat_block_timestamp(oracle.contract_address);
    assert(oracle.get_resolution_status(market_id) == 2, 'Should be DISPUTED');

    // Owner force-finalizes the dispute
    start_cheat_block_timestamp(oracle.contract_address, 3000_u64);
    start_cheat_block_timestamp(market.contract_address, 3000_u64);
    start_cheat_caller_address(oracle.contract_address, OWNER());
    oracle.finalize_resolution(market_id);
    stop_cheat_caller_address(oracle.contract_address);
    stop_cheat_block_timestamp(oracle.contract_address);
    stop_cheat_block_timestamp(market.contract_address);

    assert(oracle.get_resolution_status(market_id) == 3, 'Should be FINALIZED');
    assert(market.get_winning_outcome(market_id) == 1, 'YES should win');
}

// ─── TEST 11: Cannot dispute after window closes
// ──────────────────────────────
#[test]
#[should_panic(expected: 'Dispute window has closed')]
fn test_cannot_dispute_after_window() {
    let market = deploy_market_logic();
    let oracle = deploy_oracle(market.contract_address);

    start_cheat_caller_address(market.contract_address, OWNER());
    market.set_oracle_address(oracle.contract_address);
    market.set_vault_address(VAULT());
    start_cheat_block_timestamp(market.contract_address, 100_u64);
    let market_id = market.create_market('Window test', 1000_u64, 0_u256);
    stop_cheat_caller_address(market.contract_address);
    stop_cheat_block_timestamp(market.contract_address);

    // Propose at t=2000
    start_cheat_block_timestamp(oracle.contract_address, 2000_u64);
    start_cheat_caller_address(oracle.contract_address, OWNER());
    oracle.propose_resolution(market_id, 0);
    stop_cheat_caller_address(oracle.contract_address);
    stop_cheat_block_timestamp(oracle.contract_address);

    // Attempt to dispute AFTER the 24h window (t = 2000 + 86401)
    start_cheat_block_timestamp(oracle.contract_address, 2000_u64 + 86401_u64);
    start_cheat_caller_address(oracle.contract_address, USER1());
    oracle.dispute_resolution(market_id);
    stop_cheat_caller_address(oracle.contract_address);
    stop_cheat_block_timestamp(oracle.contract_address);
}

// ─── TEST 12: Factory all-markets enumeration
// ─────────────────────────────────
#[test]
fn test_factory_all_markets() {
    let market = deploy_market_logic();
    let factory = deploy_factory(market.contract_address);

    start_cheat_caller_address(market.contract_address, OWNER());
    market.set_vault_address(VAULT());
    stop_cheat_caller_address(market.contract_address);

    start_cheat_block_timestamp(market.contract_address, 100_u64);
    start_cheat_block_timestamp(factory.contract_address, 100_u64);

    start_cheat_caller_address(factory.contract_address, OWNER());
    factory.create_market('Market A', 5000_u64);
    factory.create_market('Market B', 6000_u64);
    factory.create_market('Market C', 7000_u64);
    stop_cheat_caller_address(factory.contract_address);

    stop_cheat_block_timestamp(factory.contract_address);
    stop_cheat_block_timestamp(market.contract_address);

    let all = factory.get_all_markets();
    assert(all.len() == 3, 'Should enumerate 3 markets');
}

// ─── TEST 13: Zero payout when winning pool is empty
// ─────────────────────────
#[test]
fn test_payout_empty_winning_pool() {
    let market = deploy_market_logic();

    start_cheat_caller_address(market.contract_address, OWNER());
    market.set_vault_address(VAULT());
    start_cheat_block_timestamp(market.contract_address, 100_u64);
    // No initial liquidity, no bets — empty pools
    let market_id = market.create_market('Empty pool test', 1000_u64, 0_u256);
    stop_cheat_caller_address(market.contract_address);
    stop_cheat_block_timestamp(market.contract_address);

    start_cheat_block_timestamp(market.contract_address, 2000_u64);
    start_cheat_caller_address(market.contract_address, OWNER());
    market.resolve_market(market_id, 1);
    stop_cheat_caller_address(market.contract_address);
    stop_cheat_block_timestamp(market.contract_address);

    // YES pool is 0, payout should be 0
    let payout = market.calculate_payout(market_id, 100_u256);
    assert(payout == 0_u256, 'Payout must be 0 empty pool');
}
