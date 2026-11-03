"use client";
import { usePrivy } from "@privy-io/react-auth";
import { LoginScreen } from "@/components/LoginScreen";
import { Home } from "@/components/Home";
import { Onboarding } from "@/components/Onboarding";
import { useMe } from "@/lib/useMe";

export default function Page() {
  const { ready, authenticated } = usePrivy();
  const { data: me } = useMe();
  if (!ready) return <main className="grid min-h-[100dvh] place-items-center"><div className="h-6 w-24 animate-pulse rounded bg-line" /></main>;
  if (!authenticated) return <LoginScreen />;
  if (me && !me.onboarded) return <Onboarding />;
  return <Home />;
}
