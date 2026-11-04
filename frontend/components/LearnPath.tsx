"use client";
import { useEffect, useRef } from "react";
import { PathNode, type NodeState } from "./PathNode";

export type PathNodeData = { id: string; title: string; state: "passed" | "next" | "locked" };
export type PathUnit = { n: number; title: string; blurb: string; level: string; done: number; total: number; lessons: PathNodeData[]; checkpoint: { id: string; state: NodeState; cooldownUntil: string | null } };

// A gentle S-curve, in pixels from the centre line, so the path winds like a trail.
const WIND = [0, 34, 56, 34, 0, -34, -56, -34];

function UnitRing({ done, total }: { done: number; total: number }) {
  const size = 44, stroke = 5, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <span className="relative grid shrink-0 place-items-center font-mono text-xs" style={{ width: size, height: size }} role="img" aria-label={`${done} of ${total} done`}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} style={{ stroke: "color-mix(in srgb, currentColor 18%, transparent)" }} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - done / total)} style={{ stroke: "currentColor", transition: "stroke-dashoffset 400ms ease" }} />
      </svg>
      {done}/{total}
    </span>
  );
}


/** The whole A1 trail: a banner per unit, then a winding line of circles that fill as the learner completes the unit. */
export function LearnPath({ units, currentUnit, nextLessonId }: { units: PathUnit[]; currentUnit: number; nextLessonId: string | null }) {
  const here = useRef<HTMLDivElement>(null);
  // Bring the learner's next circle into view once, so they never have to hunt for where they stopped.
  useEffect(() => {
    here.current?.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, []);
  return (
    <>
      {units.map((u) => {
        const current = u.n === currentUnit;
        const locked = u.lessons[0].state === "locked";
        return (
          <section key={u.n} aria-labelledby={`unit-${u.n}`} className="mb-10">
            <div className={`flex items-center gap-3 rounded-card border p-4 ${current ? "border-ink bg-yellow text-[#111]" : locked ? "border-line text-muted" : "border-line"}`}>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-xs uppercase tracking-wider">{u.level} · Unit {u.n}</p>
                <h2 id={`unit-${u.n}`} className="text-xl font-bold tracking-tight">{u.title}</h2>
                <p className="text-sm opacity-80">{u.blurb}</p>
              </div>
              <UnitRing done={u.done} total={u.total} />
            </div>

            <ol className="mt-6 flex flex-col items-center gap-5">
              {u.lessons.map((l, i) => {
                const isNext = l.id === nextLessonId;
                return (
                  <li key={l.id} style={{ transform: `translateX(${WIND[i % WIND.length]}px)` }} className="relative">
                    {isNext && (
                      <div ref={here} className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-input border border-ink bg-paper px-3 py-1 font-mono text-xs font-semibold uppercase tracking-wider">
                        {u.done === 0 ? "Start" : "Next"}
                      </div>
                    )}
                    <PathNode href={`/learn/${l.id}`} state={l.state} progress={u.done / u.total} label={l.title} />
                  </li>
                );
              })}
              <li className="mt-1">
                {u.checkpoint.state === "next" && <div ref={here} />}
                <PathNode href={`/learn/${u.checkpoint.id}`} state={u.checkpoint.state} progress={u.done / u.total} size={92} kind="checkpoint" label={`Unit ${u.n} checkpoint`} />
                <p className="mt-2 text-center text-xs text-muted">{u.checkpoint.state === "cooldown" ? "Try again later" : "Checkpoint"}</p>
              </li>
            </ol>
          </section>
        );
      })}
    </>
  );
}
