"use client";
import { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StarknetConfig, argent, braavos } from "@starknet-react/core";
import { sepolia } from "@starknet-react/chains";
import { RpcProvider } from "starknet";
import { BitcoinWalletProvider } from "./context/BitcoinWalletContext";

const queryClient = new QueryClient();
const connectors = [argent(), braavos()];

function provider() {
  return new RpcProvider({
    nodeUrl: process.env.NEXT_PUBLIC_STARKNET_RPC ||
      "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/kwgGr9GGk4YyLXuGfEvpITv1jpvn3PgP",
  });
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <StarknetConfig
        chains={[sepolia]}
        provider={provider}
        connectors={connectors}
      >
        <BitcoinWalletProvider>
          {children}
        </BitcoinWalletProvider>
      </StarknetConfig>
    </QueryClientProvider>
  );
}
