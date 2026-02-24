/// Merkle tree utilities for the ShieldedVault commitment tree.
/// Append-only Merkle tree — commitments are leaves, never removed.
/// Supports root history for async proof validation.

const TREE_DEPTH: u8 = 20;

/// Verify a Merkle inclusion proof.
/// Proves that `leaf` exists in a tree with the given `root`.
///
/// Args:
///   leaf       — the commitment hash being proven
///   index      — leaf position in the tree
///   proof      — sibling hashes from leaf to root (depth = 20)
///   root       — expected Merkle root
///
/// Returns true if proof is valid.
pub fn verify_proof(
    leaf: felt252,
    index: u64,
    proof: Span<felt252>,
    root: felt252,
) -> bool {
    assert(proof.len() == TREE_DEPTH.into(), 'Invalid proof length');

    let mut current = leaf;
    let mut idx = index;
    let mut i: u32 = 0;

    loop {
        if i >= TREE_DEPTH.into() {
            break;
        }
        let sibling = *proof.at(i);
        // If index is even, current is left child; if odd, right child
        current = if idx % 2 == 0 {
            core::pedersen::pedersen(current, sibling)
        } else {
            core::pedersen::pedersen(sibling, current)
        };
        idx = idx / 2;
        i += 1;
    };

    current == root
}

/// Compute the zero value for a given tree level.
/// Used to fill empty subtrees in a sparse Merkle tree.
pub fn zero_value(level: u8) -> felt252 {
    // Level 0 zero = hash of empty string
    // Each higher level = pedersen(lower_zero, lower_zero)
    if level == 0 {
        return 0;
    }
    let lower = zero_value(level - 1);
    core::pedersen::pedersen(lower, lower)
}
