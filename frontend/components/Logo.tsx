import { cn } from "@/lib/cn";

/** The LearnIt mark: a navy tile with an open speech curve and a coral dot. `compact` drops the wordmark on small screens. */
export function Logo({ compact = false, inverse = false, className }: { compact?: boolean; inverse?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden className="shrink-0">
        <rect width="32" height="32" rx="9" fill={inverse ? "#fff" : "var(--ink)"} />
        <path d="M10 9.5v10.25a2.75 2.75 0 0 0 2.75 2.75H21" fill="none" stroke={inverse ? "var(--ink)" : "#fff"} strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="21.5" cy="11" r="2.4" fill="var(--coral-500)" />
      </svg>
      <span className={cn("text-[17px] font-semibold tracking-[-0.02em]", inverse ? "text-white" : "text-ink", compact && "max-[380px]:sr-only")}>LearnIt</span>
    </span>
  );
}
