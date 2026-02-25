"use client";
import Link from "next/link";
import { useReadContract } from "@starknet-react/core";
import { useStarknetWallet, useBitcoinWallet } from "./hooks/useWallet";
import { MARKET_ABI, VAULT_ABI } from "./lib/abis";
import { MARKET_LOGIC_ADDRESS, VAULT_ADDRESS } from "./lib/constants";

export default function Home() {
  const starknet = useStarknetWallet();
  const bitcoin = useBitcoinWallet();
  const bothConnected = starknet.isConnected && !!bitcoin.wallet;

  const { data: marketCount } = useReadContract({
    abi: MARKET_ABI as any,
    address: MARKET_LOGIC_ADDRESS as `0x${string}`,
    functionName: "get_market_count",
    args: [],
  });
  const { data: treeSize } = useReadContract({
    abi: VAULT_ABI as any,
    address: VAULT_ADDRESS as `0x${string}`,
    functionName: "get_tree_size",
    args: [],
  });

  return (
    <div className="w-full overflow-x-hidden">

      {/* ── Hero ── */}
      <section className="w-full pt-24 pb-20">
        <div className="max-w-4xl mx-auto px-6 text-center">

          <div className="inline-flex items-center gap-2 border border-orange-500/20 bg-orange-500/5 rounded-full px-4 py-1.5 mb-10">
            <div className="w-1.5 h-1.5 bg-orange-400 rounded-full" />
            <span className="text-orange-400 text-xs font-semibold uppercase tracking-widest">Live on Starknet Sepolia</span>
          </div>

          <h1 className="text-6xl font-black leading-none tracking-tight text-white mb-6">
            Predict Markets.<br />
            <span className="text-orange-400">Stay Private.</span>
          </h1>

          <p className="text-gray-400 text-lg leading-relaxed max-w-lg mx-auto mb-10">
            The first prediction protocol with real Bitcoin collateral, ZK-shielded positions,
            and cryptographic settlement via STARK proofs. No custodians. No exposure.
          </p>

          <div className="flex flex-wrap justify-center gap-2 mb-12">
            {[
              { label: "BTC Collateral", color: "text-[#F7931A] border-[#F7931A]/20" },
              { label: "ZK Privacy", color: "text-purple-400 border-purple-400/20" },
              { label: "STARK Proofs", color: "text-blue-400 border-blue-400/20" },
              { label: "Non-Custodial", color: "text-green-400 border-green-400/20" },
            ].map(({ label, color }) => (
              <span key={label} className={`border rounded-full px-4 py-1.5 text-xs font-medium bg-white/[0.02] ${color}`}>
                {label}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap justify-center gap-3 mb-16">
            <Link href="/markets"
              className="bg-orange-500 hover:bg-orange-400 text-white font-semibold px-8 py-3 rounded-2xl transition-all text-sm">
              Browse Markets
            </Link>
            <Link href={bothConnected ? "/portfolio" : "/markets"}
              className="bg-white/5 hover:bg-white/10 text-white font-semibold px-8 py-3 rounded-2xl border border-white/10 transition-all text-sm">
              {bothConnected ? "Your Portfolio" : "Get Started"}
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 max-w-xl mx-auto">
            {[
              { label: "Total Markets", value: marketCount !== undefined ? String(Number(marketCount)) : "—" },
              { label: "Shielded Volume", value: "—" },
              { label: "ZK Commitments", value: treeSize !== undefined ? String(Number(treeSize)) : "—" },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 text-center">
                <div className="text-3xl font-bold text-white mb-1">{value}</div>
                <div className="text-xs text-gray-500 uppercase tracking-wider">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="w-full pb-24">
        <div className="max-w-4xl mx-auto px-6">
          <div className="border border-white/[0.08] bg-white/[0.02] rounded-3xl p-10">
            <h2 className="text-xl font-bold text-white text-center mb-12">How Privacy Works</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {[
                { step: "01", title: "Deposit BTC", desc: "Lock real BTC via Lightning. Atomiq atomically swaps it to STRK on Starknet." },
                { step: "02", title: "Shield It", desc: "Generate a Pedersen commitment off-chain. Your deposit enters the Merkle vault anonymously." },
                { step: "03", title: "Bet Anonymously", desc: "Submit your commitment as a bet. Zero address traceability on-chain." },
                { step: "04", title: "Claim Privately", desc: "Winnings re-enter the shielded pool. Withdraw anytime via nullifier proof." },
              ].map(({ step, title, desc }) => (
                <div key={step} className="text-center">
                  <div className="text-5xl font-black text-white/[0.08] mb-4">{step}</div>
                  <div className="text-orange-400 font-semibold text-sm mb-2">{title}</div>
                  <div className="text-gray-500 text-xs leading-relaxed">{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}





