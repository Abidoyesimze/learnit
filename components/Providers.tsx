"use client";
import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider, createConfig } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http } from "viem";
import { celo } from "viem/chains";
import { useEffect, useState } from "react";
import { RPC_URL } from "@/lib/chain";

const wagmiConfig = createConfig({ chains: [celo], transports: { [celo.id]: http(RPC_URL) } });

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient());
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!appId) return <p className="p-6 text-sm">Set NEXT_PUBLIC_PRIVY_APP_ID in .env to start.</p>;
  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["google", "wallet"],
        appearance: { theme: "light", accentColor: "#FFD60A", walletList: ["detected_wallets", "wallet_connect"] },
        embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" } },
        defaultChain: celo,
        supportedChains: [celo],
        externalWallets: {},
      }}
    >
      <QueryClientProvider client={qc}>
        <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
