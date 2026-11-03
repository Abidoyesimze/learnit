"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight01Icon, Coins01Icon, BookOpen01Icon, Loading03Icon, LockIcon } from "hugeicons-react";
import { useApi } from "@/lib/useApi";
import { LanguageCards } from "./LanguageCards";
import type { Course } from "@/lib/languages";

const HOW: { Icon: typeof Coins01Icon; title: string; body: string }[] = [
  { Icon: Coins01Icon, title: "Claim your daily G$", body: "Verified GoodDollar users claim their UBI here, then start a lesson." },
  { Icon: BookOpen01Icon, title: "Learn a little each day", body: "Short lessons. Pass at 80% to keep your streak and earn G$." },
  { Icon: LockIcon, title: "Stake on your streak", body: "Optional. Put G$ behind a 7-day challenge and get it back when you finish." },
];

export function Onboarding() {
  const api = useApi();
  const qc = useQueryClient();
  const [step, setStep] = useState<0 | 1>(0);
  const [course, setCourse] = useState<Course | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function finish() {
    if (!course) return;
    setBusy(true); setErr(null);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      await api("/api/me", { method: "PATCH", body: JSON.stringify({ course, timezone, onboarded: true }) });
      await qc.invalidateQueries({ queryKey: ["me"] });
      await qc.invalidateQueries({ queryKey: ["today"] });
    } catch (e) { setErr(e instanceof Error ? e.message : "Something went wrong"); setBusy(false); }
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-4 pb-8 pt-10">
      <div className="flex items-center gap-2" aria-label={`Step ${step + 1} of 2`}>
        {[0, 1].map((i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-yellow" : "bg-line"}`} />)}
      </div>

      {step === 0 && (
        <>
          <div className="mt-10 flex-1">
            <h1 className="text-4xl font-bold leading-[1.05] tracking-tighter">What do you want to learn?</h1>
            <p className="mt-3 max-w-[34ch] text-muted">Pick one to start. You can switch any time.</p>
            <div className="mt-8"><LanguageCards value={course} onSelect={setCourse} /></div>
          </div>
          <button onClick={() => setStep(1)} disabled={!course} className="mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-ink px-5 py-4 font-semibold text-paper transition active:scale-[0.98] disabled:opacity-30">
            Continue <ArrowRight01Icon size={20} strokeWidth={1.75} />
          </button>
        </>
      )}

      {step === 1 && (
        <>
          <div className="mt-10 flex-1">
            <h1 className="text-4xl font-bold leading-[1.05] tracking-tighter">How LearnIt works</h1>
            <ul className="mt-8 grid gap-5">
              {HOW.map(({ Icon, title, body }) => (
                <li key={title} className="flex gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-yellow text-[#111]"><Icon size={22} strokeWidth={1.75} /></span>
                  <span><span className="block font-semibold">{title}</span><span className="text-sm text-muted">{body}</span></span>
                </li>
              ))}
            </ul>
            <p className="mt-8 text-sm text-muted">Lessons are free for everyone. Claiming, earning and staking need a quick GoodDollar face check.</p>
          </div>
          {err && <p role="alert" className="mb-2 text-sm font-medium">{err}</p>}
          <div className="mt-6 grid gap-3">
            <button onClick={finish} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-full bg-yellow px-5 py-4 font-semibold text-[#111] transition active:scale-[0.98] disabled:opacity-60">
              {busy && <Loading03Icon className="animate-spin" size={18} strokeWidth={1.75} />} Start learning
            </button>
            <button onClick={() => setStep(0)} disabled={busy} className="py-2 text-sm text-muted underline-offset-4 hover:underline">Back</button>
          </div>
        </>
      )}
    </main>
  );
}
