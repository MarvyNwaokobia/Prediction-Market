use starknet::ContractAddress;

/// IVault — public interface for the ShieldedVault
/// This is the privacy layer. All interactions are commitment-based.
/// No address-level traceability once inside the vault.
pub trait IVault<TContractState> {
    /// Deposit sBTC and register a Pedersen commitment into the Merkle tree.
    /// commitment = pedersen(secret, amount) — computed client-side.
    fn deposit(ref self: TContractState, commitment: felt252, amount: u256);

    /// Withdraw by proving knowledge of secret behind a commitment.
    /// nullifier = pedersen(secret, 1) — prevents double spend.
    fn withdraw(ref self: TContractState, nullifier: felt252, root: felt252, recipient: ContractAddress, amount: u256);

    /// Place an anonymous bet. Spends commitment, creates new one for remainder.
    fn place_bet(ref self: TContractState, nullifier: felt252, root: felt252, market_id: u64, outcome: u8, amount: u256, new_commitment: felt252);

    /// Claim winnings back into the shielded pool as a new commitment.
    fn claim_winnings(ref self: TContractState, nullifier: felt252, root: felt252, market_id: u64, new_commitment: felt252);

    /// Returns current Merkle root.
    fn get_root(self: @TContractState) -> felt252;

    /// Returns number of commitments in the tree.
    fn get_tree_size(self: @TContractState) -> u64;

    /// Check if a nullifier has been spent.
    fn is_nullifier_spent(self: @TContractState, nullifier: felt252) -> bool;

    /// Check if a root is in the valid history window.
    fn is_known_root(self: @TContractState, root: felt252) -> bool;
}
