"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { VolumeHighIcon, Tick02Icon, Cancel01Icon } from "hugeicons-react";
import { useApi } from "@/lib/useApi";
import type { PublicExercise } from "@learnit/backend/lessons";
import { fmtGD } from "@learnit/backend/format";

type Loaded = { id: string; title: string; speechLang: string; token: string; exercises: PublicExercise[] };
type Pair = { target: string; english: string };
type Ans = number | string[] | Pair[];
type Feedback = { correct: boolean; answer: unknown };
type Result = { passed: boolean; accuracy: number; durationS: number; minSeconds: number; tooFast: boolean; missedWordIds: string[]; streak: number; firstCheckpointPass: boolean; attemptId: string; voucher: { amount: string } | null; reviewPending: boolean };

const isCheckpoint = (id: string) => id.endsWith("-cp");

function speak(text: string, lang: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text); u.lang = lang; u.rate = 0.9;
  window.speechSynthesis.speak(u);
}

export function LessonPlayer({ id, onDone }: { id: string; onDone?: (r: Result) => void }) {
  const api = useApi();
  const reduce = useReducedMotion();
  const [data, setData] = useState<Loaded | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [queue, setQueue] = useState<number[]>([]);
  const [pos, setPos] = useState(0);
  const [first, setFirst] = useState<Record<string, Ans>>({});
  const [cur, setCur] = useState<Ans | null>(null);
  const [fb, setFb] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const missed = useRef<number[]>([]);
  const base = isCheckpoint(id) ? `/api/checkpoints/${id}` : `/api/lessons/${id}`;

  useEffect(() => {
    api<Loaded>(base).then((d) => { setData(d); setQueue(d.exercises.map((_, i) => i)); }).catch((e) => setErr(e.message));
  }, [api, base]);

  const ex = data && queue[pos] !== undefined ? data.exercises[queue[pos]] : null;
  useEffect(() => { if (ex?.type === "mc" && ex.speak && data) speak(ex.speak, data.speechLang); }, [ex, data]);

  const check = useCallback(async () => {
    if (!data || !ex || cur === null) return;
    setBusy(true);
    try {
      const r = await api<Feedback>(`/api/lessons/${data.id}/check`, { method: "POST", body: JSON.stringify({ token: data.token, exerciseId: ex.id, answer: cur }) });
      setFirst((f) => (ex.id in f ? f : { ...f, [ex.id]: cur }));
      if (!r.correct && !missed.current.includes(queue[pos])) missed.current.push(queue[pos]);
      setFb(r);
    } catch (e) { setErr(e instanceof Error ? e.message : "Check failed"); } finally { setBusy(false); }
  }, [api, data, ex, cur, queue, pos]);

  const submit = useCallback(async (answers: Record<string, Ans>) => {
    if (!data) return;
    try {
      const r = await api<Result>(`${base}/submit`, { method: "POST", body: JSON.stringify({ token: data.token, answers }) });
      setResult(r); onDone?.(r);
    } catch (e) { setErr(e instanceof Error ? e.message : "Submit failed"); }
  }, [api, data, base, onDone]);

  const next = useCallback(() => {
    if (!data) return;
    setFb(null); setCur(null);
    if (pos + 1 < queue.length) return setPos(pos + 1);
    // End of round: retry the exercises that were missed until all are right.
    const again = missed.current;
    missed.current = [];
    if (again.length) { setQueue(again); setPos(0); return; }
    void submit(first);
  }, [data, pos, queue, first, submit]);

  if (err && !data) return <p role="alert" className="p-6 text-sm">{err} <Link className="underline" href="/learn">Back</Link></p>;
  if (!data) return <div className="mx-auto max-w-md p-6"><div className="h-6 w-full animate-pulse rounded bg-line" /></div>;
  if (result) return <Results r={result} id={id} />;
  if (!ex) return <p className="p-6 text-sm">Submitting...</p>;

  const total = data.exercises.length;
  const done = Math.min(total, Object.keys(first).length);
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-4 pb-6 pt-4">
      <header className="flex items-center gap-3">
        <Link href="/learn" aria-label="Quit lesson" className="p-2"><Cancel01Icon size={22} strokeWidth={1.75} /></Link>
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={done} aria-valuemax={total}>
          <div className="h-full rounded-full bg-yellow transition-[width] duration-300" style={{ width: `${(done / total) * 100}%` }} />
        </div>
      </header>
      <section className="flex flex-1 flex-col justify-center py-6">
        <h1 className="text-2xl font-bold leading-tight tracking-tight">{ex.type === "translate" ? "Translate this sentence" : ex.prompt}</h1>
        {ex.type === "mc" && ex.speak && (
          <button onClick={() => speak(ex.speak!, data.speechLang)} className="mt-3 inline-flex w-fit items-center gap-2 rounded-full border border-line px-4 py-2 text-sm"><VolumeHighIcon size={18} strokeWidth={1.75} /> Listen</button>
        )}
        {ex.type === "translate" && <p className="mt-2 text-lg text-muted">{ex.prompt}</p>}
        <div className="mt-6">
          {ex.type === "mc" && <Mc key={ex.id} ex={ex} onChange={setCur} locked={!!fb} />}
          {ex.type === "translate" && <Translate key={ex.id} ex={ex} onChange={setCur} locked={!!fb} />}
          {ex.type === "match" && <Match key={ex.id} ex={ex} onChange={setCur} locked={!!fb} />}
        </div>
      </section>
      {!fb && <button onClick={check} disabled={cur === null || busy} className="w-full rounded-full bg-ink px-5 py-4 font-semibold text-paper transition active:scale-[0.98] disabled:opacity-30">Check</button>}
      {fb && (
        <motion.div initial={reduce ? false : { y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 26 }}
          className={`-mx-4 -mb-6 rounded-t-card p-5 pb-8 ${fb.correct ? "bg-yellow text-[#111]" : "bg-ink text-paper"}`} role="status">
          <p className="flex items-center gap-2 text-lg font-bold">{fb.correct ? <Tick02Icon size={22} strokeWidth={1.75} /> : <Cancel01Icon size={22} strokeWidth={1.75} />}{fb.correct ? "Correct" : "Not quite"}</p>
          {!fb.correct && <p className="mt-1 text-sm">Answer: {fmtAnswer(ex, fb.answer)}</p>}
          <button onClick={next} className={`mt-4 w-full rounded-full px-5 py-4 font-semibold transition active:scale-[0.98] ${fb.correct ? "bg-[#111] text-[#fafafa]" : "bg-yellow text-[#111]"}`}>Continue</button>
        </motion.div>
      )}
    </main>
  );
}

function fmtAnswer(ex: PublicExercise, a: unknown): string {
  if (ex.type === "mc") return ex.options[a as number];
  if (ex.type === "translate") return (a as string[]).join(" ");
  return (a as Pair[]).map((p) => `${p.target} = ${p.english}`).join(", ");
}

function Mc({ ex, onChange, locked }: { ex: Extract<PublicExercise, { type: "mc" }>; onChange: (a: Ans) => void; locked: boolean }) {
  const [sel, setSel] = useState<number | null>(null);
  return (
    <div className="grid gap-3">
      {ex.options.map((o, i) => (
        <button key={i} disabled={locked} aria-pressed={sel === i} onClick={() => { setSel(i); onChange(i); }}
          className={`rounded-card border px-4 py-4 text-left text-lg font-medium transition active:scale-[0.99] ${sel === i ? "border-ink bg-yellow text-[#111]" : "border-line"}`}>{o}</button>
      ))}
    </div>
  );
}

function Translate({ ex, onChange, locked }: { ex: Extract<PublicExercise, { type: "translate" }>; onChange: (a: Ans) => void; locked: boolean }) {
  const [picked, setPicked] = useState<number[]>([]);
  const set = (p: number[]) => { setPicked(p); if (p.length) onChange(p.map((i) => ex.bank[i])); };
  return (
    <div>
      <div className="flex min-h-[64px] flex-wrap gap-2 border-b border-line pb-3" aria-label="Your answer">
        {picked.map((i, k) => <button key={k} disabled={locked} onClick={() => set(picked.filter((_, j) => j !== k))} className="rounded-full bg-yellow px-4 py-2 font-medium text-[#111]">{ex.bank[i]}</button>)}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {ex.bank.map((w, i) => <button key={i} disabled={locked || picked.includes(i)} onClick={() => set([...picked, i])} className="rounded-full border border-line px-4 py-2 font-medium disabled:opacity-25">{w}</button>)}
      </div>
    </div>
  );
}

function Match({ ex, onChange, locked }: { ex: Extract<PublicExercise, { type: "match" }>; onChange: (a: Ans) => void; locked: boolean }) {
  const [left, setLeft] = useState<string | null>(null);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const usedL = useMemo(() => new Set(pairs.map((p) => p.target)), [pairs]);
  const usedR = useMemo(() => new Set(pairs.map((p) => p.english)), [pairs]);
  const pickRight = (r: string) => {
    if (!left) return;
    const np = [...pairs, { target: left, english: r }];
    setPairs(np); setLeft(null);
    if (np.length === ex.left.length) onChange(np);
  };
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="grid gap-3">{ex.left.map((l) => <button key={l} disabled={locked || usedL.has(l)} onClick={() => setLeft(l)} className={`rounded-card border px-3 py-3 font-medium disabled:opacity-30 ${left === l ? "border-ink bg-yellow text-[#111]" : "border-line"}`}>{l}</button>)}</div>
      <div className="grid gap-3">{ex.right.map((r) => <button key={r} disabled={locked || usedR.has(r) || !left} onClick={() => pickRight(r)} className="rounded-card border border-line px-3 py-3 font-medium disabled:opacity-30">{r}</button>)}</div>
    </div>
  );
}

function Results({ r, id }: { r: Result; id: string }) {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-between px-4 pb-8 pt-16">
      <div>
        <p className="text-sm text-muted">{isCheckpoint(id) ? "Checkpoint" : "Lesson"} complete</p>
        <h1 className="mt-2 text-5xl font-bold tracking-tighter">{r.passed ? "Passed" : r.tooFast ? "Too fast" : "Not this time"}</h1>
        <p className="mt-3 font-mono text-3xl">{Math.round(r.accuracy * 100)}%</p>
        <p className="mt-2 max-w-[34ch] text-muted">
          {r.passed ? `Streak: ${r.streak} day${r.streak === 1 ? "" : "s"}.` : r.tooFast ? `You got it right, but a pass needs at least ${r.minSeconds} seconds. Slow down and listen to each word.` : "You need 80% to pass. Try again, the words you missed will come up first."}
        </p>
      </div>
      <div className="grid gap-3">
        {r.voucher && <Link href="/earn" className="rounded-card border border-ink p-4 text-center font-semibold">You earned {fmtGD(r.voucher.amount)} G$. Claim it</Link>}
        {r.passed && !r.voucher && r.reviewPending && <p className="rounded-card border border-line p-4 text-center text-sm text-muted">Your reward is being reviewed. It will show up in Earn once that clears.</p>}
        <Link href="/learn" className="rounded-full bg-yellow px-5 py-4 text-center font-semibold text-[#111]">{r.passed ? "Continue" : "Back to lessons"}</Link>
      </div>
    </main>
  );
}
