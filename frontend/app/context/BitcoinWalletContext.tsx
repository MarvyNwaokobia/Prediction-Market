"use client";
import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type BitcoinWallet = {
    address: string;
    publicKey: string;
    provider: "leather" | "unisat" | "xverse";
};

interface BitcoinWalletContextValue {
    wallet: BitcoinWallet | null;
    connecting: boolean;
    error: string | null;
    shortAddress: string | null;
    connect: (provider: "leather" | "unisat" | "xverse") => Promise<void>;
    disconnect: () => void;
}

const BitcoinWalletContext = createContext<BitcoinWalletContextValue | null>(null);

export function BitcoinWalletProvider({ children }: { children: ReactNode }) {
    const [wallet, setWallet] = useState<BitcoinWallet | null>(null);
    const [connecting, setConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const connect = useCallback(async (provider: "leather" | "unisat" | "xverse") => {
        setConnecting(true);
        setError(null);
        try {
            if (provider === "leather") {
                const leather = (window as any).LeatherProvider;
                if (!leather) throw new Error("Leather wallet not installed. Please install from leather.io");
                const response = await leather.request("getAddresses", { network: "testnet" });
                const btcAddress = response.result.addresses.find((a: any) => a.type === "p2wpkh");
                if (btcAddress) {
                    setWallet({ address: btcAddress.address, publicKey: btcAddress.publicKey, provider: "leather" });
                }
            } else if (provider === "unisat") {
                const unisat = (window as any).unisat;
                if (!unisat) throw new Error("UniSat wallet not installed. Please install from unisat.io");
                const accounts = await unisat.requestAccounts();
                const pubKey = await unisat.getPublicKey();
                setWallet({ address: accounts[0], publicKey: pubKey, provider: "unisat" });
            } else {
                throw new Error("Xverse: Please install the browser extension from xverse.app");
            }
        } catch (e: any) {
            setError(e.message || "Connection failed");
        } finally {
            setConnecting(false);
        }
    }, []);

    const disconnect = useCallback(() => {
        setWallet(null);
        setError(null);
    }, []);

    const shortAddress = wallet
        ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`
        : null;

    return (
        <BitcoinWalletContext.Provider value={{ wallet, connecting, error, shortAddress, connect, disconnect }}>
            {children}
        </BitcoinWalletContext.Provider>
    );
}

export function useBitcoinWalletContext(): BitcoinWalletContextValue {
    const ctx = useContext(BitcoinWalletContext);
    if (!ctx) throw new Error("useBitcoinWalletContext must be used inside BitcoinWalletProvider");
    return ctx;
}
