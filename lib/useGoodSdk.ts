"use client";
import { useEffect, useState } from "react";
import { usePublicClient, useWalletClient } from "wagmi";
import { IdentitySDK, ClaimSDK } from "@goodsdks/citizen-sdk";

/** Initialises GoodDollar identity + claim SDKs once the wallet is connected (production-celo). */
export function useGoodSdk() {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const [sdk, setSdk] = useState<{ identity: IdentitySDK; claim: ClaimSDK } | null>(null);

  useEffect(() => {
    if (!publicClient || !walletClient) return;
    let dead = false;
    (async () => {
      const rdu = `${window.location.origin}/`;
      const identity = await IdentitySDK.init({ publicClient, walletClient, env: "production" } as never);
      const claim = await ClaimSDK.init({ publicClient, walletClient, identitySDK: identity, rdu, env: "production" } as never);
      if (!dead) setSdk({ identity, claim });
    })().catch((e) => console.error("GoodDollar SDK init failed", e));
    return () => { dead = true; };
  }, [publicClient, walletClient]);

  return sdk;
}
