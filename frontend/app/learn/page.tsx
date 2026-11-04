"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useQuery } from "@tanstack/react-query";
import { FireIcon, SnowIcon } from "hugeicons-react";
import { useApi } from "@/lib/useApi";
import { TabBar } from "@/components/TabBar";
import { LearnSkeleton } from "@/components/Skeletons";
import { LanguageChip } from "@/components/LanguageChip";
import { LearnPath, type PathUnit } from "@/components/LearnPath";

type Today = { course: "fr" | "es"; level: string; units: PathUnit[]; currentUnit: number; nextLessonId: string | null; streak: number; todayDone: boolean; freezesRemaining: number };

export default function Learn() {
  const { ready, authenticated } = usePrivy();
  const router = useRouter();
  const api = useApi();
  useEffect(() => { if (ready && !authenticated) router.replace("/"); }, [ready, authenticated, router]);
  const { data } = useQuery({ queryKey: ["today"], queryFn: () => api<Today>("/api/lessons/today"), enabled: ready && authenticated });
  if (!data) return <LearnSkeleton />;
  return (
    <main className="mx-auto max-w-md px-4 pb-28 pt-6">
      <header className="mb-6 flex items-center justify-between">
        <LanguageChip />
        <span className="flex items-center gap-3 font-mono text-sm">
          {!!data.freezesRemaining && <span className="flex items-center gap-1" title="Streak freezes"><SnowIcon size={16} strokeWidth={1.75} /> {data.freezesRemaining}</span>}
          <span className="flex items-center gap-1"><FireIcon size={18} strokeWidth={1.75} /> {data.streak}</span>
        </span>
      </header>
      <LearnPath units={data.units} currentUnit={data.currentUnit} nextLessonId={data.nextLessonId} />
      <TabBar />
    </main>
  );
}
