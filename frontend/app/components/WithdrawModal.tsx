"use client";
import { useState } from "react";
import { useAccount } from "@starknet-react/core";
import { RpcProvider } from "starknet";
import { deserializeNote } from "../lib/mixer";
import { VAULT_ADDRESS } from "../lib/constants";
import type { AccountInterface } from "starknet";

interface Props { onClose: () => void; }

type WithdrawStep = "form" | "withdrawing" | "done" | "error";

export function WithdrawModal({ onClose }: Props) {
    const { account, address } = useAccount();
    const [encodedNote, setEncodedNote] = useState("");
    const [step, setStep] = useState<WithdrawStep>("form");
    const [errorMsg, setErrorMsg] = useState("");

    const handleWithdraw = async () => {
        if (!encodedNote.trim() || !account || !address) return;
        setStep("withdrawing");
        try {
            // ── Deserialize the saved withdraw note ──────────────────────────────
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

            // Amount is stored in the note (BigInt wei)
            const amountBig = note.amount;

            // ── Call withdraw(nullifier, root, recipient, amount) ────────────────
            // MVP: vault uses commitment itself as the key (identity _compute_nullifier).
            // commitment_amounts is keyed by the value passed to deposit/claim.
            await (account as AccountInterface).execute([
                {
                    contractAddress: VAULT_ADDRESS,
                    entrypoint: "withdraw",
                    calldata: [
                        note.commitment,        // nullifier: felt252 (MVP: commitment itself)
                        vaultRoot,              // root: felt252
                        address,               // recipient: ContractAddress (connected wallet)
                        amountBig.toString(),   // amount low: u256
                        "0",                    // amount high: u256
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
                        <div className="text-white font-semibold">Withdraw</div>
                        <div className="text-gray-600 text-xs mt-0.5">Exit the shielded vault to your Starknet wallet</div>
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
                            <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3.5 mb-5 text-xs text-blue-300/70 leading-relaxed">
                                Paste your withdraw note (from a Claim or Deposit). The sBTC will be sent directly to your connected Starknet address.
                            </div>

                            <div className="mb-5">
                                <label className="text-gray-400 text-sm mb-2 block">Withdraw Note</label>
                                <textarea
                                    value={encodedNote}
                                    onChange={(e) => setEncodedNote(e.target.value)}
                                    placeholder="Paste your Base64 withdraw note here..."
                                    rows={4}
                                    className="w-full bg-white/[0.03] border border-white/10 focus:border-orange-500/50 rounded-xl px-4 py-3 text-white placeholder-gray-700 focus:outline-none transition-colors text-xs font-mono resize-none"
                                />
                            </div>

                            {address && (
                                <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 mb-5 text-xs">
                                    <span className="text-gray-500">Recipient: </span>
                                    <span className="text-gray-300 font-mono">{address.slice(0, 10)}...{address.slice(-6)}</span>
                                </div>
                            )}

                            <button
                                onClick={handleWithdraw}
                                disabled={!encodedNote.trim() || !account}
                                className="w-full bg-orange-500 hover:bg-orange-400 disabled:bg-white/5 disabled:text-gray-600 text-white font-semibold py-3 rounded-xl transition-all text-sm">
                                {!account ? "Connect Starknet Wallet First" : "Withdraw sBTC"}
                            </button>
                        </>
                    )}

                    {/* ── WITHDRAWING ── */}
                    {step === "withdrawing" && (
                        <div className="text-center py-8">
                            <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                            <p className="text-white font-semibold mb-2">Processing Withdrawal</p>
                            <p className="text-gray-500 text-sm">Verifying nullifier and transferring sBTC...</p>
                        </div>
                    )}

                    {/* ── ERROR ── */}
                    {step === "error" && (
                        <div className="text-center py-8">
                            <p className="text-red-400 font-semibold mb-2">Withdrawal Failed</p>
                            <p className="text-gray-500 text-xs break-all mb-6 leading-relaxed">{errorMsg}</p>
                            <button onClick={() => { setStep("form"); setErrorMsg(""); }}
                                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold py-3 rounded-xl transition-all text-sm">
                                Try Again
                            </button>
                        </div>
                    )}

                    {/* ── DONE ── */}
                    {step === "done" && (
                        <div className="text-center py-8">
                            <div className="w-14 h-14 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            </div>
                            <p className="text-white font-bold text-xl mb-2">Withdrawal Complete</p>
                            <p className="text-gray-500 text-sm mb-6">sBTC has been sent to your Starknet wallet.</p>
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
