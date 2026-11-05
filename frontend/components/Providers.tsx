"use client";
import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider, createConfig } from "@privy-io/wagmi";
import { WagmiProvider as PlainWagmiProvider, createConfig as createPlainConfig, injected } from "wagmi";
import { usePathname } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http } from "viem";
import { useEffect, useState } from "react";
import { CHAIN, RPC_URL } from "@learnit/backend/chain";
import { startInstallListener } from "@/lib/install";

// CHAIN is one of two chains picked at runtime by env var, so its static type is a union; wagmi's
// transports map type demands both branches' ids unless we tell it which one actually applies here.
const wagmiConfig = createConfig({ chains: [CHAIN], transports: { [CHAIN.id]: http(RPC_URL) } as never });

// /admin uses a plain browser wallet (no Privy, no login, no onboarding), so it gets its own wagmi config.
const adminConfig = createPlainConfig({ chains: [CHAIN], connectors: [injected()], transports: { [CHAIN.id]: http(RPC_URL) } as never });

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, gcTime: 10 * 60_000, refetchOnWindowFocus: false, retry: 1 } } }));
  useEffect(() => {
    startInstallListener(); // catch the browser's install offer before any screen asks for it
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  const path = usePathname();
  if (path === "/admin" || path.startsWith("/admin/")) {
    return (
      <QueryClientProvider client={qc}>
        <PlainWagmiProvider config={adminConfig}>{children}</PlainWagmiProvider>
      </QueryClientProvider>
    );
  }
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!appId) return <p className="p-6 text-sm text-ink-2">Set NEXT_PUBLIC_PRIVY_APP_ID in .env to start.</p>;
  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["email", "wallet"],
        appearance: { theme: "light", accentColor: "#0F172A", landingHeader: "Welcome to LearnIt", walletList: ["detected_wallets", "wallet_connect"] },
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
