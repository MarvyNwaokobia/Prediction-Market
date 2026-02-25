"use client";
import { useState } from "react";
import { useStarknetWallet } from "../hooks/useWallet";
import { useAccount } from "@starknet-react/core";
import { shortString } from "starknet";
import { MARKET_FACTORY_ADDRESS } from "../lib/constants";
import { FACTORY_ABI } from "../lib/abis";
import type { AccountInterface } from "starknet";

interface Props { onClose: () => void; onCreated?: () => void; }

const SUGGESTED = [
  "Will BTC reach $200k in 2025?",
  "Will Ethereum ETF get approved?",
  "Will the Fed cut rates in Q2 2025?",
  "Will Starknet launch on mainnet v2?",
];

export function CreateMarketModal({ onClose, onCreated }: Props) {
  const { isConnected } = useStarknetWallet();
  const { account } = useAccount();
  const [question, setQuestion] = useState("");
  const [endDate, setEndDate] = useState("");
  const [step, setStep] = useState<"form" | "creating" | "done" | "error">("form");
  const [errorMsg, setErrorMsg] = useState("");

  // starknet felt252 short strings: max 31 ASCII bytes
  const questionTrimmed = question.slice(0, 31);
  const isQuestionValid = questionTrimmed.length > 0;

  const handleCreate = async () => {
    if (!isQuestionValid || !endDate || !account) return;
    setStep("creating");
    try {
      const endTimestamp = Math.floor(new Date(endDate).getTime() / 1000);
      // Encode question as a felt252 short string (max 31 ASCII chars)
      const questionFelt = shortString.encodeShortString(questionTrimmed);

      await (account as AccountInterface).execute([
        {
          contractAddress: MARKET_FACTORY_ADDRESS,
          entrypoint: "create_market",
          calldata: [
            questionFelt,              // question: felt252
            endTimestamp.toString(),   // end_time: u64
          ],
        },
      ]);
      setStep("done");
      onCreated?.();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStep("error");
    }
  };

  // Suppress unused import warning — FACTORY_ABI is typed here for future useReadContract usage
  void FACTORY_ABI;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#0D1117] border border-white/10 rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-white/[0.06]">
          <span className="font-semibold text-white">Create Market</span>
          <button onClick={onClose} className="text-gray-600 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 transition-all">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6">
          {step === "form" && (
            <>
              <div className="mb-4">
                <label className="text-gray-400 text-sm mb-2 block">
                  Market Question
                  <span className="ml-2 text-gray-600 text-xs">({questionTrimmed.length}/31 chars)</span>
                </label>
                <textarea
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  placeholder="Will BTC hit $150k before EOY?"
                  rows={3}
                  maxLength={31}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 resize-none"
                />
                <p className="text-gray-600 text-xs mt-1">Max 31 ASCII characters (felt252 encoding)</p>
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
                disabled={!isConnected || !isQuestionValid || !endDate}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-white/5 disabled:text-gray-600 text-white font-semibold py-3 rounded-xl transition-all"
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

          {step === "error" && (
            <div className="text-center py-8">
              <p className="text-red-400 font-semibold mb-2">Transaction Failed</p>
              <p className="text-gray-500 text-xs break-all mb-4">{errorMsg}</p>
              <button onClick={() => setStep("form")} className="text-orange-400 text-sm underline">Try again</button>
            </div>
          )}

          {step === "done" && (
            <div className="text-center py-8">
              <div className="w-14 h-14 bg-orange-500/10 border border-orange-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <p className="text-white font-bold text-xl mb-2">Market Created</p>
              <p className="text-gray-400 text-sm mb-2 px-4">"{question}"</p>
              <p className="text-gray-500 text-xs mb-6">Resolves: {endDate}</p>
              <button onClick={onClose} className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold py-3 rounded-xl transition-all">Close</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
