"use client";
import { useQuery } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import { useApi } from "./useApi";

export type Me = { id: string; username: string | null; displayName: string | null; bio: string | null; avatarUrl: string | null; wallet: `0x${string}`; verified: boolean; root: string | null; verifiedUntil: string | null; timezone: string; course: "fr" | "es"; gasTopupDone: boolean; onboarded: boolean };

export function useMe() {
  const api = useApi();
  const { authenticated, ready } = usePrivy();
  return useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/api/me"), enabled: ready && authenticated, staleTime: 30_000 });
}
