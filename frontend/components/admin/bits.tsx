"use client";
import { useState, type ReactNode } from "react";
import { Copy, Check } from "lucide-react";
import { parseUnits } from "viem";
import { Button, Notice } from "@/components/ui";
import type { UbiDay } from "./data";

export const when = (s: number) => new Date(s * 1000).toLocaleString("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
export const shortAddr = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`;
export const parseG = (v: string): bigint | null => {
  const t = v.trim();
  if (!/^\d*\.?\d*$/.test(t) || t === "" || t === ".") return null;
  try { return parseUnits(t, 18); } catch { return null; }
};

/** A transaction the connected wallet cannot send (the Safe is the admin): address and calldata to paste into the Safe app. */
export function SafeTx({ to, data, note }: { to: string; data: `0x${string}`; note: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { void navigator.clipboard?.writeText(data).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {}); };
  return (
    <div className="grid gap-3 rounded-input border border-line bg-sunken p-4 text-sm">
      <p className="text-pretty leading-relaxed text-ink-2">{note}</p>
      <div>
        <p className="text-xs font-medium text-muted">To</p>
        <p className="mt-0.5 break-all font-mono text-xs text-ink">{to}</p>
      </div>
      <div>
        <p className="text-xs font-medium text-muted">Data</p>
        <p className="mt-0.5 max-h-24 overflow-auto break-all font-mono text-xs text-ink">{data}</p>
      </div>
      <Button variant="outline" size="sm" icon={copied ? Check : Copy} onClick={copy} className="justify-self-start">{copied ? "Copied" : "Copy data"}</Button>
    </div>
  );
}

/** Vertical bars, one per day, newest on the right. The data also lives in a table on the UBI page, so this is a summary for sighted users. */
export function DayBars({ values, labels, format }: { values: bigint[]; labels: string[]; format: (v: bigint) => string }) {
  const max = values.reduce((m, v) => (v > m ? v : m), 0n);
  return (
    <div role="img" aria-label={`Daily totals, ${labels[0]} to ${labels[labels.length - 1]}. Highest day ${format(max)} G$.`}>
      <div className="flex h-32 items-end gap-1.5">
        {values.map((v, i) => {
          const h = max === 0n ? 0 : Number((v * 1000n) / max) / 10;
          return (
            <div key={labels[i]} className="group relative flex h-full flex-1 items-end" title={`${labels[i]}: ${format(v)} G$`}>
              <div className="w-full rounded-t-[6px] bg-sage-500 transition-colors duration-150 group-hover:bg-sage-700" style={{ height: `${Math.max(v > 0n ? 4 : 1, h)}%`, opacity: v > 0n ? 1 : 0.25 }} />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted tabular"><span>{labels[0]}</span><span>{labels[labels.length - 1]}</span></div>
    </div>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  return <Notice tone="danger">{error instanceof Error ? error.message : "Something went wrong."}</Notice>;
}

/** The last `n` UTC days, oldest first, with zeros for days nobody claimed. */
export function fillDays(days: UbiDay[], n: number): UbiDay[] {
  const by = new Map(days.map((d) => [d.day, d]));
  const out: UbiDay[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const k = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    out.push(by.get(k) ?? { day: k, claims: 0, claimers: 0, total: "0" });
  }
  return out;
}

