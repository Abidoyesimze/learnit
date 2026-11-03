"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useMe } from "@/lib/useMe";

export function useAuthGate() {
  const { ready, authenticated } = usePrivy();
  const router = useRouter();
  const { data: me } = useMe();
  useEffect(() => { if (ready && !authenticated) router.replace("/"); }, [ready, authenticated, router]);
  useEffect(() => { if (me && !me.onboarded) router.replace("/"); }, [me, router]);
  return ready && authenticated;
}
