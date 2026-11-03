"use client";
import Link from "next/link";
import { useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useApi } from "@/lib/useApi";
import { useMe } from "@/lib/useMe";
import { short } from "@/lib/format";
import { VerifyCard } from "./VerifyCard";
import { ClaimCard } from "./ClaimCard";
import { TabBar } from "./TabBar";
import { GasCard } from "./GasCard";

export function Home() {
  const { logout } = usePrivy();
  const { data: me, isLoading, error } = useMe();
  const api = useApi();
  useEffect(() => {
    // Streak days follow the learner's own timezone.
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (me && tz && me.timezone !== tz) api("/api/me", { method: "PATCH", body: JSON.stringify({ timezone: tz }) }).catch(() => {});
  }, [me, api]);
  return (
    <main className="mx-auto max-w-md px-4 pb-24 pt-6">
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight">LearnIt</span>
          <span className="rounded-full border border-line px-2 py-0.5 text-[11px] font-medium">Beta</span>
        </div>
        <button onClick={logout} className="font-mono text-xs text-muted underline-offset-4 hover:underline">{me ? short(me.wallet) : "Sign out"}</button>
      </header>
      {isLoading && <div className="h-44 animate-pulse rounded-card bg-line" />}
      {error && <p role="alert" className="text-sm">Could not load your account. Pull to retry.</p>}
      {me && (me.verified ? <ClaimCard /> : <VerifyCard />)}
      {me && me.verified && !me.gasTopupDone && <GasCard />}
      {me && (
        <Link href="/learn" className="mt-4 flex items-center justify-between rounded-card border border-line p-5 transition active:scale-[0.99]">
          <div>
            <p className="font-semibold">Today&apos;s lesson</p>
            <p className="text-sm text-muted">{me.course === "fr" ? "French" : "Spanish"}, unit 1</p>
          </div>
          <span aria-hidden className="text-xl">&rarr;</span>
        </Link>
      )}
      <TabBar />
    </main>
  );
}
