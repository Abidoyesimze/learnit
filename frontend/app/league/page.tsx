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

function daysLeft(endsAt: string) {
  const ms = new Date(endsAt).getTime() - Date.now();
  return Math.max(1, Math.ceil(ms / 86400_000));
}

export default function League() {
  const ok = useAuthGate();
  const api = useApi();
  const { data } = useQuery({ queryKey: ["league"], queryFn: () => api<Board>("/api/league"), enabled: ok });

  if (!data) return <LeagueSkeleton />;
  const me = data.joined ? data.rows.find((r) => r.you) : null;
  return (
    <AppShell width="narrow">
      <PageHeader eyebrow="This week" title="League" description="Your weekly group. Earn points by passing lessons. The top 3 share a G$ bonus when the week ends." />

      {!data.joined && (
        <EmptyState icon={Users} title="You're not in a group yet" className="mt-8" action={<ButtonLink href="/learn">Start a lesson</ButtonLink>}>
          Pass a lesson today to join this week&apos;s group.
        </EmptyState>
      )}

      {data.joined && (
        <>
          <div className="mt-8 grid grid-cols-2 gap-4">
            <Card className="p-5">
              <p className="flex items-center gap-1.5 text-[13px] font-medium text-muted"><Trophy size={14} aria-hidden /> Your rank</p>
              <p className="tabular mt-1 text-2xl font-semibold tracking-[-0.02em] text-ink">{me ? `#${me.rank}` : "–"} <span className="text-sm font-medium text-muted">of {data.rows.length}</span></p>
            </Card>
            <Card className="p-5">
              <p className="flex items-center gap-1.5 text-[13px] font-medium text-muted"><CalendarClock size={14} aria-hidden /> Week ends in</p>
              <p className="tabular mt-1 text-2xl font-semibold tracking-[-0.02em] text-ink">{daysLeft(data.endsAt)} <span className="text-sm font-medium text-muted">day{daysLeft(data.endsAt) === 1 ? "" : "s"}</span></p>
            </Card>
          </div>

          <Card className="mt-6 overflow-hidden">
            <ol className="divide-y divide-line">
              {data.rows.map((r) => (
                <li key={r.wallet + r.rank} className={cn("flex items-center gap-4 px-5 py-3.5", r.you && "bg-sage-50")}>
                  <span className={cn("tabular grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-semibold", MEDAL[r.rank] ?? "text-muted")}>
                    {r.rank <= 3 ? <Medal size={15} aria-label={`Rank ${r.rank}`} /> : r.rank}
                  </span>
                  <Avatar src={r.avatarUrl} name={r.name} size={36} />
                  <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">{r.name}</span>
                  {r.you && <Badge tone="sage">You</Badge>}
                  <span className="tabular w-16 text-right text-sm font-semibold text-ink">{r.points} <span className="font-normal text-muted">pts</span></span>
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
