"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, useConnect, useDisconnect, usePublicClient, useSignMessage } from "wagmi";
import { keccak256, toBytes, zeroHash } from "viem";
import { streakVaultAbi } from "@learnit/backend/abis";
import { ADDR } from "@learnit/backend/chain";

const GUARDIAN = keccak256(toBytes("GUARDIAN_ROLE"));
const SESSION_MS = 25 * 60_000; // the server accepts a signature for 30 minutes
const KEY = "learnit-admin-session";

export type UbiDay = { day: string; claims: number; claimers: number; total: string };
export type UbiStats = { allTime: Omit<UbiDay, "day">; today: Omit<UbiDay, "day">; days: UbiDay[] };
type Session = { addr: string; ts: number; sig: `0x${string}` };

type Ctx = {
  address?: `0x${string}`;
  connect: () => void;
  connecting: boolean;
  disconnect: () => void;
  hasInjected: boolean;
  roles: { admin: boolean; guardian: boolean } | undefined;
  rolesLoading: boolean;
  /** Signed in for the stats API (a free message signature, no transaction). */
  unlocked: boolean;
  unlock: () => Promise<void>;
  unlocking: boolean;
  unlockError: string | null;
  ubi: { data?: UbiStats; error: Error | null; isLoading: boolean; refetch: () => void };
};

const AdminCtx = createContext<Ctx | null>(null);
export const useAdmin = () => {
  const c = useContext(AdminCtx);
  if (!c) throw new Error("useAdmin outside AdminProvider");
  return c;
};

const readSession = (addr?: string): Session | null => {
  try {
    const s = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as Session | null;
    return s && addr && s.addr.toLowerCase() === addr.toLowerCase() && Date.now() - s.ts < SESSION_MS ? s : null;
  } catch { return null; }
};

export function AdminProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const pc = usePublicClient();
  const { address } = useAccount();
  const { connect, connectors, isPending: connecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const vault = ADDR.streakVault;

  const [session, setSession] = useState<Session | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  useEffect(() => { setSession(readSession(address)); setUnlockError(null); }, [address]);

  const unlock = useCallback(async () => {
    if (!address) return;
    setUnlocking(true); setUnlockError(null);
    try {
      const ts = Date.now();
      const sig = await signMessageAsync({ message: `LearnIt admin ${ts}` });
      const s = { addr: address, ts, sig };
      try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private window: keep it in memory only */ }
      setSession(s);
      void qc.invalidateQueries({ queryKey: ["admin", "ubi"] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setUnlockError(/reject|denied|cancel/i.test(msg) ? "You declined the signature." : "Could not sign. Try again.");
    } finally { setUnlocking(false); }
  }, [address, signMessageAsync, qc]);

  const roles = useQuery({
    queryKey: ["admin", "roles", address], enabled: !!vault && !!pc && !!address, staleTime: 30_000,
    queryFn: async () => {
      const [admin, guardian] = await Promise.all([
        pc!.readContract({ address: vault, abi: streakVaultAbi, functionName: "hasRole", args: [zeroHash, address!] }),
        pc!.readContract({ address: vault, abi: streakVaultAbi, functionName: "hasRole", args: [GUARDIAN, address!] }),
      ]);
      return { admin, guardian };
    },
  });

  const ubiQ = useQuery({
    queryKey: ["admin", "ubi", address, session?.ts], enabled: !!session && !!address, staleTime: 60_000, retry: false,
    queryFn: async () => {
      const res = await fetch("/api/admin/ubi", { headers: { "x-admin-address": session!.addr, "x-admin-ts": String(session!.ts), "x-admin-sig": session!.sig } });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
      return (await res.json()) as UbiStats;
    },
  });

  // A 401 means the signature aged out; drop the session so the page asks for a new one.
  useEffect(() => { if (ubiQ.error && /sign in|signature/i.test(ubiQ.error.message)) setSession(null); }, [ubiQ.error]);

  const value = useMemo<Ctx>(() => ({
    address,
    connect: () => { const c = connectors[0]; if (c) connect({ connector: c }); },
    connecting, disconnect: () => { disconnect(); setSession(null); },
    hasInjected: connectors.length > 0,
    roles: roles.data, rolesLoading: roles.isLoading,
    unlocked: !!session, unlock, unlocking, unlockError,
    ubi: { data: ubiQ.data, error: ubiQ.error as Error | null, isLoading: ubiQ.isLoading, refetch: () => { void ubiQ.refetch(); } },
  }), [address, connectors, connect, connecting, disconnect, roles.data, roles.isLoading, session, unlock, unlocking, unlockError, ubiQ.data, ubiQ.error, ubiQ.isLoading, ubiQ]);

  return <AdminCtx.Provider value={value}>{children}</AdminCtx.Provider>;
}
