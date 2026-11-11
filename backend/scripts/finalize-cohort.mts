// After a cohort ends: work out who finished every day, mark them on-chain, confirm the results, then settle.
//   npx tsx --env-file=.env scripts/finalize-cohort.mts <cohortId>          (dry run, prints the plan)
//   npx tsx --env-file=.env scripts/finalize-cohort.mts <cohortId> --send   (sends the transactions)
// SIGNER_PRIVATE_KEY must hold the vault's SIGNER_ROLE.
//
// Nobody can settle a cohort until finalizeResults has confirmed its results, and the contract refunds every
// staker if that has not happened 7 days after the end. So this script stops rather than guess: it sends
// nothing unless it has seen every stake, and it is safe to run again after a failure (it picks up where it
// stopped).
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

const vault = ADDR.streakVault;
const cid = BigInt(id);

const c = await readCohort(id);
if (!c) throw new Error("cohort not found (is NEXT_PUBLIC_STREAK_VAULT_ADDRESS set?)");
if (Date.now() / 1000 < c.end) throw new Error("cohort has not ended yet");
if (c.settled) throw new Error("already settled");
if (c.voided) throw new Error("cohort was voided: results were not confirmed in time, so every staker withdraws their own stake");
// A vault from before the settlement-review upgrade (the legacy StreakVault, or a proxy not upgraded yet) has no
// finalizeResults: there the flow is markFinished then settle, and ANYONE can settle one day after the end with
// whatever is marked by then. Finalise those within that day.
const oldVault = await publicClient.readContract({ address: vault, abi: streakVaultAbi, functionName: "resultsFinal", args: [cid] }).then(() => false, () => true);
const resultsFinal = oldVault ? false : await publicClient.readContract({ address: vault, abi: streakVaultAbi, functionName: "resultsFinal", args: [cid] });
if (oldVault) console.log(`This vault has no finalizeResults (old version). Anyone can settle it from ${new Date((c.end + 86400) * 1000).toISOString()}, so finish this run before then.\n`);

// Everyone who staked. Read in chunks because public Celo RPCs reject eth_getLogs over wide block ranges.
// Unlike the member count on the Stake page, a failed chunk stops the run: a partial list here would forfeit real finishers.
const CHUNK = 5_000n;
const latest = await publicClient.getBlockNumber();
const members = new Set<`0x${string}`>();
for (let from = BigInt(process.env.VAULT_DEPLOY_BLOCK || 0); from <= latest; from += CHUNK) {
  const toBlock = from + CHUNK - 1n > latest ? latest : from + CHUNK - 1n;
  const logs = await publicClient.getContractEvents({ address: vault, abi: streakVaultAbi, eventName: "Staked", args: { id: cid }, fromBlock: from, toBlock });
  for (const l of logs) members.add(l.args.user!);
}

const days = Math.round((c.end - c.start) / 86400);
const finishers: `0x${string}`[] = [], toMark: `0x${string}`[] = [];
let seenStake = 0n, finishedStake = 0n;
for (const m of members) {
  const [stake, marked] = await Promise.all([
    publicClient.readContract({ address: vault, abi: streakVaultAbi, functionName: "stakeOf", args: [cid, m] }),
    publicClient.readContract({ address: vault, abi: streakVaultAbi, functionName: "finished", args: [cid, m] }),
  ]);
  seenStake += stake;
  const user = await db.user.findUnique({ where: { wallet: m } });
  const p = user ? await progressFor(user, c.start, c.end) : null;
  const ok = !!p && p.required.length === days && p.completed === days;
  console.log(m, p ? `${p.completed}/${days}` : "unknown user", ok ? "FINISHED" : "forfeit", marked ? "(already marked)" : "");
  if (marked && !ok) throw new Error(`${m} is marked finished on-chain but did not finish according to the database. Stopping, nothing sent.`);
  if (ok) { finishers.push(m); finishedStake += stake; if (!marked) toMark.push(m); }
}
console.log(`\n${finishers.length} of ${members.size} finished (${toMark.length} still to mark).`);
// The stakes found must add up to the cohort's total. If not, the log scan missed someone.
if (seenStake !== BigInt(c.pot)) throw new Error(`found stakes worth ${seenStake} but the cohort holds ${c.pot}: the Staked log scan is incomplete (check VAULT_DEPLOY_BLOCK and the RPC). Nothing sent.`);
if (resultsFinal && toMark.length) throw new Error("results are already confirmed on-chain but the database shows more finishers. Nothing sent.");
if (!send) { console.log("Dry run. Add --send to submit."); await db.$disconnect(); process.exit(0); }

const wallet = createWalletClient({ account: privateKeyToAccount(process.env.SIGNER_PRIVATE_KEY as `0x${string}`), chain: CHAIN, transport: http(RPC_URL) });
async function tx(label: string, hash: `0x${string}`) {
  const r = await publicClient.waitForTransactionReceipt({ hash });
  if (r.status !== "success") throw new Error(`${label} reverted (${hash}). Run the script again to continue.`);
  console.log(label, hash);
}

const BATCH = 100;
for (let i = 0; i < toMark.length; i += BATCH) {
  await tx(`markFinished ${i + 1}-${Math.min(i + BATCH, toMark.length)}`, await wallet.writeContract({ address: vault, abi: streakVaultAbi, functionName: "markFinished", args: [cid, toMark.slice(i, i + BATCH)] }));
}
// Confirms the results. The contract rejects this unless the stake marked on-chain equals the total worked out above.
if (!resultsFinal && !oldVault) await tx("finalizeResults", await wallet.writeContract({ address: vault, abi: streakVaultAbi, functionName: "finalizeResults", args: [cid, finishedStake] }));
await tx("settle", await wallet.writeContract({ address: vault, abi: streakVaultAbi, functionName: "settle", args: [cid] }));
console.log("Finishers can withdraw now.");
if (oldVault) { await db.$disconnect(); process.exit(0); } // the old settle() already paid the pool and UBI shares

// Sends the RewardsPool and UBI shares on. Finishers do not depend on this step. If it fails, fix the destination
// (setRewardsPool / setUbiAddress from the admin Safe) and call distribute() again; anyone can.
try {
  await tx("distribute", await wallet.writeContract({ address: vault, abi: streakVaultAbi, functionName: "distribute" }));
} catch (e) {
  console.error("distribute failed. The pool and UBI shares are still held in the vault:", e instanceof Error ? e.message.split("\n")[0] : e);
}
await db.$disconnect();
