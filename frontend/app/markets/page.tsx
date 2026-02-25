"use client";
import { useState } from "react";
import { useReadContract } from "@starknet-react/core";
import { useStarknetWallet, useBitcoinWallet } from "../hooks/useWallet";
import { MarketList } from "../components/MarketList";
import { CreateMarketModal } from "../components/CreateMarketModal";
import { MARKET_ABI } from "../lib/abis";
import { MARKET_LOGIC_ADDRESS } from "../lib/constants";

export default function MarketsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const starknet = useStarknetWallet();
  const bitcoin = useBitcoinWallet();
  const bothConnected = starknet.isConnected && !!bitcoin.wallet;

  const { data: marketCount } = useReadContract({
    abi: MARKET_ABI as any,
    address: MARKET_LOGIC_ADDRESS as `0x${string}`,
    functionName: "get_market_count",
    args: [],
  });

  return (
    <div className="w-full overflow-x-hidden">
      <div className="max-w-5xl mx-auto px-6 py-12">

        {/* Page header */}
        <div className="flex items-start justify-between mb-10">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">Markets</h1>
            <p className="text-gray-500 text-sm">All positions are ZK-shielded on-chain</p>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <div className="flex items-center gap-2 text-gray-500 text-xs border border-white/[0.08] rounded-full px-3 py-1.5">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
              Live
            </div>
            {bothConnected && (
              <button
                onClick={() => setShowCreate(true)}
                className="bg-orange-500 hover:bg-orange-400 text-white font-semibold px-5 py-2 rounded-xl transition-all text-sm"
              >
                Create Market
              </button>
            )}
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-3 mb-10">
          {[
            { label: "Total Markets", value: marketCount !== undefined ? String(Number(marketCount)) : "—" },
            { label: "Shielded Volume", value: "—" },
            { label: "Active Now", value: marketCount !== undefined ? String(Number(marketCount)) : "—" },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
              <div className="text-xl font-bold text-white">{value}</div>
              <div className="text-xs text-gray-600 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Connect notice */}
        {!bothConnected && (
          <div className="mb-6 p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl">
            <p className="text-gray-500 text-sm">
              Connect both wallets via the header to place bets and create markets.
            </p>
          </div>
        )}

        <MarketList refreshKey={refreshKey} />
      </div>

      {showCreate && <CreateMarketModal onClose={() => setShowCreate(false)} onCreated={() => setRefreshKey((k) => k + 1)} />}
    </div>
  );
}
