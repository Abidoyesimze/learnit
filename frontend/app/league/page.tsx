"use client";
import { useQuery } from "@tanstack/react-query";
import { Medal, Users } from "lucide-react";
import { useApi } from "@/lib/useApi";
import { AppShell } from "@/components/AppShell";
import { LeagueSkeleton } from "@/components/Skeletons";
import { Avatar } from "@/components/Avatar";
import { useAuthGate } from "@/components/useAuthGate";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { cn } from "@/lib/cn";

type Row = { you: boolean; wallet: string; name: string; avatarUrl: string | null; points: number; rank: number };
type Board = { joined: false } | { joined: true; weekKey: string; endsAt: string; rows: Row[] };

// Gold, silver and bronze, softened to sit with the rest of the palette.
const MEDAL: Record<number, string> = { 1: "bg-[#f3e3b5] text-[#7a5a12]", 2: "bg-[#e3e6ea] text-[#475163]", 3: "bg-[#f0d9c8] text-[#87502c]" };

/** "3 days" until the last day, then "5 hours" so the last day does not read as "1 day". */
function timeLeft(endsAt: string) {
  const ms = Math.max(0, new Date(endsAt).getTime() - Date.now());
  const hours = Math.ceil(ms / 3600_000);
  if (hours <= 24) return { n: Math.max(1, hours), unit: hours === 1 ? "hour" : "hours" };
  const days = Math.ceil(ms / 86400_000);
  return { n: days, unit: days === 1 ? "day" : "days" };
}

const pts = (n: number) => n.toLocaleString("en");

export default function League() {
  const ok = useAuthGate();
  const api = useApi();
  const { data } = useQuery({ queryKey: ["league"], queryFn: () => api<Board>("/api/league"), enabled: ok });

  if (!data) return <LeagueSkeleton />;
  const me = data.joined ? data.rows.find((r) => r.you) : null;
  const ahead = data.joined && me && me.rank > 1 ? data.rows.find((r) => r.rank === me.rank - 1) : null;
  const behind = data.joined && me && me.rank === 1 ? data.rows.find((r) => r.rank === 2) : null;
  const left = data.joined ? timeLeft(data.endsAt) : null;
  // One line of direction: how far to the next rank, or how far you lead.
  const nudge = ahead && me ? `${pts(Math.max(1, ahead.points - me.points + 1))} ${ahead.points - me.points + 1 === 1 ? "point" : "points"} to pass ${ahead.name}`
    : behind && me ? (me.points > behind.points ? `You lead by ${pts(me.points - behind.points)} ${me.points - behind.points === 1 ? "point" : "points"}` : "Level with second place") : null;

  return (
    <AppShell width="narrow">
      <PageHeader eyebrow="This week" title="League" description="Pass lessons to earn points. The top 3 share a G$ bonus when the week ends." />

      {!data.joined && (
        <EmptyState icon={Users} title="You're not in a group yet" className="mt-8" action={<ButtonLink href="/learn">Start a lesson</ButtonLink>}>
          Pass a lesson today to join this week&apos;s group.
        </EmptyState>
      )}

      {data.joined && left && (
        <>
          <Card className="mt-8 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-muted">Your rank</p>
                <p className="tabular mt-1.5 text-[2.5rem] font-semibold leading-none tracking-[-0.03em] text-ink">{me ? `#${me.rank}` : "Not ranked"} {me && <span className="text-sm font-medium tracking-normal text-muted">of {data.rows.length}</span>}</p>
              </div>
              <p className="shrink-0 text-right text-[13px] font-medium text-muted">Ends in<span className="tabular mt-1.5 block text-base font-semibold text-ink">{left.n} {left.unit}</span></p>
            </div>
            {nudge && <p className="mt-4 border-t border-line pt-3 text-sm font-medium text-sage-700">{nudge}</p>}
          </Card>

          {/* overflow-clip keeps the rounded corners without stopping the "You" row from sticking while you scroll. */}
          <Card className="mt-6 overflow-clip">
            <ol className="divide-y divide-line">
              {data.rows.map((r) => (
                <li key={r.wallet + r.rank}
                  className={cn("flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5", r.you && "sticky bottom-[5.5rem] top-14 z-10 border-y border-sage-100 bg-sage-50 shadow-[inset_3px_0_0_var(--sage-600)] lg:bottom-0 lg:top-0", r.rank === 3 && "border-b-2 border-line-strong")}>
                  <span className={cn("tabular grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-semibold", MEDAL[r.rank] ?? "text-muted")}>
                    {r.rank <= 3 ? <Medal size={15} role="img" aria-label={`Rank ${r.rank}`} /> : r.rank}
                  </span>
                  <Avatar src={r.avatarUrl} name={r.name} size={32} className="shrink-0" />
                  <span className={cn("min-w-0 flex-1 truncate text-[15px] text-ink", r.you ? "font-semibold" : "font-medium")}>{r.name}{r.you && <span className="sr-only"> (you)</span>}</span>
                  <span className="tabular shrink-0 text-right text-sm font-semibold text-ink">{pts(r.points)}<span className="sr-only"> points</span></span>
                </li>
              ))}
            </ol>
          </Card>
        </>
      )}
    </AppShell>
  );
}
