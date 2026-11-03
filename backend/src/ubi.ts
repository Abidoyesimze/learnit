import { parseAbi, parseEventLogs, erc20Abi } from "viem";
import { publicClient } from "./identity";
import { ADDR } from "./chain";

const ubiAbi = parseAbi([
  "function checkEntitlement(address _member) view returns (uint256)",
  "function periodStart() view returns (uint256)",
  "function currentDay() view returns (uint256)",
]);

export type UbiStatus = { claimable: string; canClaim: boolean; nextClaimAt: number | null };

/** Entitlement is 0 once claimed today. Next claim = start of the next UBI day (same rule as the SDK's nextClaimTime). */
export async function readUbiStatus(address: `0x${string}`): Promise<UbiStatus> {
  const [entitlement, periodStart, day] = await Promise.all([
    publicClient.readContract({ address: ADDR.ubiScheme, abi: ubiAbi, functionName: "checkEntitlement", args: [address] }),
    publicClient.readContract({ address: ADDR.ubiScheme, abi: ubiAbi, functionName: "periodStart" }),
    publicClient.readContract({ address: ADDR.ubiScheme, abi: ubiAbi, functionName: "currentDay" }),
  ]);
  const now = Math.floor(Date.now() / 1000);
  let next = Number(periodStart) + Number(day) * 86400;
  if (next <= now) next += 86400;
  return { claimable: entitlement.toString(), canClaim: entitlement > 0n, nextClaimAt: entitlement > 0n ? null : next };
}

/** Confirms a claim tx succeeded for this wallet and returns the G$ received (sum of Transfer logs to the wallet). */
export async function verifyClaimTx(txHash: `0x${string}`, wallet: `0x${string}`) {
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") throw new Error("Transaction failed");
  if (receipt.from.toLowerCase() !== wallet.toLowerCase()) throw new Error("Transaction is not from this wallet");
  const logs = parseEventLogs({ abi: erc20Abi, eventName: "Transfer", logs: receipt.logs.filter((l) => l.address.toLowerCase() === ADDR.gd.toLowerCase()) });
  const received = logs.filter((l) => l.args.to.toLowerCase() === wallet.toLowerCase()).reduce((s, l) => s + l.args.value, 0n);
  return { amount: received.toString(), blockTime: Number((await publicClient.getBlock({ blockNumber: receipt.blockNumber })).timestamp) };
}
