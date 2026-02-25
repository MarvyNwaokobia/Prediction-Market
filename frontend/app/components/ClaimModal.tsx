"use client";
import { useState } from "react";
import { useAccount } from "@starknet-react/core";
import { RpcProvider } from "starknet";
import { deserializeNote, generateNote, serializeNote } from "../lib/mixer";
import { VAULT_ADDRESS } from "../lib/constants";
import type { AccountInterface } from "starknet";

interface Props { onClose: () => void; }

type ClaimStep = "form" | "claiming" | "done" | "error";

export function ClaimModal({ onClose }: Props) {
    const { account } = useAccount();
    const [encodedNote, setEncodedNote] = useState("");
    const [marketId, setMarketId] = useState("");
    const [step, setStep] = useState<ClaimStep>("form");
    const [errorMsg, setErrorMsg] = useState("");
    const [newNote, setNewNote] = useState<ReturnType<typeof generateNote> | null>(null);
    const [noteCopied, setNoteCopied] = useState(false);

    const copyNote = async () => {
        if (!newNote) return;
        await navigator.clipboard.writeText(serializeNote(newNote));
        setNoteCopied(true);
        setTimeout(() => setNoteCopied(false), 2000);
    };

    const handleClaim = async () => {
        if (!encodedNote.trim() || !marketId || !account) return;
        setStep("claiming");
        try {
            // ── Deserialize the saved bet-receipt note ──────────────────────────
            const note = deserializeNote(encodedNote.trim());

            // ── Fetch current Merkle root ────────────────────────────────────────
            const provider = new RpcProvider({
                nodeUrl: process.env.NEXT_PUBLIC_STARKNET_RPC!,
            });
            const rootResult = await provider.callContract({
                contractAddress: VAULT_ADDRESS,
                entrypoint: "get_root",
                calldata: [],
            });
            const vaultRoot = rootResult[0];

            // ── Generate a fresh re-shield commitment for the winnings ───────────
            const freshNote = generateNote(BigInt(0)); // amount encoded in vault, 0 placeholder
            setNewNote(freshNote);

            // ── Call claim_winnings(nullifier, root, market_id, new_commitment) ──
            // MVP: vault uses commitment itself as the key (identity _compute_nullifier).
            // The bet was stored keyed on new_commitment from place_bet, which is note.commitment.
            await (account as AccountInterface).execute([
                {
                    contractAddress: VAULT_ADDRESS,
                    entrypoint: "claim_winnings",
                    calldata: [
                        note.commitment,         // nullifier: felt252 (MVP: betReceiptNote.commitment)
                        vaultRoot,               // root: felt252
                        marketId.toString(),     // market_id: u64
                        freshNote.commitment,    // new_commitment: felt252 (re-shielded winnings)
                    ],
                },
            ]);

            setStep("done");
        } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : String(err));
            setStep("error");
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="bg-[#0D1117] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
                    <div>
                        <div className="text-white font-semibold">Claim Winnings</div>
                        <div className="text-gray-600 text-xs mt-0.5">Paste your bet-receipt note to claim</div>
                    </div>
                    <button onClick={onClose}
                        className="text-gray-600 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 transition-all">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6">

                    {/* ── FORM ── */}
                    {step === "form" && (
                        <>
                            <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-3.5 mb-5 text-xs text-yellow-300/70 leading-relaxed">
                                You need the claim note that was shown after placing your bet. This is the only way to prove ownership of your shielded position.
                            </div>

                            <div className="mb-4">
                                <label className="text-gray-400 text-sm mb-2 block">Bet-Receipt Note</label>
                                <textarea
                                    value={encodedNote}
                                    onChange={(e) => setEncodedNote(e.target.value)}
                                    placeholder="Paste your Base64 claim note here..."
                                    rows={4}
                                    className="w-full bg-white/[0.03] border border-white/10 focus:border-orange-500/50 rounded-xl px-4 py-3 text-white placeholder-gray-700 focus:outline-none transition-colors text-xs font-mono resize-none"
                                />
                            </div>

                            <div className="mb-6">
                                <label className="text-gray-400 text-sm mb-2 block">Market ID</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={marketId}
                                    onChange={(e) => setMarketId(e.target.value)}
                                    placeholder="e.g. 0"
                                    className="w-full bg-white/[0.03] border border-white/10 focus:border-orange-500/50 rounded-xl px-4 py-3 text-white placeholder-gray-700 focus:outline-none transition-colors text-sm"
                                />
                            </div>

                            <button
                                onClick={handleClaim}
                                disabled={!encodedNote.trim() || !marketId || !account}
                                className="w-full bg-orange-500 hover:bg-orange-400 disabled:bg-white/5 disabled:text-gray-600 text-white font-semibold py-3 rounded-xl transition-all text-sm">
                                {!account ? "Connect Starknet Wallet First" : "Claim Winnings"}
                            </button>
                        </>
                    )}

                    {/* ── CLAIMING ── */}
                    {step === "claiming" && (
                        <div className="text-center py-8">
                            <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                            <p className="text-white font-semibold mb-2">Claiming Winnings</p>
                            <p className="text-gray-500 text-sm">Verifying nullifier and re-shielding winnings...</p>
                        </div>
                    )}

                    {/* ── ERROR ── */}
                    {step === "error" && (
                        <div className="text-center py-8">
                            <p className="text-red-400 font-semibold mb-2">Claim Failed</p>
                            <p className="text-gray-500 text-xs break-all mb-6 leading-relaxed">{errorMsg}</p>
                            <button onClick={() => { setStep("form"); setErrorMsg(""); }}
                                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold py-3 rounded-xl transition-all text-sm">
                                Try Again
                            </button>
                        </div>
                    )}

                    {/* ── DONE ── */}
                    {step === "done" && newNote && (
                        <div className="text-center py-8">
                            <div className="w-14 h-14 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            </div>
                            <p className="text-white font-bold text-xl mb-1">Winnings Claimed</p>
                            <p className="text-gray-500 text-sm mb-6">Your winnings are re-shielded. Save your new note to withdraw later.</p>

                            <div className="bg-white/[0.02] border border-yellow-500/20 rounded-xl p-4 text-left mb-4">
                                <p className="text-yellow-400 text-xs font-semibold mb-1 uppercase tracking-wide">New Withdraw Note — Save This</p>
                                <p className="text-xs font-mono text-yellow-300/80 break-all leading-relaxed">{serializeNote(newNote).slice(0, 60)}...</p>
                            </div>

                            <button onClick={copyNote}
                                className="w-full bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 text-yellow-400 font-semibold py-2.5 rounded-xl transition-all text-sm mb-3">
                                {noteCopied ? "Note Copied" : "Copy Withdraw Note"}
                            </button>
                            <button onClick={onClose}
                                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold py-3 rounded-xl transition-all text-sm">
                                Close
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
