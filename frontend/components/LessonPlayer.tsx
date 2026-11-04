"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { VolumeHighIcon, VolumeOffIcon, Tick02Icon, Cancel01Icon } from "hugeicons-react";
import { useApi } from "@/lib/useApi";
import type { PublicExercise } from "@learnit/backend/lessons";
import { fmtGD } from "@learnit/backend/format";
import { LessonSkeleton } from "./Skeletons";
import { playCorrect, playWrong, soundEnabled, setSoundEnabled } from "@/lib/sounds";

type Loaded = { id: string; title: string; speechLang: string; token: string; intro?: { target: string; english: string }[]; exercises: PublicExercise[] };
type Pair = { target: string; english: string };
type Ans = number | string[] | Pair[];
type Feedback = { correct: boolean; answer: unknown };
type Result = { passed: boolean; accuracy: number; durationS: number; minSeconds: number; tooFast: boolean; missedWordIds: string[]; streak: number; attemptId: string; voucherPending: boolean; reviewPending: boolean };

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
  const firstRef = useRef<Record<string, Ans>>({}); // mirrors `first` so submit never reads a stale value
  const [introSeen, setIntroSeen] = useState(false);
  const [sound, setSound] = useState(true);
  useEffect(() => setSound(soundEnabled()), []);
  const base = isCheckpoint(id) ? `/api/checkpoints/${id}` : `/api/lessons/${id}`;

  useEffect(() => {
    api<Loaded>(base).then((d) => { setData(d); setQueue(d.exercises.map((_, i) => i)); }).catch((e) => setErr(e.message));
  }, [api, base]);

  const ex = data && queue[pos] !== undefined ? data.exercises[queue[pos]] : null;
  useEffect(() => { if (ex?.type === "mc" && ex.speak && data && (introSeen || !data.intro?.length)) speak(ex.speak, data.speechLang); }, [ex, data, introSeen]);

  const record = useCallback((exId: string, answer: Ans) => {
    if (exId in firstRef.current) return;
    firstRef.current = { ...firstRef.current, [exId]: answer };
    setFirst(firstRef.current);
  }, []);

  const check = useCallback(async () => {
    if (!data || !ex || cur === null) return;
    setBusy(true);
    try {
      // Plain fetch: this endpoint needs no login token, only the signed start token, so it skips the auth round trip.
      const res = await fetch(`/api/lessons/${data.id}/check`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: data.token, exerciseId: ex.id, answer: cur }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Check failed");
      const r = (await res.json()) as Feedback;
      r.correct ? playCorrect() : playWrong();
      record(ex.id, cur);
      if (!r.correct && !missed.current.includes(queue[pos])) missed.current.push(queue[pos]);
      setFb(r);
    } catch (e) { setErr(e instanceof Error ? e.message : "Check failed"); } finally { setBusy(false); }
  }, [data, ex, cur, queue, pos, record]);

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
    void submit(firstRef.current);
  }, [data, pos, queue, submit]);

  /** Match pairs are checked on the device, so finishing one needs no Check button and no network call. */
  const matchDone = useCallback((answer: Pair[], mistake: boolean) => {
    if (!ex) return;
    record(ex.id, answer);
    if (mistake && !missed.current.includes(queue[pos])) missed.current.push(queue[pos]);
    next();
  }, [ex, record, queue, pos, next]);

  if (err && !data) return <p role="alert" className="p-6 text-sm">{err} <Link className="underline" href="/learn">Back</Link></p>;
  if (!data) return <LessonSkeleton />;
  if (result) return <Results r={result} id={id} />;
  if (data.intro?.length && !introSeen) return <Intro words={data.intro} lang={data.speechLang} title={data.title} onStart={() => setIntroSeen(true)} />;
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
        <button onClick={() => { const on = !sound; setSound(on); setSoundEnabled(on); if (on) playCorrect(); }} aria-label={sound ? "Mute sounds" : "Turn sounds on"} aria-pressed={!sound} className="p-2">
          {sound ? <VolumeHighIcon size={20} strokeWidth={1.75} /> : <VolumeOffIcon size={20} strokeWidth={1.75} />}
        </button>
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
          {ex.type === "match" && <Match key={ex.id} ex={ex} onFinish={matchDone} />}
        </div>
      </section>
      {!fb && ex.type !== "match" && <button onClick={check} disabled={cur === null || busy} className="w-full rounded-full bg-ink px-5 py-4 font-semibold text-paper transition active:scale-[0.98] disabled:opacity-30">Check</button>}
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

function Match({ ex, onFinish }: { ex: Extract<PublicExercise, { type: "match" }>; onFinish: (answer: Pair[], mistake: boolean) => void }) {
  const [left, setLeft] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [wrong, setWrong] = useState<string | null>(null);
  const firstChoice = useRef<Record<string, string>>({});
  const mistake = useRef(false);
  const truth = useMemo(() => Object.fromEntries(ex.pairs.map((p) => [p.target, p.english])), [ex]);
  const doneRight = useMemo(() => new Set(matched.map((l) => truth[l])), [matched, truth]);

  function pickRight(r: string) {
    if (!left) return;
    if (!(left in firstChoice.current)) firstChoice.current[left] = r; // only the first try counts towards accuracy
    if (truth[left] === r) {
      playCorrect();
      const m = [...matched, left];
      setMatched(m); setLeft(null);
      if (m.length === ex.left.length) setTimeout(() => onFinish(ex.left.map((t) => ({ target: t, english: firstChoice.current[t] })), mistake.current), 450);
    } else {
      mistake.current = true;
      playWrong();
      setWrong(r); setLeft(null);
      setTimeout(() => setWrong(null), 450);
    }
  }
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="grid gap-3">
        {ex.left.map((l) => {
          const ok = matched.includes(l);
          return <button key={l} disabled={ok} onClick={() => setLeft(l)} aria-pressed={left === l} className={`rounded-card border px-3 py-3 font-medium transition active:scale-[0.98] ${ok ? "border-ink bg-yellow text-[#111] opacity-60" : left === l ? "border-ink bg-yellow text-[#111]" : "border-line"}`}>{l}</button>;
        })}
      </div>
      <div className="grid gap-3">
        {ex.right.map((r) => {
          const ok = doneRight.has(r);
          return <button key={r} disabled={ok || !left} onClick={() => pickRight(r)} className={`rounded-card border px-3 py-3 font-medium transition active:scale-[0.98] disabled:opacity-40 ${ok ? "border-ink bg-yellow text-[#111] opacity-60" : wrong === r ? "border-ink bg-ink text-paper" : "border-line"}`}>{r}</button>;
        })}
      </div>
    </div>
  );
}

function Results({ r, id }: { r: Result; id: string }) {
  const api = useApi();
  const [voucher, setVoucher] = useState<{ amount: string } | null>(null);
  const [pending, setPending] = useState(r.voucherPending);
  const [review, setReview] = useState(r.reviewPending);
  useEffect(() => {
    if (!r.voucherPending) return;
    let dead = false;
    api<{ voucher: { amount: string } | null; reviewPending: boolean }>("/api/vouchers/issue", { method: "POST", body: JSON.stringify({ attemptId: r.attemptId }) })
      .then((x) => { if (!dead) { setVoucher(x.voucher); setReview(x.reviewPending); } })
      .catch(() => {})
      .finally(() => { if (!dead) setPending(false); });
    return () => { dead = true; };
  }, [api, r]);
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
        {pending && <p className="rounded-card border border-line p-4 text-center text-sm text-muted">Working out your reward...</p>}
        {voucher && <Link href="/earn" className="rounded-card border border-ink p-4 text-center font-semibold">You earned {fmtGD(voucher.amount)} G$. Claim it</Link>}
        {r.passed && !pending && !voucher && review && <p className="rounded-card border border-line p-4 text-center text-sm text-muted">Your reward is being reviewed. It will show up in Earn once that clears.</p>}
        <Link href="/learn" className="rounded-full bg-yellow px-5 py-4 text-center font-semibold text-[#111]">{r.passed ? "Continue" : "Back to lessons"}</Link>
      </div>
    </main>
  );
}

/** Shown before the questions so a complete beginner meets each word, and hears it, before being asked about it. */
function Intro({ words, lang, title, onStart }: { words: { target: string; english: string }[]; lang: string; title: string; onStart: () => void }) {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-4 pb-6 pt-4">
      <header className="flex items-center gap-3">
        <Link href="/learn" aria-label="Quit lesson" className="p-2"><Cancel01Icon size={22} strokeWidth={1.75} /></Link>
        <p className="font-mono text-xs uppercase tracking-wider text-muted">{title}</p>
      </header>
      <section className="flex flex-1 flex-col justify-center py-6">
        <h1 className="text-3xl font-bold tracking-tighter">New words</h1>
        <p className="mt-1 text-muted">Tap a word to hear it. Then you will practise them.</p>
        <ul className="mt-6 grid gap-3">
          {words.map((w) => (
            <li key={w.target}>
              <button onClick={() => speak(w.target, lang)} className="flex w-full items-center justify-between rounded-card border border-line p-4 text-left transition active:scale-[0.98]">
                <span><span className="block text-xl font-semibold">{w.target}</span><span className="text-muted">{w.english}</span></span>
                <VolumeHighIcon size={22} strokeWidth={1.75} />
              </button>
            </li>
          ))}
        </ul>
      </section>
      <button onClick={onStart} className="w-full rounded-full bg-ink px-5 py-4 font-semibold text-paper transition active:scale-[0.98]">Start practice</button>
    </main>
  );
}
