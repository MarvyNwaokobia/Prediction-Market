use btc_prediction_market::contracts::market_logic::Market;

/// IMarket — public interface for the MarketLogic contract
/// Binary prediction markets with fixed-pool pricing.
/// All bet recording is done through the ShieldedVault only.
pub trait IMarket<TContractState> {
    /// Create a new binary YES/NO market.
    fn create_market(ref self: TContractState, question: felt252, end_time: u64, initial_liquidity: u256) -> u64;

    /// Record an anonymous bet — only callable by ShieldedVault.
    fn record_shielded_bet(ref self: TContractState, market_id: u64, outcome: u8, amount: u256);

    /// Resolve market with winning outcome. Called by oracle.
    fn resolve_market(ref self: TContractState, market_id: u64, winning_outcome: u8);

    /// Calculate proportional payout for a winning bet amount.
    fn calculate_payout(self: @TContractState, market_id: u64, bet_amount: u256) -> u256;

    /// Get the winning outcome of a resolved market.
    fn get_winning_outcome(self: @TContractState, market_id: u64) -> u8;

    /// Get full market data.
    fn get_market(self: @TContractState, market_id: u64) -> Market;

    /// Get total number of markets.
    fn get_market_count(self: @TContractState) -> u64;
}
