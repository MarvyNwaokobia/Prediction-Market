"use client";
import { useState, useCallback, useEffect } from "react";
import { useAccount } from "@starknet-react/core";
import { RpcProvider } from "starknet";
import { useStarknetWallet, useBitcoinWallet } from "../hooks/useWallet";
import {
  createLightningToStrkSwap,
  waitForLightningToStrk,
  getStrkBalance,
} from "../lib/atomiq";
import { isDemoMode, getDemoStrkAmount, DEMO_SETTLE_SECONDS } from "../lib/demo";
import { generateNote, serializeNote } from "../lib/mixer";
import { VAULT_ADDRESS, STRK_ADDRESS } from "../lib/constants";
import type { AccountInterface } from "starknet";

interface Props {
  market: { id: number; question: string; yesOdds: number };
  onClose: () => void;
}

type BetStep =
  | "form"
  | "quoting"
  | "awaiting_payment"
  | "confirming"
  | "depositing"
  | "placing_bet"
  | "done"
  | "error";

const SATS_PER_BTC = 100_000_000;

export function BetModal({ market, onClose }: Props) {
  const { isConnected } = useStarknetWallet();
  const bitcoin = useBitcoinWallet();
  const { account, address } = useAccount();
  const [outcome, setOutcome] = useState<0 | 1>(1);
  const [btcAmount, setBtcAmount] = useState("");
  const [step, setStep] = useState<BetStep>("form");
  const [invoice, setInvoice] = useState<string | null>(null);
  const [note, setNote] = useState<ReturnType<typeof generateNote> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [noteCopied, setNoteCopied] = useState(false);
  const [demoCountdown, setDemoCountdown] = useState<number | null>(null);

  // Demo countdown timer during simulated awaiting_payment
  useEffect(() => {
    if (step === "awaiting_payment" && isDemoMode()) {
      setDemoCountdown(DEMO_SETTLE_SECONDS);
      const iv = setInterval(() => {
        setDemoCountdown((c) => {
          if (c === null || c <= 1) { clearInterval(iv); return null; }
          return c - 1;
        });
      }, 1_000);
      return () => clearInterval(iv);
    }
  }, [step]);

  // Persist bet claim note to localStorage
  useEffect(() => {
    if (step === "done" && note && address) {
      const key = `starkbet_notes_${address}`;
      const existing: string[] = JSON.parse(localStorage.getItem(key) ?? "[]");
      const serialized = serializeNote(note);
      if (!existing.includes(serialized)) {
        localStorage.setItem(key, JSON.stringify([...existing, serialized]));
      }
    }
  }, [step, note, address]);

  const copyInvoice = async () => {
    if (!invoice) return;
    await navigator.clipboard.writeText(invoice);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyNote = async () => {
    if (!note) return;
    await navigator.clipboard.writeText(serializeNote(note));
    setNoteCopied(true);
    setTimeout(() => setNoteCopied(false), 2000);
  };

  const handleBet = useCallback(async () => {
    const btc = parseFloat(btcAmount);
    if (!btc || btc <= 0 || !address || !account) return;

    const sats = Math.round(btc * SATS_PER_BTC);

    try {
      // ── Step 1: Create Lightning → STRK swap via Atomiq ───────────────────
      setStep("quoting");
      const swap = await createLightningToStrkSwap(sats, address);
      setInvoice(swap.invoice);
      setStep("awaiting_payment");

      // ── Step 2: Wait for Lightning payment to settle ──────────────────────
      const settled = await waitForLightningToStrk(swap.id, 300_000);
      if (!settled) throw new Error("Lightning payment timed out.");

      setStep("confirming");
      await new Promise((r) => setTimeout(r, 1500));

      // ── Step 3: Determine STRK deposit amount ────────────────────────────
      const GAS_RESERVE = 500_000_000_000_000_000n;
      let strkToDeposit: bigint;
      if (isDemoMode()) {
        const realBal = await getStrkBalance(address, STRK_ADDRESS, process.env.NEXT_PUBLIC_STARKNET_RPC!);
        const demoAmt = getDemoStrkAmount();
        if (realBal < demoAmt + GAS_RESERVE) {
          throw new Error(`Demo requires at least ${Number(demoAmt + GAS_RESERVE) / 1e18} STRK on Sepolia. Get testnet STRK at faucet.starknet.io.`);
        }
        strkToDeposit = demoAmt;
      } else {
        const strkBal = await getStrkBalance(address, STRK_ADDRESS, process.env.NEXT_PUBLIC_STARKNET_RPC!);
        const GAS_RES = 500_000_000_000_000_000n;
        strkToDeposit = strkBal > GAS_RES ? strkBal - GAS_RES : strkBal;
        if (strkToDeposit <= 0n) throw new Error("Insufficient STRK balance after gas reserve.");
      }

      // ── Step 4: TX1 — generate note + approve STRK + deposit into vault ──
      const depositNote = generateNote(strkToDeposit);
      setStep("depositing");
      const depositTx = await (account as AccountInterface).execute([
        {
          contractAddress: STRK_ADDRESS,
          entrypoint: "approve",
          calldata: [VAULT_ADDRESS, strkToDeposit.toString(), "0"],
        },
        {
          contractAddress: VAULT_ADDRESS,
          entrypoint: "deposit",
          calldata: [
            depositNote.commitment,
            strkToDeposit.toString(),
            "0",
          ],
        },
      ]);

      // ── Step 5: Wait for deposit to be confirmed on-chain ─────────────────
      const provider = new RpcProvider({
        nodeUrl: process.env.NEXT_PUBLIC_STARKNET_RPC!,
      });
      await provider.waitForTransaction(depositTx.transaction_hash, { retryInterval: 2000 });

      // Read the updated Merkle root
      const rootResult = await provider.callContract({
        contractAddress: VAULT_ADDRESS,
        entrypoint: "get_root",
        calldata: [],
      });
      const vaultRoot = rootResult[0];

      // ── Step 6: Generate bet-receipt note (commitment2) ───────────────────
      const betReceiptNote = generateNote(strkToDeposit);
      setNote(betReceiptNote);

      // ── Step 7: TX2 — place_bet ───────────────────────────────────────────
      setStep("placing_bet");
      await (account as AccountInterface).execute([
        {
          contractAddress: VAULT_ADDRESS,
          entrypoint: "place_bet",
          calldata: [
            depositNote.commitment,    // nullifier arg: MVP contract uses commitment as lookup key
            vaultRoot,                 // root: felt252
            market.id.toString(),      // market_id: u64
            outcome.toString(),        // outcome: u8 (0=NO, 1=YES)
            strkToDeposit.toString(),  // amount low: u256
            "0",                       // amount high: u256
            betReceiptNote.commitment, // new_commitment: felt252
          ],
        },
      ]);

      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep("error");
    }
  }, [btcAmount, address, account, market.id, outcome]);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#0D1117] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-semibold">Shielded Bet</span>
            </div>
            <div className="text-gray-600 text-xs mt-0.5">BTC via Lightning · ZK-private · No address linkage</div>
          </div>
          <button onClick={onClose}
            className="text-gray-600 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 transition-all">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">

          {/* ── FORM ── */}
          {step === "form" && (
            <>
              <p className="text-gray-400 text-sm mb-6 leading-relaxed border border-white/5 bg-white/[0.02] rounded-xl p-4">
                {market.question}
              </p>

              {/* Outcome selector */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                {([1, 0] as const).map((o) => (
                  <button key={o} onClick={() => setOutcome(o)}
                    className={`py-3 rounded-xl font-semibold text-sm transition-all border ${outcome === o
                      ? o === 1
                        ? "bg-green-500/15 border-green-500/50 text-green-400"
                        : "bg-red-500/15 border-red-500/50 text-red-400"
                      : "bg-white/[0.02] border-white/10 text-gray-500 hover:border-white/20"
                      }`}>
                    {o === 1 ? `YES — ${market.yesOdds}%` : `NO — ${100 - market.yesOdds}%`}
                  </button>
                ))}
              </div>

              <div className="mb-6">
                <label className="text-gray-500 text-xs mb-2 block uppercase tracking-wide">BTC Amount</label>
                <input type="number" value={btcAmount} onChange={(e) => setBtcAmount(e.target.value)}
                  placeholder="0.001"
                  className="w-full bg-white/[0.03] border border-white/10 focus:border-orange-500/50 rounded-xl px-4 py-3 text-white placeholder-gray-700 focus:outline-none transition-colors text-sm" />
                <p className="text-gray-700 text-xs mt-1.5">Paid via Lightning · Atomiq converts to STRK → vault</p>
              </div>

              <div className="bg-orange-500/5 border border-orange-500/10 rounded-xl p-3.5 mb-6 text-xs text-orange-300/70 leading-relaxed">
                Your bet is shielded via a Pedersen commitment. The BTC→STRK swap route breaks any on-chain trace. No position size or address is exposed.
              </div>

              <button onClick={handleBet}
                disabled={!isConnected || !bitcoin.wallet || !btcAmount}
                className="w-full bg-orange-500 hover:bg-orange-400 disabled:bg-white/5 disabled:text-gray-600 text-white font-semibold py-3 rounded-xl transition-all text-sm">
                {!isConnected || !bitcoin.wallet ? "Connect Wallets First" : "Place Shielded Bet"}
              </button>
            </>
          )}

          {/* ── PROGRESS ── */}
          {(step === "quoting" || step === "awaiting_payment" || step === "confirming" || step === "depositing" || step === "placing_bet") && (
            <div className="py-4">
              {invoice && step === "awaiting_payment" && (
                <div className="mb-6">
                  {isDemoMode() ? (
                    <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-5 text-center">
                      <p className="text-gray-500 text-sm mb-3">Awaiting payment confirmation…</p>
                      <div className="text-4xl font-black text-white mb-2">
                        {demoCountdown !== null ? demoCountdown : "—"}
                      </div>
                    </div>
                  ) : (
                    // Live: real invoice for user to pay
                    <>
                      <p className="text-gray-400 text-sm mb-3">Pay this Lightning invoice from your Bitcoin wallet:</p>
                      <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-4 mb-3">
                        <p className="text-xs font-mono text-orange-300 break-all leading-relaxed">{invoice}</p>
                      </div>
                      <button onClick={copyInvoice}
                        className="w-full text-xs text-gray-400 hover:text-white border border-white/10 hover:border-white/20 py-2 rounded-lg transition-all">
                        {copied ? "Copied" : "Copy Invoice"}
                      </button>
                    </>
                  )}
                </div>
              )}

              <div className="space-y-3">
                {(["quoting", "awaiting_payment", "confirming", "depositing", "placing_bet"] as const).map((s) => {
                  const order = ["quoting", "awaiting_payment", "confirming", "depositing", "placing_bet"];
                  const currentIdx = order.indexOf(step);
                  const isActive = s === step;
                  const isDone = order.indexOf(s) < currentIdx;
                  const labels: Record<string, string> = {
                    quoting: "Generating Lightning invoice",
                    awaiting_payment: "Awaiting Bitcoin payment",
                    confirming: "Confirming STRK settlement",
                    depositing: "Depositing STRK to shielded vault",
                    placing_bet: "Placing shielded bet on-chain",
                  };
                  return (
                    <div key={s}
                      className={`flex items-center gap-3 p-3 rounded-xl transition-all ${isActive ? "bg-orange-500/5 border border-orange-500/10" : isDone ? "opacity-40" : "opacity-20"}`}>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${isDone ? "bg-green-500/20 border border-green-500/30" : isActive ? "border-2 border-orange-500" : "border border-white/10"}`}>
                        {isDone && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
                        {isActive && <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />}
                      </div>
                      <span className="text-white text-sm">{labels[s]}</span>
                    </div>
                  );
                })}
              </div>

              {step === "placing_bet" && (
                <p className="text-orange-400/80 text-xs text-center mt-5 font-medium">
                  Check your Starknet wallet to approve the transaction
                </p>
              )}
              {step === "depositing" && (
                <p className="text-gray-500 text-xs text-center mt-5">
                  Approve in wallet, then waiting for confirmation on-chain…
                </p>
              )}
            </div>
          )}

          {/* ── ERROR ── */}
          {step === "error" && (
            <div className="text-center py-8">
              <p className="text-red-400 font-semibold mb-2">Transaction Failed</p>
              <p className="text-gray-500 text-xs break-all mb-6 leading-relaxed">{error}</p>
              <button onClick={() => { setStep("form"); setError(null); setInvoice(null); }}
                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold py-3 rounded-xl transition-all text-sm">
                Try Again
              </button>
            </div>
          )}

          {/* ── DONE ── */}
          {step === "done" && note && (
            <div className="text-center py-8">
              <div className="w-14 h-14 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="text-white font-bold text-xl mb-1">Bet Placed</p>
              <p className="text-gray-500 text-sm mb-6">Your position is fully shielded. Save your note to claim winnings.</p>

              <div className="bg-white/[0.02] border border-yellow-500/20 rounded-xl p-4 text-left mb-4">
                <p className="text-yellow-400 text-xs font-semibold mb-1 uppercase tracking-wide">Claim Note — Save This</p>
                <p className="text-xs font-mono text-yellow-300/80 break-all leading-relaxed">{serializeNote(note).slice(0, 60)}...</p>
              </div>

              <button onClick={copyNote}
                className="w-full bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 text-yellow-400 font-semibold py-2.5 rounded-xl transition-all text-sm mb-3">
                {noteCopied ? "Note Copied" : "Copy Claim Note"}
              </button>
              <button onClick={onClose}
                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold py-3 rounded-xl transition-all text-sm">
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

