import type { User } from "@prisma/client";
import { db } from "./db";
import { publicClient } from "./identity";
import { ADDR } from "./chain";
import { streakVaultAbi } from "./abis";
import { localDate } from "./streak";

const vault = () => (ADDR.streakVault || null) as `0x${string}` | null;

export async function readCohort(id: number) {
  const v = vault(); if (!v) return null;
  const [start, end, min, max, totalStaked, finishedStake, , settled] = await publicClient.readContract({ address: v, abi: streakVaultAbi, functionName: "cohorts", args: [BigInt(id)] });
  if (start === 0n || !end) return null;
  return { id, start: Number(start), end: Number(end), min: min.toString(), max: max.toString(), pot: totalStaked.toString(), finishedStake: finishedStake.toString(), settled };
}

export async function listCohortIds() {
  const v = vault(); if (!v) return [];
  const next = await publicClient.readContract({ address: v, abi: streakVaultAbi, functionName: "nextCohortId" });
  return Array.from({ length: Number(next) - 1 }, (_, i) => i + 1);
}

export async function memberCount(id: number) {
  const v = vault(); if (!v) return 0;
  const logs = await publicClient.getContractEvents({ address: v, abi: streakVaultAbi, eventName: "Staked", args: { id: BigInt(id) }, fromBlock: BigInt(process.env.VAULT_DEPLOY_BLOCK || 0), toBlock: "latest" });
  return new Set(logs.map((l) => l.args.user)).size;
}

export async function myState(id: number, user: User) {
  const v = vault(); if (!v) return null;
  const a = user.wallet as `0x${string}`, i = BigInt(id);
  const [stake, fin, wd, payout] = await Promise.all([
    publicClient.readContract({ address: v, abi: streakVaultAbi, functionName: "stakeOf", args: [i, a] }),
    publicClient.readContract({ address: v, abi: streakVaultAbi, functionName: "finished", args: [i, a] }),
    publicClient.readContract({ address: v, abi: streakVaultAbi, functionName: "withdrawn", args: [i, a] }),
    publicClient.readContract({ address: v, abi: streakVaultAbi, functionName: "payoutOf", args: [i, a] }),
  ]);
  return { stake: stake.toString(), finished: fin, withdrawn: wd, payout: payout.toString() };
}

/** The 7 local dates a user must have a passed lesson on, starting with the local date of the cohort start. */
export function requiredDates(startSec: number, timeZone: string) {
  return Array.from({ length: 7 }, (_, i) => localDate(new Date((startSec + i * 86400) * 1000), timeZone));
}

export async function progressFor(user: User, startSec: number) {
  const required = requiredDates(startSec, user.timezone);
  const days = await db.streakDay.findMany({ where: { userId: user.id, date: { in: required } }, select: { date: true } });
  const have = new Set(days.map((d) => d.date));
  const done = required.map((d) => have.has(d));
  return { required, done, completed: done.filter(Boolean).length };
}

export async function mirrorCohort(c: { id: number; start: number; end: number; min: string; max: string; settled: boolean }) {
  const status = c.settled ? "settled" : Date.now() / 1000 >= c.end ? "ended" : Date.now() / 1000 >= c.start ? "running" : "open";
  await db.cohort.upsert({
    where: { id: c.id },
    create: { id: c.id, startAt: new Date(c.start * 1000), endAt: new Date(c.end * 1000), minStake: c.min, maxStake: c.max, status },
    update: { status },
  });
}
