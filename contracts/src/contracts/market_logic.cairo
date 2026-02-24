use starknet::ContractAddress;

#[starknet::interface]
pub trait IMarketLogic<TContractState> {
    // Market creation
    fn create_market(ref self: TContractState, question: felt252, end_time: u64, initial_liquidity: u256) -> u64;
    // Called by vault only
    fn record_shielded_bet(ref self: TContractState, market_id: u64, outcome: u8, amount: u256);
    // Resolution
    fn resolve_market(ref self: TContractState, market_id: u64, winning_outcome: u8);
    // Payout calculation
    fn calculate_payout(self: @TContractState, market_id: u64, bet_amount: u256) -> u256;
    // Views
    fn get_winning_outcome(self: @TContractState, market_id: u64) -> u8;
    fn get_market(self: @TContractState, market_id: u64) -> Market;
    fn get_market_count(self: @TContractState) -> u64;
    fn get_yes_pool(self: @TContractState, market_id: u64) -> u256;
    fn get_no_pool(self: @TContractState, market_id: u64) -> u256;
    // Admin
    fn set_vault_address(ref self: TContractState, vault: ContractAddress);
    fn set_oracle_address(ref self: TContractState, oracle: ContractAddress);
}

#[derive(Drop, Serde, starknet::Store)]
pub struct Market {
    pub id: u64,
    pub question: felt252,
    pub end_time: u64,
    pub resolved: bool,
    pub winning_outcome: u8,       // 0 = NO, 1 = YES, 2 = unresolved
    pub yes_pool: u256,            // total sBTC bet on YES
    pub no_pool: u256,             // total sBTC bet on NO
    pub total_liquidity: u256,     // initial liquidity added
    pub creator: ContractAddress,
}

#[starknet::contract]
pub mod MarketLogic {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess,
        Map, StorageMapReadAccess, StorageMapWriteAccess
    };
    use super::Market;

    #[storage]
    struct Storage {
        owner: ContractAddress,
        vault_address: ContractAddress,
        oracle_address: ContractAddress,

        // Markets
        markets: Map<u64, Market>,
        market_count: u64,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        MarketCreated: MarketCreated,
        BetRecorded: BetRecorded,
        MarketResolved: MarketResolved,
    }

    #[derive(Drop, starknet::Event)]
    pub struct MarketCreated {
        #[key]
        pub market_id: u64,
        pub question: felt252,
        pub end_time: u64,
        pub creator: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct BetRecorded {
        #[key]
        pub market_id: u64,
        pub outcome: u8,
        pub amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct MarketResolved {
        #[key]
        pub market_id: u64,
        pub winning_outcome: u8,
        pub yes_pool: u256,
        pub no_pool: u256,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        self.owner.write(owner);
        self.market_count.write(0);
    }

    #[abi(embed_v0)]
    impl MarketLogicImpl of super::IMarketLogic<ContractState> {

        // ─── CREATE MARKET ─────────────────────────────────────────────────────
        fn create_market(
            ref self: ContractState,
            question: felt252,
            end_time: u64,
            initial_liquidity: u256,
        ) -> u64 {
            assert(question != 0, 'Question cannot be empty');
            let now = get_block_timestamp();
            assert(end_time > now, 'End time must be in future');

            let market_id = self.market_count.read();
            let caller = get_caller_address();

            let market = Market {
                id: market_id,
                question,
                end_time,
                resolved: false,
                winning_outcome: 2,   // 2 = unresolved
                yes_pool: initial_liquidity / 2,
                no_pool: initial_liquidity / 2,
                total_liquidity: initial_liquidity,
                creator: caller,
            };

            self.markets.write(market_id, market);
            self.market_count.write(market_id + 1);

            self.emit(MarketCreated { market_id, question, end_time, creator: caller });

            market_id
        }

        // ─── RECORD SHIELDED BET ───────────────────────────────────────────────
        // Only callable by the vault — preserves privacy separation
        fn record_shielded_bet(
            ref self: ContractState,
            market_id: u64,
            outcome: u8,
            amount: u256,
        ) {
            let caller = get_caller_address();
            assert(caller == self.vault_address.read(), 'Only vault can record bets');

            let mut market = self.markets.read(market_id);
            assert(!market.resolved, 'Market already resolved');
            assert(get_block_timestamp() < market.end_time, 'Market has ended');
            assert(outcome == 0 || outcome == 1, 'Invalid outcome');

            // Update pool
            if outcome == 1 {
                market.yes_pool = market.yes_pool + amount;
            } else {
                market.no_pool = market.no_pool + amount;
            }

            self.markets.write(market_id, market);
            self.emit(BetRecorded { market_id, outcome, amount });
        }

        // ─── RESOLVE MARKET ────────────────────────────────────────────────────
        fn resolve_market(ref self: ContractState, market_id: u64, winning_outcome: u8) {
            let caller = get_caller_address();
            assert(
                caller == self.owner.read() || caller == self.oracle_address.read(),
                'Only owner or oracle'
            );
            assert(winning_outcome == 0 || winning_outcome == 1, 'Invalid outcome');

            let mut market = self.markets.read(market_id);
            assert(!market.resolved, 'Already resolved');

            let now = get_block_timestamp();
            assert(now >= market.end_time, 'Market not ended yet');

            market.resolved = true;
            market.winning_outcome = winning_outcome;
            let yes_pool = market.yes_pool;
            let no_pool = market.no_pool;
            self.markets.write(market_id, market);

            self.emit(MarketResolved {
                market_id,
                winning_outcome,
                yes_pool,
                no_pool,
            });
        }

        // ─── CALCULATE PAYOUT ──────────────────────────────────────────────────
        // Fixed-pool model: winners split the losing pool proportionally
        // payout = bet_amount + (bet_amount / winning_pool) * losing_pool
        fn calculate_payout(self: @ContractState, market_id: u64, bet_amount: u256) -> u256 {
            let market = self.markets.read(market_id);
            assert(market.resolved, 'Market not resolved');

            let winning_pool = if market.winning_outcome == 1 {
                market.yes_pool
            } else {
                market.no_pool
            };

            let losing_pool = if market.winning_outcome == 1 {
                market.no_pool
            } else {
                market.yes_pool
            };

            if winning_pool == 0 {
                return 0;
            }

            // proportional share of losing pool + original stake back
            // payout = bet + (bet * losing_pool) / winning_pool
            let winnings = (bet_amount * losing_pool) / winning_pool;
            bet_amount + winnings
        }

        // ─── VIEWS ─────────────────────────────────────────────────────────────
        fn get_winning_outcome(self: @ContractState, market_id: u64) -> u8 {
            let market = self.markets.read(market_id);
            assert(market.resolved, 'Market not resolved');
            market.winning_outcome
        }

        fn get_market(self: @ContractState, market_id: u64) -> Market {
            self.markets.read(market_id)
        }

        fn get_market_count(self: @ContractState) -> u64 {
            self.market_count.read()
        }

        fn get_yes_pool(self: @ContractState, market_id: u64) -> u256 {
            self.markets.read(market_id).yes_pool
        }

        fn get_no_pool(self: @ContractState, market_id: u64) -> u256 {
            self.markets.read(market_id).no_pool
        }

        // ─── ADMIN ─────────────────────────────────────────────────────────────
        fn set_vault_address(ref self: ContractState, vault: ContractAddress) {
            assert(get_caller_address() == self.owner.read(), 'Only owner');
            self.vault_address.write(vault);
        }

        fn set_oracle_address(ref self: ContractState, oracle: ContractAddress) {
            assert(get_caller_address() == self.owner.read(), 'Only owner');
            self.oracle_address.write(oracle);
        }
    }
}
