"use client";
import { useAccount, useConnect, useDisconnect } from "@starknet-react/core";
import { useBitcoinWalletContext } from "../context/BitcoinWalletContext";

export type { BitcoinWallet } from "../context/BitcoinWalletContext";

// Delegates to the shared context — all components get the same wallet state
export function useBitcoinWallet() {
  return useBitcoinWalletContext();
}

export function useStarknetWallet() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : null;

  return { address, shortAddress, isConnected, connect, connectors, disconnect };
}


