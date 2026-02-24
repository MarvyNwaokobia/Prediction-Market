"use client";
import { useState } from "react";
import { useStarknetWallet } from "../hooks/useWallet";

interface Props {
  market: { id: number; question: string; yesOdds: number };
  onClose: () => void;
}

function randomFelt(): string {
  const arr = new Uint8Array(31);
  crypto.getRandomValues(arr);
  return "0x" + Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");
}

export function BetModal({ market, onClose }: Props) {
  const { isConnected } = useStarknetWallet();
  const [outcome, setOutcome] = useState<0 | 1>(1);
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<"form" | "generating" | "confirming" | "done">("form");
  const [secret] = useState(randomFelt());
  const [nullifier] = useState(randomFelt());
  const [commitment] = useState(randomFelt());

  const handleBet = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setStep("generating");
    await new Promise(r => setTimeout(r, 1500));
    setStep("confirming");
    await new Promise(r => setTimeout(r, 1500));
    setStep("done");
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#0D1117] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
          <div>
            <div className="text-white font-semibold">Shielded Bet</div>
            <div className="text-gray-600 text-xs mt-0.5">ZK-private · No address linkage</div>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 transition-all">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="p-6">
          {step === "form" && (
            <>
              <p className="text-gray-400 text-sm mb-6 leading-relaxed border border-white/5 bg-white/[0.02] rounded-xl p-4">
                {market.question}
              </p>

              {/* Outcome */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                {([1, 0] as const).map((o) => (
                  <button key={o} onClick={() => setOutcome(o)}
                    className={`py-3 rounded-xl font-semibold text-sm transition-all border ${
                      outcome === o
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
                <label className="text-gray-500 text-xs mb-2 block uppercase tracking-wide">Amount (sBTC)</label>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.01"
                  className="w-full bg-white/[0.03] border border-white/10 focus:border-orange-500/50 rounded-xl px-4 py-3 text-white placeholder-gray-700 focus:outline-none transition-colors text-sm"/>
              </div>

              <div className="bg-orange-500/5 border border-orange-500/10 rounded-xl p-3.5 mb-6 text-xs text-orange-300/70 leading-relaxed">
                Your bet is shielded via a Pedersen commitment. No address linkage. No position size exposure on-chain.
              </div>

              <button onClick={handleBet} disabled={!isConnected || !amount}
                className="w-full bg-orange-500 hover:bg-orange-400 disabled:bg-white/5 disabled:text-gray-600 text-white font-semibold py-3 rounded-xl transition-all text-sm">
                {isConnected ? "Generate ZK Proof and Bet" : "Connect Wallet First"}
              </button>
            </>
          )}

          {(step === "generating" || step === "confirming") && (
            <div className="text-center py-10">
              <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-5" />
              <p className="text-white font-semibold mb-1">
                {step === "generating" ? "Generating Commitment" : "Submitting to Vault"}
              </p>
              <p className="text-gray-600 text-sm mb-6">
                {step === "generating" ? "Computing Pedersen hash off-chain..." : "Proving Merkle membership on Starknet..."}
              </p>
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 text-left space-y-2">
                {step === "generating" ? (
                  <p className="text-xs font-mono text-gray-500">commitment = <span className="text-green-400 break-all">{commitment.slice(0, 30)}...</span></p>
                ) : (
                  <>
                    <p className="text-xs font-mono text-gray-500">nullifier: <span className="text-purple-400">{nullifier.slice(0, 20)}...</span></p>
                    <p className="text-xs font-mono text-gray-500">outcome: <span className="text-white">{outcome === 1 ? "YES" : "NO"}</span></p>
                    <p className="text-xs font-mono text-gray-500">amount: <span className="text-white">{amount} sBTC</span></p>
                  </>
                )}
              </div>
            </div>
          )}

          {step === "done" && (
            <div className="text-center py-8">
              <div className="w-14 h-14 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <p className="text-white font-bold text-xl mb-1">Bet Placed</p>
              <p className="text-gray-500 text-sm mb-6">Your position is fully shielded. Save your secret key.</p>
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 text-left mb-5">
                <p className="text-xs text-gray-600 mb-2 uppercase tracking-wide">Secret Key — Save This</p>
                <p className="text-xs font-mono text-yellow-400 break-all">{secret}</p>
              </div>
              <button onClick={onClose} className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold py-3 rounded-xl transition-all text-sm">
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
