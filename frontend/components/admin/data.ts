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
