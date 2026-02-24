"use client";
import { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StarknetConfig, argent, braavos } from "@starknet-react/core";
import { sepolia } from "@starknet-react/chains";
import { RpcProvider } from "starknet";

const queryClient = new QueryClient();
const connectors = [argent(), braavos()];

function provider() {
  return new RpcProvider({
    nodeUrl: "https://free-rpc.nethermind.io/sepolia-juno/v0_7",
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
        {children}
      </StarknetConfig>
    </QueryClientProvider>
  );
}
