/**
 * Atomiq swap client for BTC (Lightning) -> STRK conversion.
 *
 * Flow:
 *  1. User holds BTC / connects Bitcoin wallet
 *  2. We create a Lightning -> STRK swap (Atomiq generates a BOLT11 invoice)
 *  3. User (or their BTC wallet) pays the invoice
 *  4. Atomiq settles and delivers STRK to the target Starknet address
 *  5. Caller uses that STRK to deposit into the ShieldedVault
 *
 * For STRK -> Lightning (privacy path from vault):
 *  1. Generate a Lightning invoice for the desired sat amount
 *  2. Call swapStrkToLightning() with a funded Starknet signer
 *  3. Atomiq locks STRK and pays the invoice
 */

// Browser-only: do not import at module level in server components.

import type { StarknetSigner } from '@atomiqlabs/chain-starknet';
import { RpcProvider } from 'starknet';
import {
    isDemoMode,
    DEMO_INVOICE,
    DEMO_SWAP_ID,
    DEMO_SETTLE_DELAY_MS,
} from './demo';

export interface LightningToStrkSwap {
    id: string;
    invoice: string; // BOLT11 invoice the user must pay
    amountSats: number;
    recipientAddress: string;
}

export interface StrkToLightningResult {
    success: boolean;
    txId?: string;
    error?: string;
}

export interface SwapLimits {
    minSats: number;
    maxSats: number;
}

let swapperInstance: any = null;
let tokensInstance: any = null;
let initPromise: Promise<void> | null = null;

const STARKNET_RPC =
    process.env.NEXT_PUBLIC_STARKNET_RPC ||
    'https://free-rpc.nethermind.io/sepolia-juno/v0_7';

const NETWORK = process.env.NEXT_PUBLIC_NETWORK === 'mainnet' ? 'MAINNET' : 'TESTNET';

async function initSwapper(): Promise<void> {
    if (swapperInstance) return;

    const { SwapperFactory } = await import('@atomiqlabs/sdk');
    const { StarknetInitializer, RpcProviderWithRetries, StarknetFees } = await import(
        '@atomiqlabs/chain-starknet'
    );
    const { BitcoinNetwork } = await import('@atomiqlabs/sdk');

    const factory = new SwapperFactory([StarknetInitializer] as const);
    tokensInstance = factory.Tokens;

    const provider = new RpcProviderWithRetries({ nodeUrl: STARKNET_RPC });

    const swapper = factory.newSwapper({
        chains: {
            STARKNET: {
                rpcUrl: provider,
                fees: new StarknetFees(provider),
            },
        },
        bitcoinNetwork:
            NETWORK === 'MAINNET' ? BitcoinNetwork.MAINNET : BitcoinNetwork.TESTNET,
    });

    await swapper.init();
    swapperInstance = swapper;
}

export async function ensureAtomiqReady(): Promise<void> {
    if (typeof window === 'undefined') {
        throw new Error('Atomiq SDK is browser-only');
    }
    if (!initPromise) {
        initPromise = initSwapper().catch((err) => {
            initPromise = null; // allow retry
            throw err;
        });
    }
    return initPromise;
}

/**
 * Create a Lightning → STRK swap.
 * Returns a BOLT11 invoice that the user must pay (via their BTC wallet).
 * After payment, call waitForLightningToStrk() to confirm settlement.
 */
export async function createLightningToStrkSwap(
    amountSats: number,
    recipientStarknetAddress: string
): Promise<LightningToStrkSwap> {
    if (isDemoMode()) {
        return {
            id: DEMO_SWAP_ID,
            invoice: DEMO_INVOICE,
            amountSats,
            recipientAddress: recipientStarknetAddress,
        };
    }
    await ensureAtomiqReady();

    const swap = await swapperInstance.swap(
        tokensInstance.BITCOIN.BTCLN, // from: Lightning BTC
        tokensInstance.STARKNET.STRK, // to: STRK
        BigInt(amountSats),
        true, // exactIn = true: we specify exact sats input
        undefined, // no source address needed for Lightning input
        recipientStarknetAddress
    );

    const invoice: string = swap.getAddress();
    const id: string = swap.getId();

    return { id, invoice, amountSats, recipientAddress: recipientStarknetAddress };
}

/**
 * Wait for a Lightning → STRK swap to complete (after the invoice is paid).
 * Resolves true on success, false on timeout/failure.
 */
export async function waitForLightningToStrk(
    swapId: string,
    timeoutMs = 300_000
): Promise<boolean> {
    if (isDemoMode()) {
        await new Promise((r) => setTimeout(r, DEMO_SETTLE_DELAY_MS));
        return true;
    }
    await ensureAtomiqReady();
    return swapperInstance.waitForCompletion(swapId, timeoutMs);
}

/**
 * Claim a settled Lightning → STRK swap on-chain using a Starknet signer.
 * This pushes the STRK to the recipient address.
 */
export async function claimLightningToStrkSwap(
    swapId: string,
    signer: StarknetSigner
): Promise<{ txId?: string }> {
    await ensureAtomiqReady();

    const swap = await swapperInstance.getSwapById(swapId);
    if (!swap) throw new Error(`Swap ${swapId} not found`);

    if (
        typeof swap.canCommitAndClaimInOneShot === 'function' &&
        swap.canCommitAndClaimInOneShot()
    ) {
        await swap.commitAndClaim(signer);
    } else {
        await swap.commit(signer);
        await swap.claim(signer);
    }

    return {
        txId: swap.getBitcoinTxId?.() ?? swap.getOutputTxId?.() ?? undefined,
    };
}

/**
 * STRK → Lightning swap (privacy direction).
 * Converts STRK from a Starknet signer to BTC via a Lightning invoice.
 */
export async function swapStrkToLightning(
    lightningInvoice: string,
    sourceAddress: string,
    signer: StarknetSigner
): Promise<StrkToLightningResult> {
    await ensureAtomiqReady();

    // Normalize hex address to 0x + 64 chars
    let addr = sourceAddress.trim().toLowerCase();
    if (!addr.startsWith('0x')) addr = '0x' + addr;
    const hex = addr.slice(2).replace(/^0+/, '').padStart(64, '0');
    addr = '0x' + hex;

    const swap = await swapperInstance.swap(
        tokensInstance.STARKNET.STRK,
        tokensInstance.BITCOIN.BTCLN,
        undefined, // amount taken from invoice
        false, // exactIn = false for LN output
        addr,
        lightningInvoice
    );

    await swap.commit(signer);
    const success: boolean = await swap.waitForPayment();

    if (success) {
        return { success: true, txId: swap.getBitcoinTxId?.() ?? swap.getId() };
    }

    // Try to refund
    try {
        await swap.refund(signer);
    } catch {
        // ignore refund errors
    }
    return { success: false, error: 'Lightning payment failed; swap refunded.' };
}

/**
 * Get the min/max limits for a Lightning → STRK swap (in sats).
 */
export async function getLightningToStrkLimits(): Promise<SwapLimits> {
    if (isDemoMode()) return { minSats: 1, maxSats: 100_000_000 };
    await ensureAtomiqReady();
    try {
        const min = await swapperInstance.getSwapMin(
            tokensInstance.BITCOIN.BTCLN,
            tokensInstance.STARKNET.STRK
        );
        const max = await swapperInstance.getSwapMax(
            tokensInstance.BITCOIN.BTCLN,
            tokensInstance.STARKNET.STRK
        );
        return { minSats: Number(min), maxSats: Number(max) };
    } catch {
        // Testnet nodes typically handle 1 000–1 000 000 sats; use conservative fallback
        return { minSats: 1_000, maxSats: 1_000_000 };
    }
}

/**
 * Read the STRK ERC-20 balance for a Starknet address.
 * Returns balance as a BigInt in wei (18-decimal).
 */
export async function getStrkBalance(
    address: string,
    strkAddress: string,
    nodeUrl: string,
): Promise<bigint> {
    const provider = new RpcProvider({ nodeUrl });
    const result = await provider.callContract({
        contractAddress: strkAddress,
        entrypoint: 'balance_of',
        calldata: [address],
    });
    // u256 is returned as [low, high] felts
    const low = BigInt(result[0]);
    const high = result[1] ? BigInt(result[1]) : 0n;
    return low + (high << 128n);
}

/**
 * Swap STRK → USDC on Starknet Sepolia via the Avnu DEX aggregator.
 * Fetches a quote, builds calldata, executes the swap via the user's account,
 * and returns the expected USDC amount (6-decimal base units).
 */
export async function swapStrkToUsdc(
    amountStrkWei: bigint,
    takerAddress: string,
    strkAddress: string,
    usdcAddress: string,
    account: any, // AccountInterface — typed as any to avoid circular dep
): Promise<bigint> {
    const AVNU_API = 'https://sepolia.api.avnu.fi';

    // 1. Fetch best quote
    const params = new URLSearchParams({
        sellTokenAddress: strkAddress.toLowerCase(),
        buyTokenAddress: usdcAddress.toLowerCase(),
        sellAmount: '0x' + amountStrkWei.toString(16),
        takerAddress,
        size: '1',
    });
    const quoteRes = await fetch(`${AVNU_API}/swap/v2/quotes?${params}`);
    if (!quoteRes.ok) {
        throw new Error(`Avnu quote failed (${quoteRes.status}): ${await quoteRes.text()}`);
    }
    const quoteData = await quoteRes.json();
    const quotes: any[] = quoteData.quotes ?? quoteData;
    if (!Array.isArray(quotes) || quotes.length === 0) {
        throw new Error('No STRK→USDC quotes returned by Avnu. Check testnet liquidity.');
    }
    const quote = quotes[0];

    // 2. Build swap calldata
    const buildRes = await fetch(`${AVNU_API}/swap/v2/build`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            quoteId: quote.quoteId,
            takerAddress,
            slippage: 0.05, // 5% slippage tolerance
        }),
    });
    if (!buildRes.ok) {
        throw new Error(`Avnu build failed (${buildRes.status}): ${await buildRes.text()}`);
    }
    const { calls } = await buildRes.json();

    // 3. Execute the swap
    await account.execute(calls);

    // 4. Return expected USDC buy amount (6-decimal base units)
    return BigInt(quote.buyAmount);
}
