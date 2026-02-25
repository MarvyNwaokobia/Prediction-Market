"use client";
import { useState, useEffect } from "react";
import { useReadContract } from "@starknet-react/core";
import { shortString } from "starknet";
import { BetModal } from "./BetModal";
import { useStarknetWallet, useBitcoinWallet } from "../hooks/useWallet";
import { MARKET_ABI } from "../lib/abis";
import { MARKET_LOGIC_ADDRESS } from "../lib/constants";

// ─── Types ────────────────────────────────────────────────────────────────────
interface MarketData {
  id: number;
  question: string;
  yesOdds: number;
  yesPool: string;
  noPool: string;
  endTime: string;
  resolved: boolean;
  volume: string;
}

const STRK_BASE = BigInt("1000000000000000000"); // 1e18

function formatStrk(raw: bigint): string {
  const whole = raw / STRK_BASE;
  const frac = Number(raw % STRK_BASE) / 1e18;
  return (Number(whole) + frac).toFixed(4) + " STRK";
}

// ─── Per-market card ─────────────────────────────────────────────────────────
function MarketCard({
  marketId,
  canBet,
  onBet,
}: {
  marketId: number;
  canBet: boolean;
  onBet: (m: MarketData) => void;
}) {
  const { data: raw } = useReadContract({
    abi: MARKET_ABI as any,
    address: MARKET_LOGIC_ADDRESS as `0x${string}`,
    functionName: "get_market",
    args: [BigInt(marketId)],
  });

  const { data: yesRaw } = useReadContract({
    abi: MARKET_ABI as any,
    address: MARKET_LOGIC_ADDRESS as `0x${string}`,
    functionName: "get_yes_pool",
    args: [BigInt(marketId)],
  });

  const { data: noRaw } = useReadContract({
    abi: MARKET_ABI as any,
    address: MARKET_LOGIC_ADDRESS as `0x${string}`,
    functionName: "get_no_pool",
    args: [BigInt(marketId)],
  });

  if (!raw) {
    return (
      <div className="w-full bg-white/[0.02] border border-white/[0.06] rounded-2xl px-8 py-6 animate-pulse">
        <div className="h-4 bg-white/5 rounded w-3/4 mb-3" />
        <div className="h-6 bg-white/5 rounded w-1/2" />
      </div>
    );
  }

  // Decode on-chain market struct
  const m = raw as any;
  const yesPool = BigInt(yesRaw ?? 0);
  const noPool = BigInt(noRaw ?? 0);
  const total = yesPool + noPool;
  const yesOdds = total > 0n ? Math.round(Number((yesPool * 100n) / total)) : 50;

  let question = "Unknown";
  try { question = shortString.decodeShortString(BigInt(m.question).toString(16).padStart(2, "0").startsWith("0x") ? BigInt(m.question).toString() : `0x${BigInt(m.question).toString(16)}`); } catch { question = `Market #${marketId}`; }

  const endDate = new Date(Number(m.end_time) * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const resolved = Boolean(m.resolved);

  const marketData: MarketData = {
    id: marketId,
    question,
    yesOdds,
    yesPool: formatStrk(yesPool),
    noPool: formatStrk(noPool),
    endTime: endDate,
    resolved,
    volume: formatStrk(total),
  };

  return (
    <div className="group w-full bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.06] hover:border-white/10 rounded-2xl px-8 py-6 transition-all duration-200">
      <div className="flex items-center justify-between gap-8">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-3">
            {resolved
              ? <span className="text-xs bg-white/5 text-gray-600 border border-white/10 px-2.5 py-0.5 rounded-full">Resolved</span>
              : <span className="text-xs bg-green-500/10 text-green-400 border border-green-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />Active
              </span>
            }
            <span className="text-gray-700 text-xs">Ends {endDate}</span>
            <span className="text-gray-700 text-xs">Vol: <span className="text-gray-500">{formatStrk(total)}</span></span>
          </div>
          <h4 className="text-white font-semibold text-xl leading-snug mb-5">{question}</h4>
          <div className="mb-3">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-green-400 font-medium">YES {yesOdds}%</span>
              <span className="text-red-400 font-medium">NO {100 - yesOdds}%</span>
            </div>
            <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full" style={{ width: `${yesOdds}%` }} />
            </div>
          </div>
          <div className="flex gap-5 text-xs text-gray-600">
            <span>YES pool <span className="text-gray-400 font-mono">{formatStrk(yesPool)}</span></span>
            <span>NO pool <span className="text-gray-400 font-mono">{formatStrk(noPool)}</span></span>
          </div>
        </div>
        <div className="flex-shrink-0">
          {!resolved && (
            canBet ? (
              <button onClick={() => onBet(marketData)}
                className="bg-orange-500/10 hover:bg-orange-500 border border-orange-500/30 hover:border-orange-500 text-orange-400 hover:text-white font-semibold px-6 py-3 rounded-xl text-sm transition-all duration-200 whitespace-nowrap">
                Place Bet
              </button>
            ) : (
              <div className="text-gray-700 text-xs text-center max-w-[100px] leading-relaxed">Connect wallets to bet</div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Market list ─────────────────────────────────────────────────────────────
export function MarketList({ refreshKey }: { refreshKey?: number }) {
  const [selectedMarket, setSelectedMarket] = useState<MarketData | null>(null);
  const starknet = useStarknetWallet();
  const bitcoin = useBitcoinWallet();
  const canBet = starknet.isConnected && !!bitcoin.wallet;

  const { data: countRaw, isLoading, refetch } = useReadContract({
    abi: MARKET_ABI as any,
    address: MARKET_LOGIC_ADDRESS as `0x${string}`,
    functionName: "get_market_count",
    args: [],
  });

  useEffect(() => {
    if (refreshKey) refetch();
  }, [refreshKey, refetch]);

  const marketCount = Number(countRaw ?? 0);
  const marketIds = Array.from({ length: marketCount }, (_, i) => i);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="w-full bg-white/[0.02] border border-white/[0.06] rounded-2xl px-8 py-6 animate-pulse">
            <div className="h-4 bg-white/5 rounded w-3/4 mb-3" />
            <div className="h-6 bg-white/5 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (marketCount === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-lg font-semibold mb-2">No markets yet</p>
        <p className="text-sm text-gray-500">Be the first to create a prediction market.</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {marketIds.map((id) => (
          <MarketCard key={id} marketId={id} canBet={!!canBet} onBet={setSelectedMarket} />
        ))}
      </div>
      {selectedMarket && <BetModal market={selectedMarket} onClose={() => setSelectedMarket(null)} />}
    </>
  );
}
