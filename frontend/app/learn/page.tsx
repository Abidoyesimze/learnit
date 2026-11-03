"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useQuery } from "@tanstack/react-query";
import { Tick02Icon, LockIcon, FireIcon, SnowIcon } from "hugeicons-react";
import { useApi } from "@/lib/useApi";
import { TabBar } from "@/components/TabBar";
import { LanguageChip } from "@/components/LanguageChip";

type Today = { course: "fr" | "es"; unitTitle: string; lessons: { id: string; title: string; theme: string; passed: boolean; isNext: boolean }[]; nextLessonId: string | null; checkpoint: { id: string; unlocked: boolean; passed: boolean; cooldownUntil: string | null }; streak: number; todayDone: boolean; freezesRemaining: number };

export default function Learn() {
  const { ready, authenticated } = usePrivy();
  const router = useRouter();
  const api = useApi();
  useEffect(() => { if (ready && !authenticated) router.replace("/"); }, [ready, authenticated, router]);
  const { data } = useQuery({ queryKey: ["today"], queryFn: () => api<Today>("/api/lessons/today"), enabled: ready && authenticated });
  return (
    <main className="mx-auto max-w-md px-4 pb-24 pt-6">
      <header className="mb-6 flex items-center justify-between">
        <LanguageChip />
        <span className="flex items-center gap-3 font-mono text-sm">
          {!!data?.freezesRemaining && <span className="flex items-center gap-1" title="Streak freezes"><SnowIcon size={16} strokeWidth={1.75} /> {data.freezesRemaining}</span>}
          <span className="flex items-center gap-1"><FireIcon size={18} strokeWidth={1.75} /> {data?.streak ?? 0}</span>
        </span>
      </header>
      <h1 className="text-3xl font-bold tracking-tighter">{data?.unitTitle ?? " "}</h1>
      <ul className="mt-4 grid gap-3">
        {!data && [0, 1, 2].map((i) => <li key={i} className="h-16 animate-pulse rounded-card bg-line" />)}
        {data?.lessons.map((l, i) => (
          <li key={l.id}>
            <Link href={`/learn/${l.id}`} className={`flex items-center justify-between rounded-card border p-4 ${l.isNext ? "border-ink bg-yellow text-[#111]" : "border-line"}`}>
              <span><span className="block font-semibold">{i + 1}. {l.title}</span><span className={`text-sm ${l.isNext ? "" : "text-muted"}`}>{l.passed ? "Passed" : l.isNext ? "Up next" : "Open"}</span></span>
              {l.passed && <Tick02Icon size={22} strokeWidth={1.75} />}
            </Link>
          </li>
        ))}
        {data && (
          <li>
            {data.checkpoint.unlocked && !data.checkpoint.cooldownUntil ? (
              <Link href={`/learn/${data.checkpoint.id}`} className="flex items-center justify-between rounded-card border border-ink p-4"><span className="font-semibold">Unit checkpoint</span><span className="text-sm">{data.checkpoint.passed ? "Passed" : "20 questions"}</span></Link>
            ) : (
              <div className="flex items-center justify-between rounded-card border border-line p-4 text-muted"><span className="font-semibold">Unit checkpoint</span><span className="flex items-center gap-1 text-sm"><LockIcon size={16}  strokeWidth={1.75} /> {data.checkpoint.cooldownUntil ? "Try again later" : "Pass all lessons"}</span></div>
            )}
          </li>
        )}
      </ul>
      <TabBar />
    </main>
  );
}
