"use client";
import { usePrivy } from "@privy-io/react-auth";
import { LoginScreen } from "@/components/LoginScreen";
import { Home } from "@/components/Home";
import { Onboarding } from "@/components/Onboarding";
import { BootSkeleton } from "@/components/Skeletons";
import { useMe } from "@/lib/useMe";

export default function Page() {
  const { ready, authenticated } = usePrivy();
  const { data: me } = useMe();
  if (!ready) return <BootSkeleton />;
  if (!authenticated) return <LoginScreen />;
  if (me && !me.onboarded) return <Onboarding />;
  return <Home />;
}
