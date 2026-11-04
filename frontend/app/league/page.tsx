"use client";
import { useQuery } from "@tanstack/react-query";
import { MedalFirstPlaceIcon, MedalSecondPlaceIcon, MedalThirdPlaceIcon } from "hugeicons-react";
import { useApi } from "@/lib/useApi";
import { TabBar } from "@/components/TabBar";
import { LeagueSkeleton } from "@/components/Skeletons";
import { Avatar } from "@/components/Avatar";
import { useAuthGate } from "@/components/useAuthGate";

type Row = { you: boolean; wallet: string; name: string; avatarUrl: string | null; points: number; rank: number };
type Board = { joined: false } | { joined: true; weekKey: string; endsAt: string; rows: Row[] };

const medal = (rank: number) => (rank === 1 ? MedalFirstPlaceIcon : rank === 2 ? MedalSecondPlaceIcon : rank === 3 ? MedalThirdPlaceIcon : null);

function daysLeft(endsAt: string) {
  const ms = new Date(endsAt).getTime() - Date.now();
  return Math.max(1, Math.ceil(ms / 86400_000));
}

export default function League() {
  const ok = useAuthGate();
  const api = useApi();
  const { data } = useQuery({ queryKey: ["league"], queryFn: () => api<Board>("/api/league"), enabled: ok });

  if (!data) return <LeagueSkeleton />;
  return (
    <main className="mx-auto max-w-md px-4 pb-28 pt-6">
      <h1 className="text-3xl font-bold tracking-tighter">League</h1>
      <p className="mt-1 text-sm text-muted">Your weekly group. The top 3 by points share a G$ bonus when the week ends.</p>
      {data && !data.joined && (
        <p className="mt-6 rounded-card border border-line p-5 text-sm text-muted">Pass a lesson today to join this week&apos;s group.</p>
      )}
      {data?.joined && (
        <>
          <p className="mt-4 text-sm text-muted">Ends in {daysLeft(data.endsAt)} day{daysLeft(data.endsAt) === 1 ? "" : "s"}</p>
          <ol className="mt-3 grid gap-2">
            {data.rows.map((r) => {
              const Medal = medal(r.rank);
              return (
                <li key={r.wallet + r.rank} className={`flex items-center gap-3 rounded-card border p-4 ${r.you ? "border-ink bg-yellow text-[#111]" : "border-line"}`}>
                  <span className="w-6 text-center font-mono text-sm font-semibold">{r.rank}</span>
                  {Medal ? <Medal size={20} strokeWidth={1.75} /> : <span className="w-5" />}
                  <Avatar src={r.avatarUrl} name={r.name} size={32} />
                  <span className="flex-1 truncate text-sm font-medium">{r.name}{r.you ? " (you)" : ""}</span>
                  <span className="font-mono text-sm font-semibold">{r.points} pts</span>
                </li>
              );
            })}
          </ol>
        </>
      )}
      <TabBar />
    </main>
  );
}
