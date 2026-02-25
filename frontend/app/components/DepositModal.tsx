"use client";
import { useState, useEffect } from "react";
import { useBitcoinWallet, useStarknetWallet } from "../hooks/useWallet";
import { useAtomiqSwap } from "../hooks/useAtomiqSwap";
import { serializeNote } from "../lib/mixer";
import { getLightningToStrkLimits } from "../lib/atomiq";
import { isDemoMode, DEMO_SETTLE_SECONDS } from "../lib/demo";

interface Props { onClose: () => void; }

const SATS_PER_BTC = 100_000_000;

export function DepositModal({ onClose }: Props) {
  const bitcoin = useBitcoinWallet();
  const starknet = useStarknetWallet();
  const { step, invoice, note, error, initiate, reset } = useAtomiqSwap();
  const [btcAmount, setBtcAmount] = useState("");
  const [copied, setCopied] = useState(false);
  const [noteCopied, setNoteCopied] = useState(false);
  const [limits, setLimits] = useState<{ minSats: number; maxSats: number } | null>(null);
  const [demoCountdown, setDemoCountdown] = useState<number | null>(null);

  // Reset on mount and fetch live Atomiq limits (skipped in demo)
  useEffect(() => {
    reset();
    if (!isDemoMode()) {
      getLightningToStrkLimits().then(setLimits).catch(() => {
        setLimits({ minSats: 1_000, maxSats: 1_000_000 });
      });
    } else {
      setLimits({ minSats: 1, maxSats: 100_000_000 }); // permissive demo limits
    }
  }, [reset]);

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

  const handleDeposit = async () => {
    const btc = parseFloat(btcAmount);
    if (!btc || btc <= 0) return;
    const sats = Math.round(btc * SATS_PER_BTC);
    if (limits) {
      if (sats < limits.minSats) {
        alert(`Amount too small. Minimum is ${(limits.minSats / 1e8).toFixed(5)} BTC.`);
        return;
      }
      if (sats > limits.maxSats) {
        alert(`Amount too large. Maximum is ${(limits.maxSats / 1e8).toFixed(4)} BTC.`);
        return;
      }
    }
    await initiate(sats);
  };

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

  // Persist note to localStorage when deposit completes
  useEffect(() => {
    if (step === "done" && note && starknet.address) {
      const key = `starkbet_notes_${starknet.address}`;
      const existing: string[] = JSON.parse(localStorage.getItem(key) ?? "[]");
      const serialized = serializeNote(note);
      if (!existing.includes(serialized)) {
        localStorage.setItem(key, JSON.stringify([...existing, serialized]));
      }
    }
  }, [step, note, starknet.address]);

  const stepLabel: Record<typeof step, string> = {
    idle: "",
    quoting: "Generating Lightning invoice via Atomiq...",
    awaiting_payment: "Waiting for Bitcoin payment...",
    confirming: "Confirming STRK settlement on Starknet...",
    depositing: "Depositing STRK into ShieldedVault...",
    done: "",
    error: "",
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#0D1117] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-semibold">Deposit BTC Collateral</span>
            </div>
            <div className="text-gray-600 text-xs mt-0.5">Atomiq atomic swap · Non-custodial · ZK-shielded</div>
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
          {step === "idle" && (
            <>
              {/* Wallet status */}
              <div className="grid grid-cols-2 gap-2 mb-6">
                <div className={`rounded-xl p-3 border text-xs ${bitcoin.wallet ? "border-[#F7931A]/20 bg-[#F7931A]/5" : "border-white/5 bg-white/[0.02]"}`}>
                  <div className={`font-medium mb-0.5 ${bitcoin.wallet ? "text-[#F7931A]" : "text-gray-600"}`}>Bitcoin</div>
                  <div className="text-gray-600 font-mono truncate">{bitcoin.shortAddress || "Not connected"}</div>
                </div>
                <div className={`rounded-xl p-3 border text-xs ${starknet.isConnected ? "border-[#EC796B]/20 bg-[#EC796B]/5" : "border-white/5 bg-white/[0.02]"}`}>
                  <div className={`font-medium mb-0.5 ${starknet.isConnected ? "text-[#EC796B]" : "text-gray-600"}`}>Starknet</div>
                  <div className="text-gray-600 font-mono truncate">{starknet.shortAddress || "Not connected"}</div>
                </div>
              </div>

              <div className="mb-6">
                <label className="text-gray-500 text-xs mb-2 block uppercase tracking-wide">BTC Amount</label>
                <input type="number" value={btcAmount} onChange={e => setBtcAmount(e.target.value)}
                  placeholder={limits ? (limits.minSats / 1e8).toFixed(5) : "0.00001"}
                  min={limits ? limits.minSats / 1e8 : undefined}
                  max={limits ? limits.maxSats / 1e8 : undefined}
                  className="w-full bg-white/[0.03] border border-white/10 focus:border-orange-500/50 rounded-xl px-4 py-3 text-white placeholder-gray-700 focus:outline-none transition-colors text-sm" />
                <p className="text-gray-700 text-xs mt-1.5">
                  {limits
                    ? `Min: ${(limits.minSats / 1e8).toFixed(5)} BTC · Max: ${(limits.maxSats / 1e8).toFixed(4)} BTC · paid via Lightning`
                    : "Loading limits…"}
                </p>
              </div>

              {/* Flow */}
              <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 mb-6">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="text-[#F7931A]">Pay Lightning invoice</span>
                  <span>→</span>
                  <span className="text-gray-400">Atomiq settles STRK</span>
                  <span>→</span>
                  <span className="text-green-400">Vault shields note</span>
                </div>
              </div>

              <button onClick={handleDeposit}
                disabled={!bitcoin.wallet || !starknet.isConnected || !btcAmount}
                className="w-full bg-orange-500 hover:bg-orange-400 disabled:bg-white/5 disabled:text-gray-600 text-white font-semibold py-3 rounded-xl transition-all text-sm">
                {!bitcoin.wallet ? "Connect Bitcoin Wallet First"
                  : !starknet.isConnected ? "Connect Starknet Wallet First"
                    : "Generate Invoice and Deposit"}
              </button>
            </>
          )}

          {/* ── PROGRESS STEPS ── */}
          {(step === "quoting" || step === "awaiting_payment" || step === "confirming" || step === "depositing") && (
            <div className="py-4">
              {/* Show invoice / demo countdown when in awaiting_payment */}
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

              {/* Step progress */}
              <div className="space-y-3">
                {(["quoting", "awaiting_payment", "confirming", "depositing"] as const).map((s, i) => {
                  const order = ["quoting", "awaiting_payment", "confirming", "depositing"];
                  const currentIdx = order.indexOf(step);
                  const isActive = s === step;
                  const isDone = order.indexOf(s) < currentIdx;
                  const labels: Record<string, string> = {
                    quoting: "Generating Lightning invoice",
                    awaiting_payment: "Awaiting Bitcoin payment",
                    confirming: "Confirming STRK settlement",
                    depositing: "Shielding STRK in vault",
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

              {step === "depositing" && (
                <p className="text-orange-400/80 text-xs text-center mt-5 font-medium">
                  Check your Starknet wallet to approve the transaction
                </p>
              )}
              {!invoice && step !== "depositing" && (
                <p className="text-gray-600 text-xs text-center mt-4">{stepLabel[step]}</p>
              )}
            </div>
          )}

          {/* ── ERROR ── */}
          {step === "error" && (
            <div className="text-center py-8">
              <p className="text-red-400 font-semibold mb-2">Deposit Failed</p>
              <p className="text-gray-500 text-xs break-all mb-6 leading-relaxed">{error}</p>
              <button onClick={reset}
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
              <p className="text-white font-bold text-xl mb-1">Deposited and Shielded</p>
              <p className="text-gray-500 text-sm mb-6">{btcAmount} BTC entered the privacy pool as STRK</p>

              <div className="bg-white/[0.02] border border-yellow-500/20 rounded-xl p-4 text-left mb-4">
                <p className="text-yellow-400 text-xs font-semibold mb-1 uppercase tracking-wide">Save Your Note — Required to Claim</p>
                <p className="text-xs font-mono text-yellow-300/80 break-all">{serializeNote(note).slice(0, 60)}...</p>
              </div>

              <button onClick={copyNote}
                className="w-full bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 text-yellow-400 font-semibold py-2.5 rounded-xl transition-all text-sm mb-3">
                {noteCopied ? "Note Copied" : "Copy Full Note"}
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
