/**
 * Demo mode — simulates the Lightning BTC→STRK swap only.
 *
 * What is simulated:
 *   - getLightningToStrkLimits()  → returns permissive limits instantly
 *   - createLightningToStrkSwap() → returns a fake invoice immediately
 *   - waitForLightningToStrk()    → sleeps DEMO_SETTLE_DELAY_MS, resolves true
 *
 * What stays REAL (genuine on-chain Starknet transactions):
 *   - STRK ERC-20 approve()
 *   - ShieldedVault deposit()
 *   - ShieldedVault place_bet()
 *   - ShieldedVault claim_winnings()
 *   - ShieldedVault withdraw()
 *
 * Enable in .env.local:
 *   NEXT_PUBLIC_DEMO_MODE=true
 *
 * Optional — STRK amount to use per demo tx (default: 0.01 STRK):
 *   NEXT_PUBLIC_DEMO_STRK_AMOUNT=10000000000000000
 *
 * The user must hold at least (DEMO_STRK_AMOUNT + 0.5 STRK gas reserve)
 * in their Starknet Sepolia wallet. Get testnet STRK at faucet.starknet.io.
 */

export const isDemoMode = (): boolean =>
    process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

/**
 * How many seconds the simulated "awaiting payment" step lasts.
 * Drives both the internal sleep and the visible countdown in the UI.
 */
export const DEMO_SETTLE_SECONDS = 4;
export const DEMO_SETTLE_DELAY_MS = DEMO_SETTLE_SECONDS * 1_000;

/** Clearly-fake invoice string shown in the UI during demo awaiting_payment */
export const DEMO_INVOICE =
    'lntb10u1p_DEMO_SIMULATED_INVOICE_no_payment_required_starkbet_testnet_' +
    '0000000000000000000000000000000000000000000000000000000000000000000_DEMO';

export const DEMO_SWAP_ID = 'demo-swap-starkbet-0000000000000000';

/**
 * STRK wei amount used for each demo deposit / bet.
 * Defaults to 0.01 STRK (1e16 wei, 18 decimals).
 * Override via NEXT_PUBLIC_DEMO_STRK_AMOUNT in .env.local.
 */
export function getDemoStrkAmount(): bigint {
    const raw = process.env.NEXT_PUBLIC_DEMO_STRK_AMOUNT;
    if (raw) {
        try { return BigInt(raw); } catch { /* fall through */ }
    }
    return 10_000_000_000_000_000n; // 0.01 STRK
}
