// After a cohort ends: work out who finished all 7 days, mark them on-chain, then settle.
//   npx tsx --env-file=.env scripts/finalize-cohort.mts <cohortId>          (dry run, prints the plan)
//   npx tsx --env-file=.env scripts/finalize-cohort.mts <cohortId> --send   (sends markFinished + settle)
// SIGNER_PRIVATE_KEY must hold the vault's SIGNER_ROLE.
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { db } from "../src/db";
import { publicClient } from "../src/identity";
import { readCohort, progressFor } from "../src/cohorts";
import { ADDR, CHAIN, RPC_URL } from "../src/chain";
import { streakVaultAbi } from "../src/abis";

const id = Number(process.argv[2]);
const send = process.argv.includes("--send");
if (!id) throw new Error("usage: finalize-cohort.ts <cohortId> [--send]");

const c = await readCohort(id);
if (!c) throw new Error("cohort not found (is NEXT_PUBLIC_STREAK_VAULT_ADDRESS set?)");
if (Date.now() / 1000 < c.end) throw new Error("cohort has not ended yet");
if (c.settled) throw new Error("already settled");

const logs = await publicClient.getContractEvents({ address: ADDR.streakVault, abi: streakVaultAbi, eventName: "Staked", args: { id: BigInt(id) }, fromBlock: BigInt(process.env.VAULT_DEPLOY_BLOCK || 0), toBlock: "latest" });
const members = Array.from(new Set(logs.map((l) => l.args.user!)));
const finishers: `0x${string}`[] = [];
for (const m of members) {
  const user = await db.user.findUnique({ where: { wallet: m } });
  const p = user ? await progressFor(user, c.start) : null;
  const ok = p?.completed === 7;
  console.log(m, p ? `${p.completed}/7` : "unknown user", ok ? "FINISHED" : "forfeit");
  if (ok) finishers.push(m);
}
console.log(`\n${finishers.length} of ${members.length} finished.`);
if (!send) { console.log("Dry run. Add --send to submit."); process.exit(0); }

const wallet = createWalletClient({ account: privateKeyToAccount(process.env.SIGNER_PRIVATE_KEY as `0x${string}`), chain: CHAIN, transport: http(RPC_URL) });
if (finishers.length) {
  const h = await wallet.writeContract({ address: ADDR.streakVault, abi: [{ type: "function", name: "markFinished", stateMutability: "nonpayable", inputs: [{ name: "id", type: "uint256" }, { name: "users", type: "address[]" }], outputs: [] }] as const, functionName: "markFinished", args: [BigInt(id), finishers] });
  await publicClient.waitForTransactionReceipt({ hash: h });
  console.log("markFinished", h);
}
const h2 = await wallet.writeContract({ address: ADDR.streakVault, abi: [{ type: "function", name: "settle", stateMutability: "nonpayable", inputs: [{ name: "id", type: "uint256" }], outputs: [] }] as const, functionName: "settle", args: [BigInt(id)] });
await publicClient.waitForTransactionReceipt({ hash: h2 });
console.log("settle", h2);
await db.$disconnect();
