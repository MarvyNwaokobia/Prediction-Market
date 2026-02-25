/**
 * Client-side mixer helpers — Tornado-cash-style commitment/nullifier scheme.
 *
 * The privacy model:
 *  - User generates a random SECRET (felt252) locally in the browser.
 *  - COMMITMENT = pedersen(secret, amount) is stored on-chain in the vault Merkle tree.
 *  - NULLIFIER  = pedersen(secret, 1)      is revealed to spend the note.
 *  - No one can link the deposit to the withdrawal without knowing `secret`.
 *
 * The caller must keep `secret` secret (e.g. in memory or exported as a "note").
 */

import { hash, num } from 'starknet';
const { computePedersenHash } = hash;

/** A felt252 as a decimal string (as expected by Cairo calldata). */
export type Felt252 = string;

export interface MixerNote {
    /** Raw random secret — keep private! */
    secret: Felt252;
    /** pedersen(secret, amount) — submit this to the vault deposit call. */
    commitment: Felt252;
    /** pedersen(secret, 1) — reveal this to spend/claim. */
    nullifier: Felt252;
    /** Amount in token base units (USDC = 6 decimals) this note is worth. */
    amount: bigint;
}

/**
 * Generate a cryptographically random felt252 secret using Web Crypto API.
 * The value is in [1, 2^251) — safely within the felt252 range.
 */
export function generateSecret(): Felt252 {
    const bytes = new Uint8Array(31); // 248 bits — safely < felt252 max
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    const asBigInt = BigInt('0x' + hex);
    return num.toHex(asBigInt); // canonical 0x hex
}

/**
 * Compute a Pedersen commitment: pedersen(secret, amount).
 * This is the value posted on-chain for a deposit or bet.
 */
export function computeCommitment(secret: Felt252, amount: bigint): Felt252 {
    return computePedersenHash(secret, num.toHex(amount));
}

/**
 * Compute a Pedersen nullifier: pedersen(secret, 1).
 * Revealed when spending the note.
 */
export function computeNullifier(secret: Felt252): Felt252 {
    return computePedersenHash(secret, '0x1');
}

/**
 * Generate a complete mixer note for a given deposit amount.
 * Store the returned `note.secret` securely — it cannot be recovered.
 */
export function generateNote(amountWei: bigint): MixerNote {
    const secret = generateSecret();
    const commitment = computeCommitment(secret, amountWei);
    const nullifier = computeNullifier(secret);
    return { secret, commitment, nullifier, amount: amountWei };
}

/**
 * Serialize a note to a Base64 string for easy user export/import.
 * The user should save this like a bearer token — anyone with it can spend.
 */
export function serializeNote(note: MixerNote): string {
    const payload = JSON.stringify({
        s: note.secret,
        a: note.amount.toString(),
    });
    return btoa(payload);
}

/**
 * Deserialize a note from the Base64 format produced by serializeNote.
 * Recomputes commitment and nullifier from the secret.
 */
export function deserializeNote(encoded: string): MixerNote {
    const payload = JSON.parse(atob(encoded)) as { s: string; a: string };
    const secret = payload.s;
    const amount = BigInt(payload.a);
    return {
        secret,
        commitment: computeCommitment(secret, amount),
        nullifier: computeNullifier(secret),
        amount,
    };
}

/**
 * Convert a Wei amount (18 decimals) to a human-readable sBTC string.
 */
export function weiToSbtc(wei: bigint): string {
    const integer = wei / 10n ** 18n;
    const fraction = wei % 10n ** 18n;
    const fracStr = fraction.toString().padStart(18, '0').replace(/0+$/, '');
    return fracStr.length > 0 ? `${integer}.${fracStr}` : `${integer}`;
}

/**
 * Convert a human-readable sBTC amount to Wei (18 decimals).
 */
export function sbtcToWei(sbtc: string): bigint {
    const [integer, fraction = ''] = sbtc.split('.');
    const paddedFrac = fraction.slice(0, 18).padEnd(18, '0');
    return BigInt(integer) * 10n ** 18n + BigInt(paddedFrac);
}

/**
 * Convert satoshis (BTC 8-decimal) to Wei (18-decimal) for sBTC.
 * 1 BTC = 1e8 sats = 1e18 wei → 1 sat = 1e10 wei.
 */
export function satsToWei(sats: number): bigint {
    return BigInt(sats) * 10n ** 10n;
}
