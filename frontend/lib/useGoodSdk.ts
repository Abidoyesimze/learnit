"use client";
import { useEffect, useState } from "react";
import { usePublicClient, useWalletClient } from "wagmi";
import type { IdentitySDK, ClaimSDK } from "@goodsdks/citizen-sdk";
import { GOODDOLLAR_SDK_ENV } from "@learnit/backend/chain";

/** Initialises GoodDollar identity + claim SDKs once the wallet is connected. Targets Celo mainnet
 *  by default; set NEXT_PUBLIC_NETWORK=testnet (plus the testnet contract addresses) to point this
 *  at GoodDollar's dev environment on Celo Alfajores instead. */
export function useGoodSdk() {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const [sdk, setSdk] = useState<{ identity: IdentitySDK; claim: ClaimSDK } | null>(null);

  useEffect(() => {
    if (!publicClient || !walletClient) return;
    let dead = false;
    (async () => {
      const { IdentitySDK, ClaimSDK } = await import("@goodsdks/citizen-sdk"); // separate chunk, not in the initial bundle
      const rdu = `${window.location.origin}/`;
      const identity = await IdentitySDK.init({ publicClient, walletClient, env: GOODDOLLAR_SDK_ENV } as never);
      const claim = await ClaimSDK.init({ publicClient, walletClient, identitySDK: identity, rdu, env: GOODDOLLAR_SDK_ENV } as never);
      if (!dead) setSdk({ identity, claim });
    })().catch((e) => console.error("GoodDollar SDK init failed", e));
    return () => { dead = true; };
  }, [publicClient, walletClient]);

  return sdk;
}
