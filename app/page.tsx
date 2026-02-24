"use client";
import { useState } from "react";
import { useStarknetWallet, useBitcoinWallet } from "./hooks/useWallet";
import { WalletBar } from "./components/WalletBar";
import { MarketList } from "./components/MarketList";
import { DepositModal } from "./components/DepositModal";
import { CreateMarketModal } from "./components/CreateMarketModal";

export default function Home() {
  const starknet = useStarknetWallet();
  const bitcoin = useBitcoinWallet();
  const [showDeposit, setShowDeposit] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const bothConnected = starknet.isConnected && !!bitcoin.wallet;

  return (
    <div className="w-full min-h-screen bg-[#080B10] text-white">

      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[20%] w-[600px] h-[600px] bg-orange-500/[0.04] rounded-full blur-[120px]" />
        <div className="absolute top-[10%] right-[10%] w-[400px] h-[400px] bg-[#EC796B]/[0.04] rounded-full blur-[100px]" />
        <div className="absolute inset-0 opacity-[0.015]"
          style={{ backgroundImage: "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)", backgroundSize: "64px 64px" }} />
      </div>

      {/* ── HEADER ── */}
      <header className="relative w-full border-b border-white/[0.06] bg-[#080B10]/80 backdrop-blur-xl sticky top-0 z-20">
        <div className="w-full px-10 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
                <path d="M22.5 13.5c.3-2-1.2-3.1-3.3-3.8l.7-2.7-1.7-.4-.7 2.6-1.3-.3.7-2.7-1.7-.4-.7 2.7-1.1-.3-2.3-.6-.4 1.8s1.2.3 1.2.3c.7.2.8.6.8 1l-.8 3.2.2.1h-.2l-1.1 4.4c-.1.2-.3.5-.8.4l-1.2-.3-.8 2 2.2.5 1.2.3-.7 2.7 1.7.4.7-2.7 1.3.3-.7 2.7 1.7.4.7-2.7c2.9.5 5 .3 5.9-2.3.7-2-.03-3.2-1.5-3.9 1.1-.3 1.9-1 2.1-2.5zm-3.8 5.3c-.5 2-3.9.9-5 .6l.9-3.5c1.1.3 4.6.8 4.1 2.9zm.5-5.3c-.5 1.8-3.3.9-4.3.7l.8-3.2c1 .3 3.9.7 3.5 2.5z" fill="white"/>
              </svg>
            </div>
            <div>
              <div className="text-white font-bold text-base leading-tight">StarkBet</div>
              <div className="text-gray-600 text-xs">Bitcoin-Native · ZK-Private · Starknet</div>
            </div>
          </div>
          <WalletBar />
        </div>
      </header>

      {/* ── HERO — centered container ── */}
      <section className="relative w-full pt-20 pb-16">
        <div style={{ maxWidth: "720px", margin: "0 auto", padding: "0 24px", textAlign: "center" }}>

          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", border: "1px solid rgba(249,115,22,0.2)", background: "rgba(249,115,22,0.05)", borderRadius: "999px", padding: "6px 16px", marginBottom: "32px" }}>
            <div style={{ width: "6px", height: "6px", background: "#fb923c", borderRadius: "50%" }} />
            <span style={{ color: "#fb923c", fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>Live on Starknet Sepolia</span>
          </div>

          <h1 style={{ fontSize: "clamp(3rem, 7vw, 5.5rem)", fontWeight: 900, lineHeight: 1.0, letterSpacing: "-0.03em", color: "white", marginBottom: "24px" }}>
            Predict Markets.<br />
            <span style={{ background: "linear-gradient(to right, #f97316, #ea580c)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Stay Private.
            </span>
          </h1>

          <p style={{ color: "#9ca3af", fontSize: "1.1rem", lineHeight: 1.7, maxWidth: "520px", margin: "0 auto 40px auto" }}>
            The first prediction protocol with real Bitcoin collateral, ZK-shielded positions,
            and cryptographic settlement via STARK proofs. No custodians. No exposure.
          </p>

          {/* Feature pills */}
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "8px", marginBottom: "36px" }}>
            {[
              { label: "BTC Collateral", color: "#F7931A" },
              { label: "ZK Privacy", color: "#A78BFA" },
              { label: "STARK Proofs", color: "#60A5FA" },
              { label: "Non-Custodial", color: "#34D399" },
            ].map(({ label, color }) => (
              <div key={label} style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", borderRadius: "999px", padding: "6px 16px", fontSize: "13px", fontWeight: 500, color }}>{label}</div>
            ))}
          </div>

          {/* Connection guide */}
          {!bothConnected && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", marginBottom: "36px", padding: "10px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: 500, border: bitcoin.wallet ? "1px solid rgba(247,147,26,0.3)" : "1px solid rgba(255,255,255,0.1)", background: bitcoin.wallet ? "rgba(247,147,26,0.1)" : "rgba(255,255,255,0.05)", color: bitcoin.wallet ? "#F7931A" : "#6b7280" }}>
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: bitcoin.wallet ? "#F7931A" : "#4b5563" }} />
                {bitcoin.wallet ? "Bitcoin connected" : "1. Connect Bitcoin"}
              </div>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: 500, border: starknet.isConnected ? "1px solid rgba(236,121,107,0.3)" : "1px solid rgba(255,255,255,0.1)", background: starknet.isConnected ? "rgba(236,121,107,0.1)" : "rgba(255,255,255,0.05)", color: starknet.isConnected ? "#EC796B" : "#6b7280" }}>
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: starknet.isConnected ? "#EC796B" : "#4b5563" }} />
                {starknet.isConnected ? "Starknet connected" : "2. Connect Starknet"}
              </div>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: 500, border: "1px solid rgba(255,255,255,0.1)", color: "#4b5563" }}>
                3. Start betting
              </div>
            </div>
          )}

          {/* CTAs */}
          {bothConnected && (
            <div style={{ display: "flex", justifyContent: "center", gap: "16px", marginBottom: "36px" }}>
              <button onClick={() => setShowDeposit(true)}
                style={{ background: "linear-gradient(to right, #f97316, #ea580c)", color: "white", fontWeight: 600, padding: "12px 32px", borderRadius: "16px", border: "none", cursor: "pointer", fontSize: "14px" }}>
                Deposit BTC Collateral
              </button>
              <button onClick={() => setShowCreate(true)}
                style={{ background: "rgba(255,255,255,0.05)", color: "white", fontWeight: 600, padding: "12px 32px", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", fontSize: "14px" }}>
                Create Market
              </button>
            </div>
          )}

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
            {[
              { label: "Total Markets", value: "12" },
              { label: "Shielded Volume", value: "3.4 sBTC" },
              { label: "ZK Commitments", value: "847" },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "16px", padding: "20px", textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "white" }}>{value}</div>
                <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MARKETS — centered container ── */}
      <section className="relative w-full pb-16">
        <div style={{ maxWidth: "900px", margin: "0 auto", padding: "0 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
            <div>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 700, color: "white" }}>Active Markets</h2>
              <p style={{ color: "#6b7280", fontSize: "13px", marginTop: "2px" }}>All positions are ZK-shielded on-chain</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#6b7280", fontSize: "12px", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "999px", padding: "6px 12px" }}>
              <div style={{ width: "6px", height: "6px", background: "#4ade80", borderRadius: "50%" }} />
              Live
            </div>
          </div>
          <MarketList />
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="relative w-full pb-24">
        <div style={{ maxWidth: "900px", margin: "0 auto", padding: "0 24px" }}>
          <div style={{ border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)", borderRadius: "24px", padding: "48px" }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "white", textAlign: "center", marginBottom: "48px" }}>How Privacy Works</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "32px" }}>
              {[
                { step: "01", title: "Deposit BTC", desc: "Lock real BTC via atomic HTLC swap. Receive synthetic sBTC credit minted on Starknet." },
                { step: "02", title: "Shield It", desc: "Generate a Pedersen commitment off-chain. Your deposit enters the Merkle vault anonymously." },
                { step: "03", title: "Bet Anonymously", desc: "Submit a ZK proof of Merkle membership. Place bets with zero on-chain address traceability." },
                { step: "04", title: "Claim Privately", desc: "Winnings re-enter the shielded pool as a fresh commitment. Withdraw anytime via nullifier proof." },
              ].map(({ step, title, desc }) => (
                <div key={step} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "3.5rem", fontWeight: 900, color: "rgba(255,255,255,0.04)", marginBottom: "12px" }}>{step}</div>
                  <div style={{ color: "#f97316", fontWeight: 600, fontSize: "13px", marginBottom: "8px" }}>{title}</div>
                  <div style={{ color: "#6b7280", fontSize: "12px", lineHeight: 1.6 }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {showDeposit && <DepositModal onClose={() => setShowDeposit(false)} />}
      {showCreate && <CreateMarketModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}