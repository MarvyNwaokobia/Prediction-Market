"use client";
import { useState } from "react";
import { BetModal } from "./BetModal";
import { useStarknetWallet, useBitcoinWallet } from "../hooks/useWallet";

const DEMO_MARKETS = [
  { id: 0, question: "Will BTC hit $150k before EOY 2025?", endTime: "Dec 31, 2025", yesPool: "1.24 sBTC", noPool: "0.87 sBTC", yesOdds: 59, resolved: false, volume: "2.11 sBTC" },
  { id: 1, question: "Will the Bitcoin ETF see $100B AUM?", endTime: "Jun 30, 2025", yesPool: "2.10 sBTC", noPool: "1.90 sBTC", yesOdds: 52, resolved: false, volume: "4.00 sBTC" },
  { id: 2, question: "Will Starknet TVL exceed $1B?", endTime: "Mar 31, 2025", yesPool: "0.55 sBTC", noPool: "1.20 sBTC", yesOdds: 31, resolved: false, volume: "1.75 sBTC" },
  { id: 3, question: "Will the Fed cut rates in Q1 2025?", endTime: "Mar 31, 2025", yesPool: "0.90 sBTC", noPool: "0.60 sBTC", yesOdds: 60, resolved: true, volume: "1.50 sBTC" },
];

export function MarketList() {
  const [selectedMarket, setSelectedMarket] = useState<typeof DEMO_MARKETS[0] | null>(null);
  const starknet = useStarknetWallet();
  const bitcoin = useBitcoinWallet();
  const canBet = starknet.isConnected && !!bitcoin.wallet;

  return (
    <>
      <div className="flex flex-col gap-3">
        {DEMO_MARKETS.map((market) => (
          <div key={market.id}
            className="group w-full bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.06] hover:border-white/10 rounded-2xl px-8 py-6 transition-all duration-200">
            <div className="flex items-center justify-between gap-8">

              {/* Left */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-3">
                  {market.resolved
                    ? <span className="text-xs bg-white/5 text-gray-600 border border-white/10 px-2.5 py-0.5 rounded-full">Resolved</span>
                    : <span className="text-xs bg-green-500/10 text-green-400 border border-green-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />Active
                      </span>
                  }
                  <span className="text-gray-700 text-xs">Ends {market.endTime}</span>
                  <span className="text-gray-700 text-xs">Vol: <span className="text-gray-500">{market.volume}</span></span>
                </div>

                <h4 className="text-white font-semibold text-xl leading-snug mb-5">{market.question}</h4>

                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-green-400 font-medium">YES {market.yesOdds}%</span>
                    <span className="text-red-400 font-medium">NO {100 - market.yesOdds}%</span>
                  </div>
                  <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full"
                      style={{ width: `${market.yesOdds}%` }} />
                  </div>
                </div>

                <div className="flex gap-5 text-xs text-gray-600">
                  <span>YES pool <span className="text-gray-400 font-mono">{market.yesPool}</span></span>
                  <span>NO pool <span className="text-gray-400 font-mono">{market.noPool}</span></span>
                </div>
              </div>

              {/* Right */}
              <div className="flex-shrink-0">
                {!market.resolved && (
                  canBet ? (
                    <button onClick={() => setSelectedMarket(market)}
                      className="bg-orange-500/10 hover:bg-orange-500 border border-orange-500/30 hover:border-orange-500 text-orange-400 hover:text-white font-semibold px-6 py-3 rounded-xl text-sm transition-all duration-200 whitespace-nowrap">
                      Place Bet
                    </button>
                  ) : (
                    <div className="text-gray-700 text-xs text-center max-w-[100px] leading-relaxed">
                      Connect wallets to bet
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedMarket && <BetModal market={selectedMarket} onClose={() => setSelectedMarket(null)} />}
    </>
  );
}
