use starknet::ContractAddress;

#[starknet::interface]
pub trait ISyntheticBTC<TContractState> {
    fn mint(ref self: TContractState, recipient: ContractAddress, amount: u256);
    fn burn(ref self: TContractState, from: ContractAddress, amount: u256);
    fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
    fn transfer(ref self: TContractState, recipient: ContractAddress, amount: u256) -> bool;
    fn transfer_from(ref self: TContractState, sender: ContractAddress, recipient: ContractAddress, amount: u256) -> bool;
    fn approve(ref self: TContractState, spender: ContractAddress, amount: u256) -> bool;
    fn allowance(self: @TContractState, owner: ContractAddress, spender: ContractAddress) -> u256;
    fn total_supply(self: @TContractState) -> u256;
    fn set_vault_address(ref self: TContractState, vault: ContractAddress);
    fn get_name(self: @TContractState) -> felt252;
    fn get_symbol(self: @TContractState) -> felt252;
    fn get_decimals(self: @TContractState) -> u8;
}

#[starknet::contract]
pub mod SyntheticBTC {
    use starknet::{ContractAddress, get_caller_address};
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess,
        Map, StorageMapReadAccess, StorageMapWriteAccess
    };
    use core::num::traits::Zero;

    #[storage]
    struct Storage {
        name: felt252,
        symbol: felt252,
        decimals: u8,
        total_supply: u256,
        balances: Map<ContractAddress, u256>,
        allowances: Map<(ContractAddress, ContractAddress), u256>,
        owner: ContractAddress,
        vault_address: ContractAddress,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        Transfer: Transfer,
        Approval: Approval,
        Mint: Mint,
        Burn: Burn,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Transfer {
        #[key]
        pub from: ContractAddress,
        #[key]
        pub to: ContractAddress,
        pub amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Approval {
        #[key]
        pub owner: ContractAddress,
        #[key]
        pub spender: ContractAddress,
        pub amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Mint {
        #[key]
        pub recipient: ContractAddress,
        pub amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Burn {
        #[key]
        pub from: ContractAddress,
        pub amount: u256,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        self.name.write('Synthetic Bitcoin');
        self.symbol.write('sBTC');
        self.decimals.write(8);
        self.total_supply.write(0);
        self.owner.write(owner);
    }

    #[abi(embed_v0)]
    impl SyntheticBTCImpl of super::ISyntheticBTC<ContractState> {
        fn mint(ref self: ContractState, recipient: ContractAddress, amount: u256) {
            let caller = get_caller_address();
            let owner = self.owner.read();
            let vault = self.vault_address.read();
            assert(caller == owner || caller == vault, 'Not authorized to mint');
            assert(amount > 0, 'Amount must be positive');

            self.total_supply.write(self.total_supply.read() + amount);
            self.balances.write(recipient, self.balances.read(recipient) + amount);

            self.emit(Mint { recipient, amount });
            self.emit(Transfer {
                from: Zero::zero(),
                to: recipient,
                amount,
            });
        }

        fn burn(ref self: ContractState, from: ContractAddress, amount: u256) {
            let caller = get_caller_address();
            let owner = self.owner.read();
            let vault = self.vault_address.read();
            assert(caller == owner || caller == vault, 'Not authorized to burn');
            assert(amount > 0, 'Amount must be positive');

            let current_balance = self.balances.read(from);
            assert(current_balance >= amount, 'Insufficient balance to burn');

            self.balances.write(from, current_balance - amount);
            self.total_supply.write(self.total_supply.read() - amount);

            self.emit(Burn { from, amount });
            self.emit(Transfer {
                from,
                to: Zero::zero(),
                amount,
            });
        }

        fn balance_of(self: @ContractState, account: ContractAddress) -> u256 {
            self.balances.read(account)
        }

        fn transfer(ref self: ContractState, recipient: ContractAddress, amount: u256) -> bool {
            let caller = get_caller_address();
            self._transfer(caller, recipient, amount);
            true
        }

        fn transfer_from(
            ref self: ContractState,
            sender: ContractAddress,
            recipient: ContractAddress,
            amount: u256
        ) -> bool {
            let caller = get_caller_address();
            let current_allowance = self.allowances.read((sender, caller));
            assert(current_allowance >= amount, 'Insufficient allowance');
            self.allowances.write((sender, caller), current_allowance - amount);
            self._transfer(sender, recipient, amount);
            true
        }

        fn approve(ref self: ContractState, spender: ContractAddress, amount: u256) -> bool {
            let caller = get_caller_address();
            self.allowances.write((caller, spender), amount);
            self.emit(Approval { owner: caller, spender, amount });
            true
        }

        fn allowance(self: @ContractState, owner: ContractAddress, spender: ContractAddress) -> u256 {
            self.allowances.read((owner, spender))
        }

        fn total_supply(self: @ContractState) -> u256 {
            self.total_supply.read()
        }

        fn set_vault_address(ref self: ContractState, vault: ContractAddress) {
            let caller = get_caller_address();
            assert(caller == self.owner.read(), 'Only owner');
            self.vault_address.write(vault);
        }

        fn get_name(self: @ContractState) -> felt252 {
            self.name.read()
        }

        fn get_symbol(self: @ContractState) -> felt252 {
            self.symbol.read()
        }

        fn get_decimals(self: @ContractState) -> u8 {
            self.decimals.read()
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _transfer(
            ref self: ContractState,
            sender: ContractAddress,
            recipient: ContractAddress,
            amount: u256
        ) {
            assert(amount > 0, 'Amount must be positive');
            let sender_balance = self.balances.read(sender);
            assert(sender_balance >= amount, 'Insufficient balance');
            self.balances.write(sender, sender_balance - amount);
            self.balances.write(recipient, self.balances.read(recipient) + amount);
            self.emit(Transfer { from: sender, to: recipient, amount });
        }
    }
}
