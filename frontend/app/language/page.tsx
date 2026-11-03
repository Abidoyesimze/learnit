"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft01Icon } from "hugeicons-react";
import { useApi } from "@/lib/useApi";
import { useMe } from "@/lib/useMe";
import { LanguageCards } from "@/components/LanguageCards";
import { useAuthGate } from "@/components/useAuthGate";
import { LanguageSkeleton } from "@/components/Skeletons";
import type { Course } from "@/lib/languages";

export default function ChangeLanguage() {
  const ok = useAuthGate();
  const router = useRouter();
  const api = useApi();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function pick(course: Course) {
    if (course === me?.course) return router.back();
    setBusy(true); setErr(null);
    try {
      await api("/api/me", { method: "PATCH", body: JSON.stringify({ course }) });
      await Promise.all([qc.invalidateQueries({ queryKey: ["me"] }), qc.invalidateQueries({ queryKey: ["today"] })]);
      router.push("/learn");
    } catch (e) { setErr(e instanceof Error ? e.message : "Could not switch language"); setBusy(false); }
  }

  if (!ok || !me) return <LanguageSkeleton />;
  return (
    <main className="mx-auto max-w-md px-4 pb-24 pt-6">
      <button onClick={() => router.back()} aria-label="Back" className="-ml-2 p-2"><ArrowLeft01Icon size={24} strokeWidth={1.75} /></button>
      <h1 className="mt-4 text-3xl font-bold tracking-tighter">Change language</h1>
      <p className="mt-2 text-sm text-muted">Your progress in each language is kept.</p>
      <div className="mt-6"><LanguageCards value={me?.course ?? null} onSelect={pick} disabled={busy || !me} /></div>
      {err && <p role="alert" className="mt-3 text-sm font-medium">{err}</p>}
    </main>
  );
}
