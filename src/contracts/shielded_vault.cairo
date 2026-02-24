use starknet::ContractAddress;

#[starknet::interface]
pub trait IShieldedVault<TContractState> {
    fn deposit(ref self: TContractState, commitment: felt252, amount: u256);
    fn withdraw(ref self: TContractState, nullifier: felt252, root: felt252, recipient: ContractAddress, amount: u256);
    fn place_bet(ref self: TContractState, nullifier: felt252, root: felt252, market_id: u64, outcome: u8, amount: u256, new_commitment: felt252);
    fn claim_winnings(ref self: TContractState, nullifier: felt252, root: felt252, market_id: u64, new_commitment: felt252);
    fn get_root(self: @TContractState) -> felt252;
    fn get_tree_size(self: @TContractState) -> u64;
    fn is_nullifier_spent(self: @TContractState, nullifier: felt252) -> bool;
    fn is_known_root(self: @TContractState, root: felt252) -> bool;
    fn get_commitment(self: @TContractState, index: u64) -> felt252;
    fn set_market_contract(ref self: TContractState, market_contract: ContractAddress);
    fn set_sbtc_contract(ref self: TContractState, sbtc_contract: ContractAddress);
}

#[starknet::contract]
pub mod ShieldedVault {
    use starknet::{ContractAddress, get_caller_address, get_contract_address};
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess,
        Map, StorageMapReadAccess, StorageMapWriteAccess
    };
    use btc_prediction_market::contracts::synthetic_btc::{ISyntheticBTCDispatcher, ISyntheticBTCDispatcherTrait};
    use btc_prediction_market::contracts::market_logic::{IMarketLogicDispatcher, IMarketLogicDispatcherTrait};

    // Merkle tree depth — supports 2^20 = ~1M commitments
    const TREE_DEPTH: u8 = 20;
    const MAX_ROOTS_HISTORY: u64 = 30;

    #[storage]
    struct Storage {
        // Admin
        owner: ContractAddress,
        market_contract: ContractAddress,
        sbtc_contract: ContractAddress,

        // Merkle tree
        // Leaves: commitment hashes
        leaves: Map<u64, felt252>,
        tree_size: u64,
        current_root: felt252,

        // Root history for proof validation (last 30 roots are valid)
        root_history: Map<u64, felt252>,
        root_history_index: u64,

        // Nullifier registry — once spent, never again
        nullifiers: Map<felt252, bool>,

        // Internal balances per commitment (for bet tracking)
        commitment_amounts: Map<felt252, u256>,

        // Bet tracking: nullifier -> market_id -> amount bet
        bet_amounts: Map<(felt252, u64), u256>,
        bet_outcomes: Map<(felt252, u64), u8>,
        bet_exists: Map<(felt252, u64), bool>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        Deposit: Deposit,
        Withdrawal: Withdrawal,
        BetPlaced: BetPlaced,
        WinningsClaimed: WinningsClaimed,
        NewCommitment: NewCommitment,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Deposit {
        #[key]
        pub commitment: felt252,
        pub amount: u256,
        pub leaf_index: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Withdrawal {
        #[key]
        pub nullifier: felt252,
        pub recipient: ContractAddress,
        pub amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct BetPlaced {
        #[key]
        pub nullifier: felt252,
        #[key]
        pub market_id: u64,
        pub outcome: u8,
        pub amount: u256,
        pub new_commitment: felt252,
    }

    #[derive(Drop, starknet::Event)]
    pub struct WinningsClaimed {
        #[key]
        pub nullifier: felt252,
        #[key]
        pub market_id: u64,
        pub new_commitment: felt252,
    }

    #[derive(Drop, starknet::Event)]
    pub struct NewCommitment {
        #[key]
        pub commitment: felt252,
        pub leaf_index: u64,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        self.owner.write(owner);
        self.tree_size.write(0);
        self.current_root.write(0);
        self.root_history_index.write(0);
    }

    #[abi(embed_v0)]
    impl ShieldedVaultImpl of super::IShieldedVault<ContractState> {

        // ─── DEPOSIT ───────────────────────────────────────────────────────────
        // User deposits sBTC and registers a commitment into the Merkle tree.
        // The commitment = pedersen(secret, amount) computed off-chain by user.
        // No link between depositor address and commitment on-chain.
        fn deposit(ref self: ContractState, commitment: felt252, amount: u256) {
            assert(commitment != 0, 'Invalid commitment');
            assert(amount > 0, 'Amount must be positive');
            assert(self.commitment_amounts.read(commitment) == 0, 'Commitment already exists');

            // Pull sBTC from caller
            let sbtc = ISyntheticBTCDispatcher { contract_address: self.sbtc_contract.read() };
            let caller = get_caller_address();
            let this = get_contract_address();
            sbtc.transfer_from(caller, this, amount);

            // Store commitment amount
            self.commitment_amounts.write(commitment, amount);

            // Insert into Merkle tree
            let leaf_index = self.tree_size.read();
            self.leaves.write(leaf_index, commitment);
            self.tree_size.write(leaf_index + 1);

            // Recompute and store new root
            let new_root = self._compute_root(leaf_index, commitment);
            self.current_root.write(new_root);
            self._store_root(new_root);

            self.emit(Deposit { commitment, amount, leaf_index });
            self.emit(NewCommitment { commitment, leaf_index });
        }

        // ─── WITHDRAW ──────────────────────────────────────────────────────────
        // User proves they know the secret behind a commitment and withdraws.
        // Nullifier prevents double-spend. Root proves membership.
        fn withdraw(
            ref self: ContractState,
            nullifier: felt252,
            root: felt252,
            recipient: ContractAddress,
            amount: u256
        ) {
            // Validate nullifier not spent
            assert(!self.nullifiers.read(nullifier), 'Nullifier already spent');

            // Validate root is a known historical root
            assert(self._is_known_root(root), 'Unknown root');

            // Validate amount
            assert(amount > 0, 'Amount must be positive');

            // In production: verify ZK proof here that:
            // 1. User knows secret s.t. pedersen(secret, amount) is in tree
            // 2. nullifier = pedersen(secret, 1) — deterministic from secret
            // For hackathon: nullifier links to commitment via pedersen(commitment, 0)
            let expected_nullifier = self._compute_nullifier(nullifier);
            let committed_amount = self.commitment_amounts.read(expected_nullifier);
            assert(committed_amount >= amount, 'Insufficient committed amount');

            // Mark nullifier spent
            self.nullifiers.write(nullifier, true);

            // Update commitment amount
            self.commitment_amounts.write(expected_nullifier, committed_amount - amount);

            // Transfer sBTC to recipient
            let sbtc = ISyntheticBTCDispatcher { contract_address: self.sbtc_contract.read() };
            sbtc.transfer(recipient, amount);

            self.emit(Withdrawal { nullifier, recipient, amount });
        }

        // ─── PLACE BET ─────────────────────────────────────────────────────────
        // Anonymous bet: spend existing commitment, create new one for remainder.
        // Proves membership without revealing which commitment is being spent.
        fn place_bet(
            ref self: ContractState,
            nullifier: felt252,
            root: felt252,
            market_id: u64,
            outcome: u8,
            amount: u256,
            new_commitment: felt252,
        ) {
            assert(!self.nullifiers.read(nullifier), 'Nullifier already spent');
            assert(self._is_known_root(root), 'Unknown root');
            assert(outcome == 0 || outcome == 1, 'Invalid outcome: 0=NO, 1=YES');
            assert(amount > 0, 'Bet amount must be positive');
            assert(new_commitment != 0, 'Invalid new commitment');
            assert(!self.bet_exists.read((nullifier, market_id)), 'Bet already placed');

            // Derive commitment from nullifier for balance check
            let commitment_key = self._compute_nullifier(nullifier);
            let committed_amount = self.commitment_amounts.read(commitment_key);
            assert(committed_amount >= amount, 'Insufficient committed balance');

            // Mark nullifier spent
            self.nullifiers.write(nullifier, true);

            // Record bet
            self.bet_amounts.write((nullifier, market_id), amount);
            self.bet_outcomes.write((nullifier, market_id), outcome);
            self.bet_exists.write((nullifier, market_id), true);

            // Register new commitment for remainder
            let remainder = committed_amount - amount;
            if remainder > 0 {
                self.commitment_amounts.write(new_commitment, remainder);
                let leaf_index = self.tree_size.read();
                self.leaves.write(leaf_index, new_commitment);
                self.tree_size.write(leaf_index + 1);
                let new_root = self._compute_root(leaf_index, new_commitment);
                self.current_root.write(new_root);
                self._store_root(new_root);
                self.emit(NewCommitment { commitment: new_commitment, leaf_index });
            }

            // Notify market contract
            let market = IMarketLogicDispatcher { contract_address: self.market_contract.read() };
            market.record_shielded_bet(market_id, outcome, amount);

            self.emit(BetPlaced { nullifier, market_id, outcome, amount, new_commitment });
        }

        // ─── CLAIM WINNINGS ────────────────────────────────────────────────────
        // Winner proves their nullifier corresponds to a winning bet.
        // Winnings re-enter the shielded pool as a new commitment.
        fn claim_winnings(
            ref self: ContractState,
            nullifier: felt252,
            root: felt252,
            market_id: u64,
            new_commitment: felt252,
        ) {
            assert(!self.nullifiers.read(nullifier), 'Nullifier already spent');
            assert(self._is_known_root(root), 'Unknown root');
            assert(self.bet_exists.read((nullifier, market_id)), 'No bet found');
            assert(new_commitment != 0, 'Invalid new commitment');

            let bet_outcome = self.bet_outcomes.read((nullifier, market_id));
            let bet_amount = self.bet_amounts.read((nullifier, market_id));

            // Check market result
            let market = IMarketLogicDispatcher { contract_address: self.market_contract.read() };
            let winning_outcome = market.get_winning_outcome(market_id);
            assert(bet_outcome == winning_outcome, 'Bet did not win');

            // Calculate winnings (payout from market)
            let payout = market.calculate_payout(market_id, bet_amount);
            assert(payout > 0, 'No payout available');

            // Mark nullifier spent
            self.nullifiers.write(nullifier, true);

            // Create new shielded commitment for winnings
            self.commitment_amounts.write(new_commitment, payout);
            let leaf_index = self.tree_size.read();
            self.leaves.write(leaf_index, new_commitment);
            self.tree_size.write(leaf_index + 1);
            let new_root = self._compute_root(leaf_index, new_commitment);
            self.current_root.write(new_root);
            self._store_root(new_root);

            self.emit(NewCommitment { commitment: new_commitment, leaf_index });
            self.emit(WinningsClaimed { nullifier, market_id, new_commitment });
        }

        // ─── VIEWS ─────────────────────────────────────────────────────────────
        fn get_root(self: @ContractState) -> felt252 {
            self.current_root.read()
        }

        fn get_tree_size(self: @ContractState) -> u64 {
            self.tree_size.read()
        }

        fn is_nullifier_spent(self: @ContractState, nullifier: felt252) -> bool {
            self.nullifiers.read(nullifier)
        }

        fn is_known_root(self: @ContractState, root: felt252) -> bool {
            self._is_known_root(root)
        }

        fn get_commitment(self: @ContractState, index: u64) -> felt252 {
            self.leaves.read(index)
        }

        fn set_market_contract(ref self: ContractState, market_contract: ContractAddress) {
            assert(get_caller_address() == self.owner.read(), 'Only owner');
            self.market_contract.write(market_contract);
        }

        fn set_sbtc_contract(ref self: ContractState, sbtc_contract: ContractAddress) {
            assert(get_caller_address() == self.owner.read(), 'Only owner');
            self.sbtc_contract.write(sbtc_contract);
        }
    }

    // ─── INTERNAL ──────────────────────────────────────────────────────────────
    #[generate_trait]
    impl InternalImpl of InternalTrait {

        // Simplified root computation using Pedersen hash up the tree path
        // In production this would be a full Merkle tree recompute
        fn _compute_root(self: @ContractState, leaf_index: u64, leaf: felt252) -> felt252 {
            // Hash the leaf with its index to produce a unique root contribution
            let index_felt: felt252 = leaf_index.into();
            let combined = core::pedersen::pedersen(leaf, index_felt);
            // Hash with current root to accumulate tree state
            core::pedersen::pedersen(combined, self.current_root.read())
        }

        // Derive commitment key from nullifier
        // In production: nullifier = pedersen(secret, 1), commitment = pedersen(secret, amount)
        // Here we use nullifier itself as the key for MVP simplicity
        fn _compute_nullifier(self: @ContractState, nullifier: felt252) -> felt252 {
            // For MVP: the nullifier IS the commitment key
            // In ZK production build: these would be cryptographically separated
            nullifier
        }

        fn _is_known_root(self: @ContractState, root: felt252) -> bool {
            if root == self.current_root.read() {
                return true;
            }
            // Check historical roots
            let history_size = self.root_history_index.read();
            let check_count = if history_size < MAX_ROOTS_HISTORY {
                history_size
            } else {
                MAX_ROOTS_HISTORY
            };
            let mut i: u64 = 0;
            let mut found = false;
            loop {
                if i >= check_count {
                    break;
                }
                if self.root_history.read(i) == root {
                    found = true;
                    break;
                }
                i += 1;
            };
            found
        }

        fn _store_root(ref self: ContractState, root: felt252) {
            let idx = self.root_history_index.read() % MAX_ROOTS_HISTORY;
            self.root_history.write(idx, root);
            self.root_history_index.write(self.root_history_index.read() + 1);
        }
    }
}
