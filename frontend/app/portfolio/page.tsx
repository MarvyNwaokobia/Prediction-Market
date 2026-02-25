"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useStarknetWallet, useBitcoinWallet } from "../hooks/useWallet";
import { DepositModal } from "../components/DepositModal";
import { ClaimModal } from "../components/ClaimModal";
import { WithdrawModal } from "../components/WithdrawModal";
import { deserializeNote, serializeNote, weiToSbtc } from "../lib/mixer";
import { getStrkBalance } from "../lib/atomiq";
import { STRK_ADDRESS } from "../lib/constants";
import type { MixerNote } from "../lib/mixer";

type ActiveModal = null | "deposit" | "claim" | "withdraw";

interface SavedNote {
    serialized: string;
    note: MixerNote;
    savedAt: number;
}

function loadSavedNotes(address: string): SavedNote[] {
    if (typeof window === "undefined") return [];
    try {
        const raw: string[] = JSON.parse(localStorage.getItem(`starkbet_notes_${address}`) ?? "[]");
        return raw.map((s) => ({ serialized: s, note: deserializeNote(s), savedAt: 0 }));
    } catch { return []; }
}

function formatStrk(wei: bigint): string {
    const s = weiToSbtc(wei); // reuse 18-decimal formatter
    const parts = s.split(".");
    if (!parts[1]) return `${parts[0]} STRK`;
    return `${parts[0]}.${parts[1].slice(0, 4)} STRK`;
}

const ACTIONS = [
    {
        id: "deposit" as const,
        title: "Deposit Collateral",
        description:
            "Convert BTC to STRK via a Lightning atomic swap and shield it in the vault. You receive a private note as your receipt.",
        cta: "Deposit BTC",
        color: "#F7931A",
    },
    {
        id: "claim" as const,
        title: "Claim Winnings",
        description:
            "Present your bet-receipt note and market ID to claim winnings. Proceeds are re-shielded as a fresh commitment.",
        cta: "Claim",
        color: "#EC796B",
    },
    {
        id: "withdraw" as const,
        title: "Withdraw",
        description:
            "Exit the shielded pool. Present your private note to transfer STRK to any Starknet address without on-chain history.",
        cta: "Withdraw",
        color: "#6B7FEC",
    },
];

export default function PortfolioPage() {
    const starknet = useStarknetWallet();
    const bitcoin = useBitcoinWallet();
    const bothConnected = starknet.isConnected && !!bitcoin.wallet;
    const [activeModal, setActiveModal] = useState<ActiveModal>(null);
    const [strkBalance, setStrkBalance] = useState<bigint | null>(null);
    const [savedNotes, setSavedNotes] = useState<SavedNote[]>([]);
    const [noteToRemove, setNoteToRemove] = useState<string | null>(null);

    // Load STRK balance + notes when connected
    const refresh = useCallback(() => {
        if (!starknet.address) return;
        getStrkBalance(starknet.address, STRK_ADDRESS, process.env.NEXT_PUBLIC_STARKNET_RPC!)
            .then(setStrkBalance)
            .catch(() => setStrkBalance(null));
        setSavedNotes(loadSavedNotes(starknet.address));
    }, [starknet.address]);

    useEffect(() => { refresh(); }, [refresh]);
    // Refresh when a modal closes (deposit may have added a note)
    useEffect(() => { if (!activeModal) refresh(); }, [activeModal, refresh]);

    const removeNote = (serialized: string) => {
        if (!starknet.address) return;
        const key = `starkbet_notes_${starknet.address}`;
        const remaining = savedNotes.filter((n) => n.serialized !== serialized).map((n) => n.serialized);
        localStorage.setItem(key, JSON.stringify(remaining));
        setSavedNotes((prev) => prev.filter((n) => n.serialized !== serialized));
        setNoteToRemove(null);
    };

    const totalCollateral = savedNotes.reduce((acc, { note }) => acc + note.amount, 0n);

    /* ── Wallet gate ── */
    if (!bothConnected) {
        return (
            <div className="w-full min-h-[calc(100vh-65px)] flex flex-col items-center justify-center px-6">
                <div className="max-w-sm w-full">
                    <p className="text-white font-semibold text-lg mb-1">Wallet connection required</p>
                    <p className="text-gray-500 text-sm mb-8">
                        Connect both your Bitcoin and Starknet wallets to access your portfolio.
                    </p>

                    <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl divide-y divide-white/[0.06]">
                        <div className="flex items-center justify-between px-5 py-4">
                            <div>
                                <p className={`text-sm font-medium ${bitcoin.wallet ? "text-[#F7931A]" : "text-gray-400"}`}>Bitcoin wallet</p>
                                <p className="text-gray-600 text-xs mt-0.5">Used for Lightning collateral deposits</p>
                            </div>
                            <span className={`text-xs font-mono ${bitcoin.wallet ? "text-[#F7931A]" : "text-gray-600"}`}>
                                {bitcoin.wallet ? bitcoin.shortAddress : "Not connected"}
                            </span>
                        </div>
                        <div className="flex items-center justify-between px-5 py-4">
                            <div>
                                <p className={`text-sm font-medium ${starknet.isConnected ? "text-[#EC796B]" : "text-gray-400"}`}>Starknet wallet</p>
                                <p className="text-gray-600 text-xs mt-0.5">Used for ZK proofs and settlement</p>
                            </div>
                            <span className={`text-xs font-mono ${starknet.isConnected ? "text-[#EC796B]" : "text-gray-600"}`}>
                                {starknet.isConnected ? starknet.shortAddress : "Not connected"}
                            </span>
                        </div>
                    </div>

                    <p className="text-gray-600 text-xs mt-4 text-center">
                        Use the wallet buttons in the top-right header to connect.
                    </p>
                </div>
            </div>
        );
    }

    /* ── Connected view ── */
    return (
        <div className="w-full overflow-x-hidden">
            <div className="max-w-5xl mx-auto px-6 py-12">

                {/* Page header */}
                <div className="mb-10">
                    <h1 className="text-3xl font-bold text-white mb-1">Portfolio</h1>
                    <p className="text-gray-500 text-sm">Your shielded collateral and private positions</p>
                </div>

                {/* Balance overview */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
                    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
                        <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">Wallet STRK</p>
                        <p className="text-white text-2xl font-bold">
                            {strkBalance === null ? "—" : formatStrk(strkBalance)}
                        </p>
                        <p className="text-gray-600 text-[11px] mt-1">Available to deposit</p>
                    </div>
                    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
                        <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">Shielded Collateral</p>
                        <p className="text-white text-2xl font-bold">
                            {savedNotes.length === 0 ? "0 STRK" : formatStrk(totalCollateral)}
                        </p>
                        <p className="text-gray-600 text-[11px] mt-1">{savedNotes.length} active note{savedNotes.length !== 1 ? "s" : ""} in vault</p>
                    </div>
                    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
                        <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">Wallet</p>
                        <p className="text-[#EC796B] text-sm font-mono truncate mt-1">{starknet.shortAddress}</p>
                        <p className="text-[#F7931A] text-sm font-mono truncate mt-1">{bitcoin.shortAddress}</p>
                    </div>
                </div>

                {/* Action cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
                    {([
                        {
                            id: "deposit" as const,
                            title: "Deposit Collateral",
                            description: "Convert BTC to STRK via a Lightning atomic swap and shield it in the vault. You receive a private note as your receipt.",
                            cta: "Deposit BTC",
                            color: "#F7931A",
                        },
                        {
                            id: "claim" as const,
                            title: "Claim Winnings",
                            description: "Present your bet-receipt note and market ID to claim winnings. Proceeds are re-shielded as a fresh commitment.",
                            cta: "Claim",
                            color: "#EC796B",
                        },
                        {
                            id: "withdraw" as const,
                            title: "Withdraw",
                            description: "Exit the shielded pool. Present your private note to transfer STRK to any Starknet address without on-chain history.",
                            cta: "Withdraw",
                            color: "#6B7FEC",
                        },
                    ]).map((action) => (
                        <div key={action.id}
                            className="bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.1] rounded-2xl p-6 flex flex-col transition-colors">
                            <h3 className="text-white font-semibold text-base mb-2">{action.title}</h3>
                            <p className="text-gray-500 text-xs leading-relaxed flex-1 mb-5">{action.description}</p>
                            <button
                                onClick={() => setActiveModal(action.id)}
                                className="w-full py-2.5 rounded-xl font-medium text-sm transition-colors"
                                style={{ color: action.color, border: `1px solid ${action.color}26`, backgroundColor: `${action.color}0d` }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = `${action.color}1a`; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = `${action.color}0d`; }}>
                                {action.cta}
                            </button>
                        </div>
                    ))}
                </div>

                {/* Saved notes */}
                <div className="border border-white/[0.06] rounded-2xl p-6 mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-white font-semibold">Private Notes</h2>
                            <p className="text-gray-600 text-xs mt-0.5">
                                Notes are your proof of ownership — never shared on-chain
                            </p>
                        </div>
                        <button onClick={refresh}
                            className="text-gray-600 hover:text-gray-400 text-xs border border-white/[0.06] hover:border-white/10 px-3 py-1.5 rounded-lg transition-colors">
                            Refresh
                        </button>
                    </div>

                    {savedNotes.length === 0 ? (
                        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl px-5 py-10 text-center">
                            <p className="text-gray-500 text-sm mb-1">No notes yet</p>
                            <p className="text-gray-700 text-xs">Deposit collateral to create your first shielded note</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {savedNotes.map(({ serialized, note }) => (
                                <div key={serialized}
                                    className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 flex items-center gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-1.5">
                                            <span className="text-white font-semibold text-sm">{formatStrk(note.amount)}</span>
                                            <span className="text-[10px] text-gray-600 bg-white/[0.04] border border-white/[0.06] rounded px-1.5 py-0.5">shielded</span>
                                        </div>
                                        <p className="text-gray-700 text-[10px] font-mono truncate">{serialized.slice(0, 40)}…</p>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <button
                                            onClick={async () => { await navigator.clipboard.writeText(serialized); }}
                                            className="text-gray-500 hover:text-white text-xs border border-white/[0.06] hover:border-white/10 px-3 py-1.5 rounded-lg transition-colors">
                                            Copy
                                        </button>
                                        {noteToRemove === serialized ? (
                                            <div className="flex items-center gap-1">
                                                <button onClick={() => removeNote(serialized)}
                                                    className="text-red-400 text-xs border border-red-500/20 px-2 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors">
                                                    Confirm
                                                </button>
                                                <button onClick={() => setNoteToRemove(null)}
                                                    className="text-gray-600 text-xs border border-white/[0.06] px-2 py-1.5 rounded-lg hover:border-white/10 transition-colors">
                                                    Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <button onClick={() => setNoteToRemove(serialized)}
                                                className="text-gray-700 hover:text-red-400 text-xs border border-white/[0.04] hover:border-red-500/20 px-2 py-1.5 rounded-lg transition-colors">
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="text-center">
                    <Link href="/markets" className="text-gray-500 hover:text-white text-sm transition-colors">
                        Browse active markets to place bets
                    </Link>
                </div>
            </div>

            {activeModal === "deposit" && <DepositModal onClose={() => setActiveModal(null)} />}
            {activeModal === "claim" && <ClaimModal onClose={() => setActiveModal(null)} />}
            {activeModal === "withdraw" && <WithdrawModal onClose={() => setActiveModal(null)} />}
        </div>
    );
}
