"use client";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Medal, Trophy, Users } from "lucide-react";
import { useApi } from "@/lib/useApi";
import { AppShell } from "@/components/AppShell";
import { LeagueSkeleton } from "@/components/Skeletons";
import { Avatar } from "@/components/Avatar";
import { useAuthGate } from "@/components/useAuthGate";
import { Badge, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
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
      <PageHeader eyebrow="This week" title="League" description="Your weekly group. Earn points by passing lessons. The top 3 share a G$ bonus when the week ends." />

      {!data.joined && (
        <EmptyState icon={Users} title="You're not in a group yet" className="mt-8" action={<ButtonLink href="/learn">Start a lesson</ButtonLink>}>
          Pass a lesson today to join this week&apos;s group.
        </EmptyState>
      )}

      {data.joined && left && (
        <>
          <div className="mt-8 grid grid-cols-[1.5fr_1fr] gap-4">
            <Card className="p-6">
              <p className="flex items-center gap-1.5 text-[13px] font-medium text-muted"><Trophy size={14} aria-hidden /> Your rank</p>
              <p className="tabular mt-2 text-[2.5rem] font-semibold leading-none tracking-[-0.03em] text-ink">{me ? `#${me.rank}` : "Not ranked"} {me && <span className="text-sm font-medium tracking-normal text-muted">of {data.rows.length}</span>}</p>
              {me && <p className="tabular mt-2 text-sm text-ink-2">{pts(me.points)} points</p>}
              {nudge && <p className="mt-3 border-t border-line pt-3 text-sm font-medium text-sage-700">{nudge}</p>}
            </Card>
            <Card className="p-5">
              <p className="flex items-center gap-1.5 text-[13px] font-medium text-muted"><CalendarClock size={14} aria-hidden /> Week ends in</p>
              <p className="tabular mt-2 text-xl font-semibold tracking-[-0.02em] text-ink">{left.n} <span className="text-sm font-medium text-muted">{left.unit}</span></p>
            </Card>
          </div>

          {/* overflow-clip keeps the rounded corners without stopping the "You" row from sticking while you scroll. */}
          <Card className="mt-6 overflow-clip">
            <ol className="divide-y divide-line">
              {data.rows.map((r) => (
                <li key={r.wallet + r.rank}
                  className={cn("flex items-center gap-4 px-5 py-3.5", r.you && "sticky bottom-[5.5rem] top-14 z-10 border-y border-sage-100 bg-sage-50 lg:bottom-0 lg:top-0", r.rank === 3 && "border-b-2 border-line-strong")}>
                  <span className={cn("tabular grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-semibold", MEDAL[r.rank] ?? "text-muted")}>
                    {r.rank <= 3 ? <Medal size={15} role="img" aria-label={`Rank ${r.rank}`} /> : r.rank}
                  </span>
                  <Avatar src={r.avatarUrl} name={r.name} size={36} />
                  <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">{r.name}</span>
                  {r.you && <Badge tone="sage">You</Badge>}
                  <span className="tabular min-w-16 text-right text-sm font-semibold text-ink">{pts(r.points)} <span className="font-normal text-muted">pts</span></span>
                </li>
              ))}
            </ol>
          </Card>
          <p className="mt-4 text-center text-xs text-muted">Ranks 1 to 3 receive the league bonus as a reward you can claim.</p>
        </>
      )}
    </AppShell>
  );
}
