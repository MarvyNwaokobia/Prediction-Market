/**
 * React hook orchestrating the full BTC → STRK → ShieldedVault flow.
 *
 * Steps:
 *  1. idle      — waiting for user action
 *  2. quoting   — fetching Atomiq Lightning→STRK swap invoice
 *  3. awaiting_payment — BOLT11 invoice displayed; user pays from BTC wallet
 *  4. confirming — waiting for Atomiq to confirm STRK delivery
 *  5. depositing — calling ShieldedVault.deposit() with commitment
 *  6. done      — note returned to caller; deposit in Merkle tree
 *  7. error     — something went wrong
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import { useAccount, useContract } from '@starknet-react/core';
import { VAULT_ADDRESS, STRK_ADDRESS } from '../lib/constants';
import { VAULT_ABI } from '../lib/abis';
import {
    createLightningToStrkSwap,
    waitForLightningToStrk,
    getStrkBalance,
    getLightningToStrkLimits,
    type LightningToStrkSwap,
} from '../lib/atomiq';
import { isDemoMode, getDemoStrkAmount } from '../lib/demo';
import {
    generateNote,
    type MixerNote,
} from '../lib/mixer';
import type { AccountInterface } from 'starknet';

export type SwapStep =
    | 'idle'
    | 'quoting'
    | 'awaiting_payment'
    | 'confirming'
    | 'depositing'
    | 'done'
    | 'error';

export interface UseAtomiqSwapReturn {
    step: SwapStep;
    invoice: string | null;
    note: MixerNote | null;
    error: string | null;
    /** Start the flow: user pays `amountSats` of BTC via Lightning → STRK lands in vault */
    initiate: (amountSats: number) => Promise<void>;
    reset: () => void;
}

export function useAtomiqSwap(): UseAtomiqSwapReturn {
    const { address, account } = useAccount();
    const [step, setStep] = useState<SwapStep>('idle');
    const [invoice, setInvoice] = useState<string | null>(null);
    const [note, setNote] = useState<MixerNote | null>(null);
    const [error, setError] = useState<string | null>(null);

    const swapRef = useRef<LightningToStrkSwap | null>(null);
    const noteRef = useRef<MixerNote | null>(null);

    const { contract: vault } = useContract({ abi: VAULT_ABI, address: VAULT_ADDRESS as `0x${string}` });

    const reset = useCallback(() => {
        setStep('idle');
        setInvoice(null);
        setNote(null);
        setError(null);
        swapRef.current = null;
        noteRef.current = null;
    }, []);

    const initiate = useCallback(
        async (amountSats: number) => {
            if (!address || !account) {
                setError('Connect your Starknet wallet first.');
                setStep('error');
                return;
            }

            try {
                // ── Step 1: Validate amount (skip in demo — Atomiq not called) ────────
                setStep('quoting');
                if (!isDemoMode()) {
                    const limits = await getLightningToStrkLimits();
                    if (amountSats < limits.minSats) {
                        throw new Error(
                            `Amount too small. Minimum is ${(limits.minSats / 1e8).toFixed(5)} BTC (${limits.minSats.toLocaleString()} sats).`
                        );
                    }
                    if (amountSats > limits.maxSats) {
                        throw new Error(
                            `Amount too large. Maximum is ${(limits.maxSats / 1e8).toFixed(5)} BTC (${limits.maxSats.toLocaleString()} sats).`
                        );
                    }
                }

                // ── Step 2: Create Lightning → STRK swap (simulated in demo) ─────────
                const swap = await createLightningToStrkSwap(amountSats, address);
                swapRef.current = swap;

                setInvoice(swap.invoice);
                setStep('awaiting_payment');

                // ── Step 2: Wait for Lightning invoice to be paid ─────────────────────
                const settled = await waitForLightningToStrk(swap.id, 300_000);
                if (!settled) {
                    throw new Error('Lightning payment timed out. Please try again.');
                }

                setStep('confirming');
                await new Promise((r) => setTimeout(r, 2000));

                // ── Step 3: Determine deposit amount ─────────────────────────────────
                // Demo: use fixed demo amount; check real balance covers it + gas.
                // Live: read settled balance, reserve 0.5 STRK for gas.
                const GAS_RESERVE = 500_000_000_000_000_000n; // 0.5 STRK
                let strkToDeposit: bigint;
                if (isDemoMode()) {
                    const realBal = await getStrkBalance(
                        address,
                        STRK_ADDRESS,
                        process.env.NEXT_PUBLIC_STARKNET_RPC!,
                    );
                    const demoAmt = getDemoStrkAmount();
                    if (realBal < demoAmt + GAS_RESERVE) {
                        throw new Error(
                            `Demo requires at least ${Number(demoAmt + GAS_RESERVE) / 1e18} STRK on Sepolia. ` +
                            `Get testnet STRK at faucet.starknet.io then reconnect.`
                        );
                    }
                    strkToDeposit = demoAmt;
                } else {
                    const strkBal = await getStrkBalance(
                        address,
                        STRK_ADDRESS,
                        process.env.NEXT_PUBLIC_STARKNET_RPC!,
                    );
                    strkToDeposit = strkBal > GAS_RESERVE ? strkBal - GAS_RESERVE : strkBal;
                    if (strkToDeposit <= 0n) throw new Error('Insufficient STRK balance after gas reserve.');
                }

                const mixerNote = generateNote(strkToDeposit);
                noteRef.current = mixerNote;

                // ── Step 4: Approve STRK spend by vault + deposit ─────────────────────
                setStep('depositing');
                if (!vault) {
                    throw new Error('Vault contract not loaded. Check NEXT_PUBLIC_VAULT_ADDRESS in .env.local.');
                }

                await (account as AccountInterface).execute([
                    {
                        contractAddress: STRK_ADDRESS,
                        entrypoint: 'approve',
                        calldata: [VAULT_ADDRESS, strkToDeposit.toString(), '0'],
                    },
                    {
                        contractAddress: VAULT_ADDRESS,
                        entrypoint: 'deposit',
                        calldata: [mixerNote.commitment, strkToDeposit.toString(), '0'],
                    },
                ]);

                setNote(mixerNote);
                setStep('done');
            } catch (err) {
                let msg = err instanceof Error ? err.message : String(err);
                if (msg.toLowerCase().includes('not enough liquidity') ||
                    msg.toLowerCase().includes('liquidity')) {
                    msg =
                        'Atomiq testnet node has insufficient liquidity for this amount. ' +
                        'Try a smaller amount (e.g. 0.0001–0.001 BTC) or wait a few minutes and retry.';
                }
                setError(msg);
                setStep('error');
            }
        },
        [address, account, vault]
    );

    return { step, invoice, note, error, initiate, reset };
}
