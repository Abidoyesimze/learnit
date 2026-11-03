"use client";
import { usePrivy } from "@privy-io/react-auth";
import { LoginScreen } from "@/components/LoginScreen";
import { Home } from "@/components/Home";

export default function Page() {
  const { ready, authenticated } = usePrivy();
  if (!ready) return <main className="grid min-h-[100dvh] place-items-center"><div className="h-6 w-24 animate-pulse rounded bg-line" /></main>;
  return authenticated ? <Home /> : <LoginScreen />;
}
