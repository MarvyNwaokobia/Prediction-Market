"use client";
import { useState } from "react";
import { X, Zap } from "lucide-react";
import { useStarknetWallet } from "../hooks/useWallet";

interface Props { onClose: () => void; }

const SUGGESTED = [
  "Will BTC reach $200k in 2025?",
  "Will Ethereum ETF get approved?",
  "Will the Fed cut rates in Q2 2025?",
  "Will Starknet launch on mainnet v2?",
];

export function CreateMarketModal({ onClose }: Props) {
  const { isConnected } = useStarknetWallet();
  const [question, setQuestion] = useState("");
  const [endDate, setEndDate] = useState("");
  const [step, setStep] = useState<"form" | "creating" | "done">("form");

  const handleCreate = async () => {
    if (!question || !endDate) return;
    setStep("creating");
    await new Promise(r => setTimeout(r, 2000));
    setStep("done");
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-orange-400" />
            <span className="font-semibold text-white">Create Market</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6">
          {step === "form" && (
            <>
              <div className="mb-4">
                <label className="text-gray-400 text-sm mb-2 block">Market Question</label>
                <textarea
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  placeholder="Will BTC hit $150k before EOY?"
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 resize-none"
                />
              </div>

              {/* Suggestions */}
              <div className="mb-6">
                <p className="text-gray-500 text-xs mb-2">Suggestions:</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED.map(s => (
                    <button key={s} onClick={() => setQuestion(s)} className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg transition-all border border-gray-700">
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <label className="text-gray-400 text-sm mb-2 block">Resolution Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <button
                onClick={handleCreate}
                disabled={!isConnected || !question || !endDate}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-3 rounded-xl transition-all"
              >
                {isConnected ? "Deploy Market" : "Connect Wallet First"}
              </button>
            </>
          )}

          {step === "creating" && (
            <div className="text-center py-8">
              <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-white font-semibold mb-2">Deploying Market</p>
              <p className="text-gray-400 text-sm">Registering on Starknet via MarketFactory...</p>
            </div>
          )}

          {step === "done" && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🚀</span>
              </div>
              <p className="text-white font-bold text-xl mb-2">Market Created!</p>
              <p className="text-gray-400 text-sm mb-2 px-4">"{question}"</p>
              <p className="text-gray-500 text-xs mb-6">Resolves: {endDate}</p>
              <button onClick={onClose} className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 rounded-xl transition-all">Close</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
