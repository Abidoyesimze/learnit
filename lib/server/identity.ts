import { createPublicClient, http } from "viem";
import { CHAIN, ADDR, RPC_URL, identityAbi } from "@/lib/chain";

export const publicClient = createPublicClient({ chain: CHAIN, transport: http(RPC_URL) });

const ZERO = "0x0000000000000000000000000000000000000000";

export type Verification = { verified: boolean; root: `0x${string}` | null; verifiedUntil: Date | null };

/** Reads GoodDollar Identity on Celo: whitelisted root and the expiry (lastAuthenticated + authenticationPeriod). */
export async function readVerification(address: `0x${string}`): Promise<Verification> {
  const [whitelisted, root, last, period] = await Promise.all([
    publicClient.readContract({ address: ADDR.identity, abi: identityAbi, functionName: "isWhitelisted", args: [address] }),
    publicClient.readContract({ address: ADDR.identity, abi: identityAbi, functionName: "getWhitelistedRoot", args: [address] }),
    publicClient.readContract({ address: ADDR.identity, abi: identityAbi, functionName: "lastAuthenticated", args: [address] }),
    publicClient.readContract({ address: ADDR.identity, abi: identityAbi, functionName: "authenticationPeriod" }),
  ]);
  const hasRoot = root !== ZERO;
  // authenticationPeriod is in days (same as the GoodDollar SDK).
  const verifiedUntil = last > 0n ? new Date((Number(last) + Number(period) * 86400) * 1000) : null;
  return { verified: Boolean(whitelisted) && hasRoot, root: hasRoot ? root : null, verifiedUntil };
}
