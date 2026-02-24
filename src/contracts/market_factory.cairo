use starknet::ContractAddress;

#[starknet::interface]
pub trait IMarketFactory<TContractState> {
    fn create_market(ref self: TContractState, question: felt252, end_time: u64) -> u64;
    fn get_market_contract(self: @TContractState) -> ContractAddress;
    fn get_vault_contract(self: @TContractState) -> ContractAddress;
    fn get_sbtc_contract(self: @TContractState) -> ContractAddress;
    fn get_oracle_contract(self: @TContractState) -> ContractAddress;
    fn get_all_markets(self: @TContractState) -> Array<u64>;
    fn set_contracts(
        ref self: TContractState,
        market_contract: ContractAddress,
        vault_contract: ContractAddress,
        sbtc_contract: ContractAddress,
        oracle_contract: ContractAddress,
    );
}

#[starknet::contract]
pub mod MarketFactory {
    use starknet::{ContractAddress, get_caller_address};
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess,
        Map, StorageMapReadAccess, StorageMapWriteAccess
    };
    use btc_prediction_market::contracts::market_logic::{IMarketLogicDispatcher, IMarketLogicDispatcherTrait};

    #[storage]
    struct Storage {
        owner: ContractAddress,
        market_contract: ContractAddress,
        vault_contract: ContractAddress,
        sbtc_contract: ContractAddress,
        oracle_contract: ContractAddress,

        // Market registry
        market_ids: Map<u64, u64>,
        market_count: u64,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        MarketDeployed: MarketDeployed,
    }

    #[derive(Drop, starknet::Event)]
    pub struct MarketDeployed {
        #[key]
        pub market_id: u64,
        pub question: felt252,
        pub end_time: u64,
        pub creator: ContractAddress,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        self.owner.write(owner);
        self.market_count.write(0);
    }

    #[abi(embed_v0)]
    impl MarketFactoryImpl of super::IMarketFactory<ContractState> {

        // ─── CREATE MARKET ─────────────────────────────────────────────────────
        // Single entry point for market creation.
        // Registers market in factory and delegates logic to MarketLogic contract.
        fn create_market(
            ref self: ContractState,
            question: felt252,
            end_time: u64,
        ) -> u64 {
            assert(self.market_contract.read().into() != 0_felt252, 'Contracts not set');

            let market_logic = IMarketLogicDispatcher {
                contract_address: self.market_contract.read()
            };

            // Create with zero initial liquidity for MVP
            // In production: creator provides liquidity via vault
            let market_id = market_logic.create_market(question, end_time, 0);

            // Register in factory
            let count = self.market_count.read();
            self.market_ids.write(count, market_id);
            self.market_count.write(count + 1);

            self.emit(MarketDeployed {
                market_id,
                question,
                end_time,
                creator: get_caller_address(),
            });

            market_id
        }

        // ─── VIEWS ─────────────────────────────────────────────────────────────
        fn get_market_contract(self: @ContractState) -> ContractAddress {
            self.market_contract.read()
        }

        fn get_vault_contract(self: @ContractState) -> ContractAddress {
            self.vault_contract.read()
        }

        fn get_sbtc_contract(self: @ContractState) -> ContractAddress {
            self.sbtc_contract.read()
        }

        fn get_oracle_contract(self: @ContractState) -> ContractAddress {
            self.oracle_contract.read()
        }

        fn get_all_markets(self: @ContractState) -> Array<u64> {
            let count = self.market_count.read();
            let mut markets: Array<u64> = array![];
            let mut i: u64 = 0;
            loop {
                if i >= count { break; }
                markets.append(self.market_ids.read(i));
                i += 1;
            };
            markets
        }

        // ─── ADMIN ─────────────────────────────────────────────────────────────
        fn set_contracts(
            ref self: ContractState,
            market_contract: ContractAddress,
            vault_contract: ContractAddress,
            sbtc_contract: ContractAddress,
            oracle_contract: ContractAddress,
        ) {
            assert(get_caller_address() == self.owner.read(), 'Only owner');
            self.market_contract.write(market_contract);
            self.vault_contract.write(vault_contract);
            self.sbtc_contract.write(sbtc_contract);
            self.oracle_contract.write(oracle_contract);
        }
    }
}
