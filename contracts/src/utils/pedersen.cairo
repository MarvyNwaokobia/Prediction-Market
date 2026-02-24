/// Pedersen commitment utilities
/// In production these run client-side (off-chain) to preserve privacy.
/// These helpers document the commitment scheme used by the protocol.

/// Compute a note commitment.
/// commitment = pedersen(secret, amount)
/// The secret is known only to the depositor.
/// The amount is embedded in the commitment — not revealed on-chain.
pub fn compute_commitment(secret: felt252, amount: felt252) -> felt252 {
    core::pedersen::pedersen(secret, amount)
}

/// Compute a nullifier from a secret.
/// nullifier = pedersen(secret, 1)
/// Deterministic: same secret always produces same nullifier.
/// One-way: nullifier cannot be reversed to recover secret.
/// Unlinkable: nullifier reveals nothing about the commitment.
pub fn compute_nullifier(secret: felt252) -> felt252 {
    core::pedersen::pedersen(secret, 1)
}

/// Compute a Merkle leaf hash.
/// leaf = pedersen(commitment, index)
pub fn compute_leaf(commitment: felt252, index: felt252) -> felt252 {
    core::pedersen::pedersen(commitment, index)
}

/// Compute an internal Merkle node.
/// node = pedersen(left_child, right_child)
pub fn compute_node(left: felt252, right: felt252) -> felt252 {
    core::pedersen::pedersen(left, right)
}
