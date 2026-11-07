"use client";
/*
  Small, dependency-free charts for the admin pages. Colour comes from the page tokens: sage for data, coral only for a limit or a warning.
  Every chart is a single keyboard stop (arrow keys move through points), shows its active value in text, and has a screen-reader summary.
*/
import { useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Round a maximum up to a tidy axis value, so gridlines land on 1, 2, 2.5, 5 or 10 times a power of ten. */
export function niceMax(max: number, ticks = 3) {
  if (!(max > 0)) return { top: 1, step: 1 / ticks };
  const raw = max / ticks;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * pow >= raw) ?? 10) * pow;
  return { top: step * ticks, step };
}

export const compact = (n: number) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);

/** Index under the pointer for a chart split into `count` equal columns. */
function indexAt(e: PointerEvent<HTMLElement>, count: number) {
  const r = e.currentTarget.getBoundingClientRect();
  return Math.max(0, Math.min(count - 1, Math.floor(((e.clientX - r.left) / r.width) * count)));
}

/** Left and right arrows, Home and End move the active point. */
function useActive(count: number) {
  const [active, setActive] = useState<number | null>(null);
  const onKeyDown = (e: KeyboardEvent) => {
    const at = active ?? count - 1;
    const next = e.key === "ArrowLeft" ? at - 1 : e.key === "ArrowRight" ? at + 1 : e.key === "Home" ? 0 : e.key === "End" ? count - 1 : null;
    if (next === null) return;
    e.preventDefault();
    setActive(Math.max(0, Math.min(count - 1, next)));
  };
  return { active, setActive, onKeyDown };
}

function Readout({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <p className="tabular flex items-baseline gap-2 text-sm" aria-live="polite">
      <span className="text-muted">{label}</span>
      <span className="font-semibold text-ink">{value}</span>
      {sub && <span className="text-muted">{sub}</span>}
    </p>
  );
}

/* ---------- Bars over time ---------- */

type BarProps = {
  values: number[];
  labels: string[];
  /** Full value text for the readout and screen readers, e.g. "1,240 G$". */
  format: (v: number) => string;
  /** Short axis text. Defaults to compact numbers. */
  axis?: (v: number) => string;
  /** A limit drawn as a dashed coral line, e.g. the daily budget. */
  limit?: { value: number; label: string };
  /** Shown beside the active value, e.g. "claims". */
  caption?: string;
  height?: number;
  /** Label every Nth column. Defaults to about six labels. */
  labelEvery?: number;
  className?: string;
};

export function BarChart({ values, labels, format, axis = compact, limit, caption, height = 160, labelEvery, className }: BarProps) {
  const n = values.length;
  const { active, setActive, onKeyDown } = useActive(n);
  const at = active ?? n - 1;
  const { top } = niceMax(Math.max(...values, limit?.value ?? 0, 0));
  const every = labelEvery ?? Math.max(1, Math.ceil(n / 6));
  const peak = values.reduce((b, v, i) => (v > values[b] ? i : b), 0);

  if (!n) return null;
  return (
    <figure className={className}>
      <div className="mb-3 min-h-5"><Readout label={labels[at]} value={format(values[at])} sub={caption} /></div>
      <div className="grid grid-cols-[2.25rem_1fr] gap-x-2">
        <div className="relative tabular text-[11px] text-muted" style={{ height }} aria-hidden>
          {[0, 1, 2, 3].map((i) => <span key={i} className="absolute right-0 -translate-y-1/2" style={{ top: `${100 - (i / 3) * 100}%` }}>{axis((top * i) / 3)}</span>)}
        </div>
        <div
          tabIndex={0} role="group" onKeyDown={onKeyDown} onFocus={() => active === null && setActive(n - 1)} onBlur={() => setActive(null)}
          onPointerMove={(e) => setActive(indexAt(e, n))} onPointerLeave={() => setActive(null)}
          aria-label={`${caption ?? "Values"} by day, ${labels[0]} to ${labels[n - 1]}. Highest ${format(values[peak])} on ${labels[peak]}. Use the left and right arrow keys to read each day.`}
          className="relative cursor-crosshair rounded-input outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          style={{ height }}
        >
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            {[0, 1, 2, 3].map((i) => <div key={i} className={cn("absolute inset-x-0 border-t", i === 0 ? "border-line-strong" : "border-line")} style={{ top: `${100 - (i / 3) * 100}%` }} />)}
            {limit && limit.value <= top && (
              <div className="absolute inset-x-0 border-t border-dashed border-coral-500" style={{ top: `${100 - (limit.value / top) * 100}%` }}>
                <span className="absolute left-0 -translate-y-full pr-1 text-[11px] font-medium text-coral-700">{limit.label}</span>
              </div>
            )}
          </div>
          <div className="relative flex h-full items-end gap-[3px]" aria-hidden>
            {values.map((v, i) => (
              <div key={labels[i]} className="flex h-full flex-1 items-end">
                {/* A zero day draws nothing but the baseline: a stub would read as a real value. */}
                <div className={cn("w-full rounded-t-[2px] transition-colors duration-150", i === at ? "bg-sage-700" : i === n - 1 ? "bg-sage-600" : "bg-sage-500")}
                  style={{ height: `${(v / top) * 100}%`, minHeight: v > 0 ? 2 : 0 }} />
              </div>
            ))}
          </div>
        </div>
        <span />
        <div className="relative mt-2 h-4 text-[11px] text-muted tabular" aria-hidden>
          {labels.map((l, i) => (i % every === 0 || i === n - 1) && (i === n - 1 || n - 1 - i >= every / 2) ? (
            <span key={l} className={cn("absolute whitespace-nowrap", i === n - 1 ? "right-0" : i === 0 ? "left-0" : "-translate-x-1/2")} style={i === 0 || i === n - 1 ? undefined : { left: `${((i + 0.5) / n) * 100}%` }}>{l}</span>
          ) : null)}
        </div>
      </div>
    </figure>
  );
}

/* ---------- Sparkline ---------- */

/** A tiny trend line for a KPI. Decorative: the number beside it carries the meaning, `summary` carries the trend. */
export function Sparkline({ values, summary, className, tone = "sage" }: { values: number[]; summary: string; className?: string; tone?: "sage" | "coral" }) {
  if (values.length < 2) return null;
  const max = Math.max(...values), min = Math.min(...values);
  const span = max - min || 1;
  const W = 100, H = 28, pad = 2;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * W, pad + (1 - (v - min) / span) * (H - pad * 2)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
  const color = tone === "coral" ? "var(--coral-500)" : "var(--sage-600)";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={summary} className={cn("h-7 w-full overflow-visible", className)}>
      <path d={`${line} L${W} ${H} L0 ${H} Z`} fill={color} opacity={0.1} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.75} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Change between the last `n` points and the `n` before them, as a signed percentage. Null when there is no earlier period to compare. */
export function delta(values: number[], n = 7): { pct: number | null; now: number; before: number } {
  const now = values.slice(-n).reduce((a, b) => a + b, 0);
  const before = values.slice(-2 * n, -n).reduce((a, b) => a + b, 0);
  return { now, before, pct: values.length >= 2 * n && before > 0 ? ((now - before) / before) * 100 : null };
}

export function Delta({ pct, className }: { pct: number | null; className?: string }) {
  if (pct === null) return <span className={cn("text-xs text-muted", className)}>No earlier week to compare</span>;
  const up = pct >= 0;
  return <span className={cn("tabular text-xs font-medium", up ? "text-sage-700" : "text-coral-700", className)}>{up ? "+" : "-"}{Math.abs(pct).toFixed(0)}% <span className="font-normal text-muted">vs previous 7 days</span></span>;
}

/* ---------- Line: a balance running down ---------- */

export function LineChart({ points, labels, format, axis = compact, zeroLabel, height = 160, caption, className }: {
  points: number[]; labels: string[]; format: (v: number) => string; axis?: (v: number) => string; zeroLabel?: string; height?: number; caption?: string; className?: string;
}) {
  const n = points.length;
  const { active, setActive, onKeyDown } = useActive(n);
  const at = active ?? 0;
  const { top } = niceMax(Math.max(...points, 0));
  const every = Math.max(1, Math.ceil(n / 6));
  if (n < 2) return null;
  const W = 100, H = 100;
  const xy = points.map((v, i) => [(i / (n - 1)) * W, H - (v / top) * H] as const);
  const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
  const empty = points.findIndex((v) => v <= 0);
  return (
    <figure className={className}>
      <div className="mb-3 min-h-5"><Readout label={labels[at]} value={format(points[at])} sub={caption} /></div>
      <div className="grid grid-cols-[2.25rem_1fr] gap-x-2">
        <div className="relative tabular text-[11px] text-muted" style={{ height }} aria-hidden>
          {[0, 1, 2, 3].map((i) => <span key={i} className="absolute right-0 -translate-y-1/2" style={{ top: `${100 - (i / 3) * 100}%` }}>{axis((top * i) / 3)}</span>)}
        </div>
        <div tabIndex={0} role="group" onKeyDown={onKeyDown} onFocus={() => active === null && setActive(0)} onBlur={() => setActive(null)}
          onPointerMove={(e) => setActive(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - e.currentTarget.getBoundingClientRect().left) / e.currentTarget.getBoundingClientRect().width) * (n - 1)))))} onPointerLeave={() => setActive(null)}
          aria-label={`${caption ?? "Balance"} from ${labels[0]} to ${labels[n - 1]}, starting at ${format(points[0])}${empty > 0 ? ` and running out ${labels[empty]}` : ""}. Use the left and right arrow keys to read each day.`}
          className="relative cursor-crosshair rounded-input outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface" style={{ height }}>
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            {[0, 1, 2, 3].map((i) => <div key={i} className={cn("absolute inset-x-0 border-t", i === 0 ? "border-line-strong" : "border-line")} style={{ top: `${100 - (i / 3) * 100}%` }} />)}
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
            <path d={`${line} L${W} ${H} L0 ${H} Z`} fill="var(--sage-500)" opacity={0.12} />
            <path d={line} fill="none" stroke="var(--sage-600)" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          </svg>
          <span className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-sage-700" style={{ left: `${xy[at][0]}%`, top: `${xy[at][1]}%` }} aria-hidden />
          {empty > 0 && zeroLabel && (
            <span className="pointer-events-none absolute bottom-1 -translate-x-1/2 whitespace-nowrap rounded-full bg-coral-50 px-2 py-0.5 text-[11px] font-medium text-coral-700" style={{ left: `${Math.min(88, (empty / (n - 1)) * 100)}%` }} aria-hidden>{zeroLabel}</span>
          )}
        </div>
        <span />
        <div className="relative mt-2 h-4 text-[11px] text-muted tabular" aria-hidden>
          {labels.map((l, i) => (i % every === 0 && n - 1 - i >= every / 2) || i === n - 1 ? (
            <span key={l + i} className={cn("absolute whitespace-nowrap", i === n - 1 ? "right-0" : i === 0 ? "left-0" : "-translate-x-1/2")} style={i === 0 || i === n - 1 ? undefined : { left: `${(i / (n - 1)) * 100}%` }}>{l}</span>
          ) : null)}
        </div>
      </div>
    </figure>
  );
}

/* ---------- Horizontal bars: funnels and comparisons ---------- */

export type HRow = { label: string; value: number; display?: ReactNode; note?: ReactNode };

/** Rows of label, bar and number. Bars share one scale (`max`, default the largest row) so lengths compare honestly. */
export function HBars({ rows, max, className, tone = "sage" }: { rows: HRow[]; max?: number; className?: string; tone?: "sage" | "ink" }) {
  const top = max ?? Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className={cn("grid gap-4", className)}>
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium text-ink">{r.label}</span>
            <span className="tabular text-ink">{r.display ?? r.value.toLocaleString("en")}</span>
          </div>
          <div className="mt-1.5 h-2.5 rounded-full bg-sunken" role="img" aria-label={`${r.label}: ${r.display ?? r.value}`}>
            <div className={cn("h-full rounded-full", tone === "ink" ? "bg-ink" : "bg-sage-500")} style={{ width: `${Math.max(r.value > 0 ? 2 : 0, Math.min(100, (r.value / top) * 100))}%` }} />
          </div>
          {r.note && <p className="mt-1 text-xs text-muted">{r.note}</p>}
        </li>
      ))}
    </ul>
  );
}
