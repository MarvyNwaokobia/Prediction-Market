use starknet::ContractAddress;

#[starknet::interface]
pub trait IOracleAdapter<TContractState> {
    fn propose_resolution(ref self: TContractState, market_id: u64, outcome: u8);
    fn dispute_resolution(ref self: TContractState, market_id: u64);
    fn finalize_resolution(ref self: TContractState, market_id: u64);
    fn get_proposed_outcome(self: @TContractState, market_id: u64) -> u8;
    fn get_resolution_status(self: @TContractState, market_id: u64) -> u8;
    fn set_market_contract(ref self: TContractState, market_contract: ContractAddress);
    fn set_dispute_window(ref self: TContractState, window: u64);
}

#[starknet::contract]
pub mod OracleAdapter {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess,
        Map, StorageMapReadAccess, StorageMapWriteAccess
    };
    use btc_prediction_market::contracts::market_logic::{IMarketLogicDispatcher, IMarketLogicDispatcherTrait};

    // Resolution status codes
    const STATUS_NONE: u8 = 0;
    const STATUS_PROPOSED: u8 = 1;
    const STATUS_DISPUTED: u8 = 2;
    const STATUS_FINALIZED: u8 = 3;

    // Default dispute window: 24 hours
    const DEFAULT_DISPUTE_WINDOW: u64 = 86400;

    #[storage]
    struct Storage {
        owner: ContractAddress,
        market_contract: ContractAddress,
        dispute_window: u64,

        // Per market resolution state
        proposed_outcome: Map<u64, u8>,
        proposal_time: Map<u64, u64>,
        resolution_status: Map<u64, u8>,
        proposer: Map<u64, ContractAddress>,
        disputed_by: Map<u64, ContractAddress>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        ResolutionProposed: ResolutionProposed,
        ResolutionDisputed: ResolutionDisputed,
        ResolutionFinalized: ResolutionFinalized,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ResolutionProposed {
        #[key]
        pub market_id: u64,
        pub outcome: u8,
        pub proposer: ContractAddress,
        pub finalize_after: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ResolutionDisputed {
        #[key]
        pub market_id: u64,
        pub disputed_by: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ResolutionFinalized {
        #[key]
        pub market_id: u64,
        pub outcome: u8,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        self.owner.write(owner);
        self.dispute_window.write(DEFAULT_DISPUTE_WINDOW);
    }

    #[abi(embed_v0)]
    impl OracleAdapterImpl of super::IOracleAdapter<ContractState> {

        // ─── PROPOSE RESOLUTION ────────────────────────────────────────────────
        // Owner or authorized resolver proposes an outcome.
        // Starts the dispute window countdown.
        fn propose_resolution(ref self: ContractState, market_id: u64, outcome: u8) {
            let caller = get_caller_address();
            assert(caller == self.owner.read(), 'Only owner can propose');
            assert(outcome == 0 || outcome == 1, 'Invalid outcome');
            assert(
                self.resolution_status.read(market_id) == STATUS_NONE ||
                self.resolution_status.read(market_id) == STATUS_DISPUTED,
                'Already proposed or finalized'
            );

            let now = get_block_timestamp();
            let finalize_after = now + self.dispute_window.read();

            self.proposed_outcome.write(market_id, outcome);
            self.proposal_time.write(market_id, now);
            self.resolution_status.write(market_id, STATUS_PROPOSED);
            self.proposer.write(market_id, caller);

            self.emit(ResolutionProposed {
                market_id,
                outcome,
                proposer: caller,
                finalize_after,
            });
        }

        // ─── DISPUTE RESOLUTION ────────────────────────────────────────────────
        // Anyone can dispute within the window.
        // Escalates to owner arbitration.
        fn dispute_resolution(ref self: ContractState, market_id: u64) {
            let caller = get_caller_address();
            assert(
                self.resolution_status.read(market_id) == STATUS_PROPOSED,
                'No active proposal to dispute'
            );

            let proposal_time = self.proposal_time.read(market_id);
            let now = get_block_timestamp();
            assert(
                now < proposal_time + self.dispute_window.read(),
                'Dispute window has closed'
            );

            self.resolution_status.write(market_id, STATUS_DISPUTED);
            self.disputed_by.write(market_id, caller);

            self.emit(ResolutionDisputed { market_id, disputed_by: caller });
        }

        // ─── FINALIZE RESOLUTION ───────────────────────────────────────────────
        // After dispute window passes with no dispute → finalize.
        // If disputed → only owner can force finalize (arbitration).
        fn finalize_resolution(ref self: ContractState, market_id: u64) {
            let status = self.resolution_status.read(market_id);
            assert(
                status == STATUS_PROPOSED || status == STATUS_DISPUTED,
                'Nothing to finalize'
            );

            let now = get_block_timestamp();
            let proposal_time = self.proposal_time.read(market_id);
            let caller = get_caller_address();

            if status == STATUS_DISPUTED {
                // Only owner can resolve a dispute
                assert(caller == self.owner.read(), 'Only owner resolves disputes');
            } else {
                // Anyone can finalize after window passes
                assert(
                    now >= proposal_time + self.dispute_window.read(),
                    'Dispute window still open'
                );
            }

            let outcome = self.proposed_outcome.read(market_id);
            self.resolution_status.write(market_id, STATUS_FINALIZED);

            // Push result to market contract
            let market = IMarketLogicDispatcher {
                contract_address: self.market_contract.read()
            };
            market.resolve_market(market_id, outcome);

            self.emit(ResolutionFinalized { market_id, outcome });
        }

        // ─── VIEWS ─────────────────────────────────────────────────────────────
        fn get_proposed_outcome(self: @ContractState, market_id: u64) -> u8 {
            self.proposed_outcome.read(market_id)
        }

        fn get_resolution_status(self: @ContractState, market_id: u64) -> u8 {
            self.resolution_status.read(market_id)
        }

        // ─── ADMIN ─────────────────────────────────────────────────────────────
        fn set_market_contract(ref self: ContractState, market_contract: ContractAddress) {
            assert(get_caller_address() == self.owner.read(), 'Only owner');
            self.market_contract.write(market_contract);
        }

        fn set_dispute_window(ref self: ContractState, window: u64) {
            assert(get_caller_address() == self.owner.read(), 'Only owner');
            assert(window >= 3600, 'Minimum 1 hour window');
            self.dispute_window.write(window);
        }
    }
}
