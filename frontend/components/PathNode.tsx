import Link from "next/link";
import { Tick02Icon, LockIcon, PlayIcon, Award01Icon } from "hugeicons-react";

export type NodeState = "passed" | "next" | "locked" | "cooldown";

/** One circle on the learning path. The ring around it fills as the unit is completed. */
export function PathNode({ href, state, progress, size = 72, kind = "lesson", label }: { href?: string; state: NodeState; progress: number; size?: number; kind?: "lesson" | "checkpoint"; label: string }) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const arc = state === "passed" ? 1 : state === "next" ? Math.max(0.04, progress) : 0;
  const Icon = state === "passed" ? Tick02Icon : state === "next" ? (kind === "checkpoint" ? Award01Icon : PlayIcon) : state === "cooldown" ? LockIcon : kind === "checkpoint" ? Award01Icon : LockIcon;
  const face =
    state === "passed" ? "bg-yellow text-[#111]"
    : state === "next" ? (kind === "checkpoint" ? "bg-ink text-paper" : "bg-yellow text-[#111]")
    : "bg-line text-muted";
  const inner = (
    <span className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} style={{ stroke: "var(--line)" }} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - arc)}
          style={{ stroke: state === "next" ? "var(--ink)" : "var(--yellow)", transition: "stroke-dashoffset 400ms ease" }} />
      </svg>
      <span className={`grid place-items-center rounded-full ${face}`} style={{ width: size - stroke * 2 - 6, height: size - stroke * 2 - 6 }}>
        <Icon size={kind === "checkpoint" ? 30 : 26} strokeWidth={1.75} />
      </span>
    </span>
  );
  const open = state === "passed" || state === "next";
  if (!open || !href) return <span role="img" aria-label={`${label}, locked`} className="block">{inner}</span>;
  return <Link href={href} aria-label={`${label}, ${state === "passed" ? "completed, tap to replay" : "start"}`} className="block rounded-full transition active:scale-95">{inner}</Link>;
}
