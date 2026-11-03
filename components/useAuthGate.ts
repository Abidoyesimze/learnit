"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";

export function useAuthGate() {
  const { ready, authenticated } = usePrivy();
  const router = useRouter();
  useEffect(() => { if (ready && !authenticated) router.replace("/"); }, [ready, authenticated, router]);
  return ready && authenticated;
}
