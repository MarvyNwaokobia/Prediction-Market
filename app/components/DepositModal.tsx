"use client";
import { useState } from "react";
import { useBitcoinWallet, useStarknetWallet } from "../hooks/useWallet";

interface Props { onClose: () => void; }

function randomFelt(): string {
  const arr = new Uint8Array(31);
  crypto.getRandomValues(arr);
  return "0x" + Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");
}

export function DepositModal({ onClose }: Props) {
  const bitcoin = useBitcoinWallet();
  const starknet = useStarknetWallet();
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<"form" | "locking" | "minting" | "shielding" | "done">("form");
  const [commitment] = useState(randomFelt());

  const handleDeposit = async () => {
    if (!amount) return;
    setStep("locking");
    await new Promise(r => setTimeout(r, 1500));
    setStep("minting");
    await new Promise(r => setTimeout(r, 1500));
    setStep("shielding");
    await new Promise(r => setTimeout(r, 1200));
    setStep("done");
  };

  const STEPS_FLOW = [
    { key: "locking", label: "Locking BTC via HTLC", sub: "Atomic swap initiated on Bitcoin mainnet" },
    { key: "minting", label: "Minting sBTC on Starknet", sub: "Synthetic credit issued to your address" },
    { key: "shielding", label: "Registering Commitment", sub: "Inserting into Merkle vault" },
  ];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#0D1117] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
          <div>
            <div className="text-white font-semibold">Deposit BTC Collateral</div>
            <div className="text-gray-600 text-xs mt-0.5">Atomic swap · Non-custodial · ZK-shielded</div>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 transition-all">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="p-6">
          {step === "form" && (
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
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.01"
                  className="w-full bg-white/[0.03] border border-white/10 focus:border-orange-500/50 rounded-xl px-4 py-3 text-white placeholder-gray-700 focus:outline-none transition-colors text-sm" />
                <p className="text-gray-700 text-xs mt-1.5">Min: 0.001 BTC · Max: 1 BTC per tx</p>
              </div>

              {/* Flow diagram */}
              <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 mb-6">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="text-[#F7931A]">BTC locked</span>
                  <span>→</span>
                  <span className="text-gray-400">HTLC atomic swap</span>
                  <span>→</span>
                  <span className="text-[#EC796B]">sBTC minted</span>
                  <span>→</span>
                  <span className="text-green-400">Shielded</span>
                </div>
              </div>

              <button onClick={handleDeposit} disabled={!bitcoin.wallet || !starknet.isConnected || !amount}
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 disabled:from-white/5 disabled:to-white/5 disabled:text-gray-600 text-white font-semibold py-3 rounded-xl transition-all text-sm shadow-lg shadow-orange-500/10">
                {!bitcoin.wallet ? "Connect Bitcoin Wallet First" : !starknet.isConnected ? "Connect Starknet Wallet First" : "Deposit and Shield"}
              </button>
            </>
          )}

          {(step === "locking" || step === "minting" || step === "shielding") && (
            <div className="py-6">
              <div className="space-y-4">
                {STEPS_FLOW.map((s, i) => {
                  const currentIdx = STEPS_FLOW.findIndex(x => x.key === step);
                  const isDone = i < currentIdx;
                  const isActive = s.key === step;
                  return (
                    <div key={s.key} className={`flex items-start gap-3 p-3 rounded-xl transition-all ${isActive ? "bg-orange-500/5 border border-orange-500/10" : isDone ? "opacity-40" : "opacity-20"}`}>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${isDone ? "bg-green-500/20 border border-green-500/30" : isActive ? "border-2 border-orange-500" : "border border-white/10"}`}>
                        {isDone && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                        {isActive && <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />}
                      </div>
                      <div>
                        <div className="text-white text-sm font-medium">{s.label}</div>
                        <div className="text-gray-600 text-xs mt-0.5">{s.sub}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {step === "done" && (
            <div className="text-center py-8">
              <div className="w-14 h-14 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <p className="text-white font-bold text-xl mb-1">Deposited and Shielded</p>
              <p className="text-gray-500 text-sm mb-6">{amount} BTC entered the privacy pool as sBTC</p>
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 text-left mb-5">
                <p className="text-xs text-gray-600 mb-2 uppercase tracking-wide">Commitment Hash</p>
                <p className="text-xs font-mono text-green-400 break-all">{commitment}</p>
              </div>
              <button onClick={onClose} className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold py-3 rounded-xl transition-all text-sm">Close</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
