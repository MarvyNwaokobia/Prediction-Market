"use client";
import { useState, useEffect, useRef } from "react";
import { useStarknetWallet, useBitcoinWallet } from "../hooks/useWallet";

export function WalletBar() {
  const starknet = useStarknetWallet();
  const bitcoin = useBitcoinWallet();
  const [showBtcMenu, setShowBtcMenu] = useState(false);
  const [showSnMenu, setShowSnMenu] = useState(false);
  const btcRef = useRef<HTMLDivElement>(null);
  const snRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (btcRef.current && !btcRef.current.contains(e.target as Node)) setShowBtcMenu(false);
      if (snRef.current && !snRef.current.contains(e.target as Node)) setShowSnMenu(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  return (
    <div className="flex items-center gap-2">

      {/* ── Bitcoin wallet ── */}
      <div ref={btcRef}>
        {bitcoin.wallet ? (
          <div className="flex items-center gap-2 bg-[#F7931A]/10 border border-[#F7931A]/20 rounded-full px-3 py-1.5">
            <span className="text-[#F7931A] text-[11px] font-semibold tracking-wide">BTC</span>
            <span className="text-[#F7931A] text-xs font-mono">{bitcoin.shortAddress}</span>
            <button
              onClick={bitcoin.disconnect}
              aria-label="Disconnect Bitcoin wallet"
              className="text-[#F7931A]/40 hover:text-[#F7931A] text-base leading-none ml-0.5 transition-colors"
            >×</button>
          </div>
        ) : (
          <div className="relative">
            <button
              onClick={() => { setShowBtcMenu(v => !v); setShowSnMenu(false); }}
              className="bg-[#F7931A]/10 hover:bg-[#F7931A]/20 border border-[#F7931A]/30 hover:border-[#F7931A]/50 text-[#F7931A] font-medium px-4 py-2 rounded-full text-sm transition-all"
            >
              Connect Bitcoin
            </button>

            {showBtcMenu && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-[#0D1117] border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-50">
                <div className="px-4 py-3 border-b border-white/[0.06]">
                  <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Select wallet</p>
                </div>
                {[
                  { id: "leather" as const, name: "Leather", desc: "Native BTC wallet" },
                  { id: "unisat" as const, name: "UniSat", desc: "Bitcoin and Ordinals" },
                ].map((w) => (
                  <button
                    key={w.id}
                    onClick={() => { bitcoin.connect(w.id); setShowBtcMenu(false); }}
                    className="w-full flex flex-col px-4 py-3 hover:bg-white/5 transition-colors text-left"
                  >
                    <span className="text-white text-sm font-medium">{w.name}</span>
                    <span className="text-gray-500 text-xs">{w.desc}</span>
                  </button>
                ))}
                <div className="px-4 py-2.5 border-t border-white/[0.06]">
                  <p className="text-gray-700 text-xs">BTC used as collateral via atomic swap</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="w-px h-5 bg-white/10" />

      {/* ── Starknet wallet ── */}
      <div ref={snRef}>
        {starknet.isConnected ? (
          <div className="flex items-center gap-2 bg-[#EC796B]/10 border border-[#EC796B]/20 rounded-full px-3 py-1.5">
            <span className="text-[#EC796B] text-[11px] font-semibold tracking-wide">SNK</span>
            <span className="text-[#EC796B] text-xs font-mono">{starknet.shortAddress}</span>
            <button
              onClick={() => starknet.disconnect()}
              aria-label="Disconnect Starknet wallet"
              className="text-[#EC796B]/40 hover:text-[#EC796B] text-base leading-none ml-0.5 transition-colors"
            >×</button>
          </div>
        ) : (
          <div className="relative">
            <button
              onClick={() => { setShowSnMenu(v => !v); setShowBtcMenu(false); }}
              className="bg-[#EC796B]/10 hover:bg-[#EC796B]/20 border border-[#EC796B]/30 hover:border-[#EC796B]/50 text-[#EC796B] font-medium px-4 py-2 rounded-full text-sm transition-all"
            >
              Connect Starknet
            </button>

            {showSnMenu && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-[#0D1117] border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-50">
                <div className="px-4 py-3 border-b border-white/[0.06]">
                  <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Select wallet</p>
                </div>
                {starknet.connectors.map((connector) => (
                  <button
                    key={connector.id}
                    onClick={() => { starknet.connect({ connector }); setShowSnMenu(false); }}
                    className="w-full flex flex-col px-4 py-3 hover:bg-white/5 transition-colors text-left"
                  >
                    <span className="text-white text-sm font-medium">{connector.name}</span>
                    <span className="text-gray-500 text-xs">Starknet L2 wallet</span>
                  </button>
                ))}
                <div className="px-4 py-2.5 border-t border-white/[0.06]">
                  <p className="text-gray-700 text-xs">For ZK proof submission and settlement</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
