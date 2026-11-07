"use client";
import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { erc20Abi } from "viem";
import { rewardsPoolAbi, streakVaultAbi } from "@learnit/backend/abis";
import { ADDR } from "@learnit/backend/chain";

export const DAY = 86_400;
export type Cohort = { id: number; start: number; end: number; min: bigint; max: bigint; pot: bigint; finishedStake: bigint; settled: boolean };
export type CohortStatus = "upcoming" | "open" | "running" | "finalize" | "settled";

export function cohortStatus(c: Cohort, now: number): CohortStatus {
  if (c.settled) return "settled";
  if (now < c.start) return "upcoming";
  if (now < c.start + DAY) return "open";
  if (now < c.end) return "running";
  return "finalize";
}

export function useCohorts() {
  const pc = usePublicClient();
  const vault = ADDR.streakVault;
  return useQuery({
    queryKey: ["admin", "cohorts"], enabled: !!vault && !!pc, staleTime: 15_000,
    queryFn: async (): Promise<Cohort[]> => {
      const next = Number(await pc!.readContract({ address: vault, abi: streakVaultAbi, functionName: "nextCohortId" }));
      const ids = Array.from({ length: Math.max(0, next - 1) }, (_, i) => i + 1);
      if (!ids.length) return [];
      const res = await pc!.multicall({ allowFailure: false, contracts: ids.map((id) => ({ address: vault, abi: streakVaultAbi, functionName: "cohorts" as const, args: [BigInt(id)] as const })) });
      return res.map((r, i) => ({ id: ids[i], start: Number(r[0]), end: Number(r[1]), min: r[2], max: r[3], pot: r[4], finishedStake: r[5], settled: r[7] })).reverse();
    },
  });
}

export function useVaultPaused() {
  const pc = usePublicClient();
  const vault = ADDR.streakVault;
  return useQuery({ queryKey: ["admin", "vault-paused"], enabled: !!vault && !!pc, staleTime: 10_000,
    queryFn: () => pc!.readContract({ address: vault, abi: streakVaultAbi, functionName: "paused" }) });
}

export function usePool() {
  const pc = usePublicClient();
  const pool = ADDR.rewardsPool;
  return useQuery({
    queryKey: ["admin", "pool"], enabled: !!pool && !!pc, staleTime: 15_000,
    queryFn: async () => {
      const day = BigInt(Math.floor(Date.now() / 1000 / DAY));
      const [balance, dailyCap, weeklyCap, dailyBudget, spentToday, paused, signer] = await Promise.all([
        pc!.readContract({ address: ADDR.gd, abi: erc20Abi, functionName: "balanceOf", args: [pool] }),
        pc!.readContract({ address: pool, abi: rewardsPoolAbi, functionName: "dailyCap" }),
        pc!.readContract({ address: pool, abi: rewardsPoolAbi, functionName: "weeklyCap" }),
        pc!.readContract({ address: pool, abi: rewardsPoolAbi, functionName: "dailyBudget" }),
        pc!.readContract({ address: pool, abi: rewardsPoolAbi, functionName: "spentOnDay", args: [day] }),
        pc!.readContract({ address: pool, abi: rewardsPoolAbi, functionName: "paused" }),
        pc!.readContract({ address: pool, abi: rewardsPoolAbi, functionName: "signer" }),
      ]);
      return { balance, dailyCap, weeklyCap, dailyBudget, spentToday, paused, signer };
    },
  });
}

/** G$ paid out per UTC day for the last `n` days, oldest first. One multicall. */
export function usePoolHistory(n = 14) {
  const pc = usePublicClient();
  const pool = ADDR.rewardsPool;
  return useQuery({
    queryKey: ["admin", "pool-history", n], enabled: !!pool && !!pc, staleTime: 60_000,
    queryFn: async () => {
      const today = Math.floor(Date.now() / 1000 / DAY);
      const days = Array.from({ length: n }, (_, i) => today - (n - 1 - i));
      const res = await pc!.multicall({ allowFailure: false, contracts: days.map((day) => ({ address: pool, abi: rewardsPoolAbi, functionName: "spentOnDay" as const, args: [BigInt(day)] as const })) });
      return days.map((day, i) => ({ day: new Date(day * DAY * 1000).toISOString().slice(0, 10), spent: res[i] as bigint }));
    },
  });
}

export type UbiDay = { day: string; claims: number; claimers: number; total: string };
export type ActivityDay = { day: string; signups: number; active: number; passed: number };
export type PublicStats = {
  generatedAt: string;
  users: { total: number; newLast7d: number; active1d: number; active7d: number; active30d: number; verified: number | null };
  learning: { attempts: number; passed: number; learnersWithPass: number };
  activity?: ActivityDay[]; // newest first; absent until the backend is redeployed
  ubi: { allTime: Omit<UbiDay, "day">; today: Omit<UbiDay, "day">; days: UbiDay[] };
};

/** Aggregate numbers anyone may read (no sign-in). Served from a five-minute cache. */
export function usePublicStats() {
  return useQuery({
    queryKey: ["admin", "public-stats"], staleTime: 60_000, refetchInterval: 5 * 60_000,
    queryFn: async () => {
      const res = await fetch("/api/public/stats");
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
      return (await res.json()) as PublicStats;
    },
  });
}
