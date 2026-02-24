"use client";
import { useAccount, useConnect, useDisconnect } from "@starknet-react/core";
import { useState } from "react";

export type BitcoinWallet = {
  address: string;
  publicKey: string;
  provider: "leather" | "unisat" | "xverse";
};

export function useStarknetWallet() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : null;

  return { address, shortAddress, isConnected, connect, connectors, disconnect };
}

export function useBitcoinWallet() {
  const [wallet, setWallet] = useState<BitcoinWallet | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = async (provider: "leather" | "unisat" | "xverse") => {
    setConnecting(true);
    setError(null);
    try {
      if (provider === "leather") {
        const leather = (window as any).LeatherProvider;
        if (!leather) throw new Error("Leather wallet not installed. Please install from leather.io");
        const response = await leather.request("getAddresses", { network: "mainnet" });
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
      } else if (provider === "xverse") {
        throw new Error("Xverse: Please install the browser extension from xverse.app");
      }
    } catch (e: any) {
      setError(e.message || "Connection failed");
      setTimeout(() => setError(null), 4000);
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = () => setWallet(null);

  const shortAddress = wallet?.address
    ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`
    : null;

  return { wallet, shortAddress, connecting, error, connect, disconnect };
}
