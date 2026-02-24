"use client";
import { useState } from "react";
import { useStarknetWallet, useBitcoinWallet } from "../hooks/useWallet";

function BitcoinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="#F7931A"/>
      <path d="M22.5 13.5c.3-2-1.2-3.1-3.3-3.8l.7-2.7-1.7-.4-.7 2.6-1.3-.3.7-2.7-1.7-.4-.7 2.7-1.1-.3-2.3-.6-.4 1.8s1.2.3 1.2.3c.7.2.8.6.8 1l-.8 3.2.2.1h-.2l-1.1 4.4c-.1.2-.3.5-.8.4 0 0-1.2-.3-1.2-.3l-.8 2 2.2.5 1.2.3-.7 2.7 1.7.4.7-2.7 1.3.3-.7 2.7 1.7.4.7-2.7c2.9.5 5 .3 5.9-2.3.7-2-.03-3.2-1.5-3.9 1.1-.3 1.9-1 2.1-2.5zm-3.8 5.3c-.5 2-3.9.9-5 .6l.9-3.5c1.1.3 4.6.8 4.1 2.9zm.5-5.3c-.5 1.8-3.3.9-4.3.7l.8-3.2c1 .3 3.9.7 3.5 2.5z" fill="white"/>
    </svg>
  );
}

function StarknetIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="#0C0C4F"/>
      <path d="M16 6L26 11V21L16 26L6 21V11L16 6Z" fill="#EC796B" opacity="0.9"/>
      <path d="M16 10L22 13.5V20.5L16 24L10 20.5V13.5L16 10Z" fill="#0C0C4F"/>
      <path d="M16 13L19 14.7V18.3L16 20L13 18.3V14.7L16 13Z" fill="#EC796B"/>
    </svg>
  );
}

export function WalletBar() {
  const starknet = useStarknetWallet();
  const bitcoin = useBitcoinWallet();
  const [showBtcMenu, setShowBtcMenu] = useState(false);
  const [showSnMenu, setShowSnMenu] = useState(false);

  return (
    <div className="flex items-center gap-2">

      {/* ── BITCOIN WALLET ── */}
      {bitcoin.wallet ? (
        <div className="flex items-center gap-2 bg-[#F7931A]/10 border border-[#F7931A]/20 rounded-full px-3 py-1.5">
          <BitcoinIcon />
          <span className="text-[#F7931A] text-xs font-mono">{bitcoin.shortAddress}</span>
          <button onClick={bitcoin.disconnect} className="text-[#F7931A]/50 hover:text-[#F7931A] text-xs ml-1 transition-colors">×</button>
        </div>
      ) : (
        <div className="relative">
          <button
            onClick={() => { setShowBtcMenu(!showBtcMenu); setShowSnMenu(false); }}
            className="flex items-center gap-2 bg-[#F7931A]/10 hover:bg-[#F7931A]/20 border border-[#F7931A]/30 hover:border-[#F7931A]/50 text-[#F7931A] font-medium px-4 py-2 rounded-full text-sm transition-all"
          >
            <BitcoinIcon />
            <span>Connect Bitcoin</span>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" className={`transition-transform ${showBtcMenu ? "rotate-180" : ""}`}>
              <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
            </svg>
          </button>

          {showBtcMenu && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-[#0D1117] border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-50">
              <div className="px-4 py-2.5 border-b border-white/5">
                <p className="text-gray-500 text-xs">Select Bitcoin Wallet</p>
              </div>
              {[
                { id: "leather" as const, name: "Leather", desc: "Native BTC wallet", dot: "#FF7043" },
                { id: "unisat" as const, name: "UniSat", desc: "Bitcoin & Ordinals", dot: "#E91E63" },
              ].map((w) => (
                <button key={w.id}
                  onClick={() => { bitcoin.connect(w.id); setShowBtcMenu(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
                >
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: w.dot }} />
                  <div>
                    <div className="text-white text-sm font-medium">{w.name}</div>
                    <div className="text-gray-500 text-xs">{w.desc}</div>
                  </div>
                </button>
              ))}
              <div className="px-4 py-2.5 border-t border-white/5">
                <p className="text-gray-600 text-xs">BTC used as collateral via atomic swap</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── DIVIDER ── */}
      <div className="w-px h-5 bg-white/10" />

      {/* ── STARKNET WALLET ── */}
      {starknet.isConnected ? (
        <div className="flex items-center gap-2 bg-[#EC796B]/10 border border-[#EC796B]/20 rounded-full px-3 py-1.5">
          <StarknetIcon />
          <span className="text-[#EC796B] text-xs font-mono">{starknet.shortAddress}</span>
          <button onClick={() => starknet.disconnect()} className="text-[#EC796B]/50 hover:text-[#EC796B] text-xs ml-1 transition-colors">×</button>
        </div>
      ) : (
        <div className="relative">
          <button
            onClick={() => { setShowSnMenu(!showSnMenu); setShowBtcMenu(false); }}
            className="flex items-center gap-2 bg-[#EC796B]/10 hover:bg-[#EC796B]/20 border border-[#EC796B]/30 hover:border-[#EC796B]/50 text-[#EC796B] font-medium px-4 py-2 rounded-full text-sm transition-all"
          >
            <StarknetIcon />
            <span>Connect Starknet</span>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" className={`transition-transform ${showSnMenu ? "rotate-180" : ""}`}>
              <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
            </svg>
          </button>

          {showSnMenu && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-[#0D1117] border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-50">
              <div className="px-4 py-2.5 border-b border-white/5">
                <p className="text-gray-500 text-xs">Select Starknet Wallet</p>
              </div>
              {starknet.connectors.map((connector) => (
                <button key={connector.id}
                  onClick={() => { starknet.connect({ connector }); setShowSnMenu(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
                >
                  <div className="w-2 h-2 rounded-full bg-[#EC796B] flex-shrink-0" />
                  <div>
                    <div className="text-white text-sm font-medium">{connector.name}</div>
                    <div className="text-gray-500 text-xs">Starknet L2 wallet</div>
                  </div>
                </button>
              ))}
              <div className="px-4 py-2.5 border-t border-white/5">
                <p className="text-gray-600 text-xs">Used for ZK proof submission</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
