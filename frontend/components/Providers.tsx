"use client";
import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider, createConfig } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http } from "viem";
import { useEffect, useState } from "react";
import { CHAIN, RPC_URL } from "@learnit/backend/chain";

// CHAIN is one of two chains picked at runtime by env var, so its static type is a union; wagmi's
// transports map type demands both branches' ids unless we tell it which one actually applies here.
const wagmiConfig = createConfig({ chains: [CHAIN], transports: { [CHAIN.id]: http(RPC_URL) } as never });

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
        loginMethods: ["email", "wallet"],
        appearance: { theme: "light", accentColor: "#FFD60A", walletList: ["detected_wallets", "wallet_connect"] },
        embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" } },
        defaultChain: CHAIN,
        supportedChains: [CHAIN],
        externalWallets: {},
      }}
    >
      <QueryClientProvider client={qc}>
        <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
