"use client";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { fmtGD } from "@learnit/backend/format";
import { Badge, Card, CardHeader, Notice, PageHeader, Stat } from "@/components/ui";
import { Sk } from "@/components/ui/Sk";
import { useAdmin } from "@/components/admin/AdminProvider";
import { cohortStatus, useCohorts, usePool, useVaultPaused } from "@/components/admin/data";
import { DayBars, Unlock, fillDays } from "@/components/admin/bits";

const label = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" });

export default function Overview() {
  const { ubi } = useAdmin();
  const cohorts = useCohorts();
  const pool = usePool();
  const vaultPaused = useVaultPaused();
  const now = Math.floor(Date.now() / 1000);

  const live = (cohorts.data ?? []).filter((c) => ["open", "running"].includes(cohortStatus(c, now)));
  const toFinalize = (cohorts.data ?? []).filter((c) => cohortStatus(c, now) === "finalize");
  const upcoming = (cohorts.data ?? []).filter((c) => cohortStatus(c, now) === "upcoming");
  const staked = live.reduce((s, c) => s + c.pot, 0n);

  // Things that need a person, most urgent first.
  const attention: { key: string; text: string; href: string }[] = [];
  if (toFinalize.length) attention.push({ key: "fin", text: `${toFinalize.length === 1 ? `Challenge ${toFinalize[0].id} has` : `${toFinalize.length} challenges have`} ended and need finalizing.`, href: "/admin/challenges" });
  if (vaultPaused.data) attention.push({ key: "vp", text: "Staking is paused.", href: "/admin/challenges" });
  if (pool.data?.paused) attention.push({ key: "pp", text: "Reward payouts are paused.", href: "/admin/pool" });
  if (pool.data && pool.data.balance < pool.data.dailyBudget) attention.push({ key: "low", text: "The rewards pool holds less than one day's budget.", href: "/admin/pool" });
  if (cohorts.data && !live.length && !upcoming.length) attention.push({ key: "none", text: "No challenge is open or scheduled. Create the next one.", href: "/admin/challenges" });

  const days = ubi.data ? fillDays(ubi.data.days, 14) : [];

  return (
    <div className="grid gap-8">
      <PageHeader title="Overview" description="How LearnIt is doing on-chain and in G$ claims." />

      <section aria-labelledby="attention">
        <h2 id="attention" className="sr-only">Needs attention</h2>
        {cohorts.isLoading || pool.isLoading ? <Sk className="h-14 rounded-input" /> : attention.length ? (
          <ul className="grid gap-2">
            {attention.map((a) => (
              <li key={a.key}>
                <Link href={a.href} className="group flex items-center justify-between gap-3 rounded-input border border-coral-100 bg-coral-50 px-4 py-3 text-sm text-coral-700 transition hover:border-coral-300">
                  <span className="font-medium">{a.text}</span>
                  <ArrowRight size={16} aria-hidden className="shrink-0 transition-transform duration-150 group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Notice tone="success" title="Nothing needs attention">Challenges are running, and the pool is funded and paying out.</Notice>
        )}
      </section>

      <Card className="grid gap-6 p-6 sm:grid-cols-2 lg:grid-cols-4">
        {pool.isLoading || cohorts.isLoading ? [0, 1, 2, 3].map((i) => <Sk key={i} className="h-14 rounded-input" />) : (
          <>
            <Stat label="Rewards pool" value={pool.data ? fmtGD(pool.data.balance) : "n/a"} unit={pool.data ? "G$" : undefined} hint={pool.data ? `${fmtGD(pool.data.spentToday)} G$ paid out today` : "Not set up"} />
            <Stat label="Staked now" value={fmtGD(staked)} unit="G$" hint={`${live.length} live ${live.length === 1 ? "challenge" : "challenges"}`} />
            <Stat label="UBI claimed today" value={ubi.data ? fmtGD(ubi.data.today.total) : "Locked"} unit={ubi.data ? "G$" : undefined} hint={ubi.data ? `${ubi.data.today.claimers} people` : "Sign in below"} />
            <div>
              <p className="text-[13px] font-medium text-muted">Staking</p>
              <div className="mt-1.5">{vaultPaused.isLoading ? <Sk className="h-6 w-20 rounded-full" /> : <Badge tone={vaultPaused.data ? "coral" : "sage"} icon={vaultPaused.data ? undefined : CheckCircle2}>{vaultPaused.data ? "Paused" : "Running"}</Badge>}</div>
              <p className="mt-1.5 text-xs text-muted">{upcoming.length} upcoming</p>
            </div>
          </>
        )}
      </Card>

      <Card className="p-6">
        <CardHeader title="UBI claims, last 14 days" description="G$ claimed through LearnIt per UTC day."
          action={ubi.data && <Link href="/admin/ubi" className="inline-flex items-center gap-1 text-sm font-medium text-ink underline-offset-4 hover:underline">Details <ArrowRight size={14} aria-hidden /></Link>} />
        <div className="mt-5">
          {ubi.data ? (
            <DayBars values={days.map((d) => BigInt(d.total))} labels={days.map((d) => label(d.day))} format={(v) => fmtGD(v)} />
          ) : ubi.isLoading ? <Sk className="h-32" /> : <Unlock what="UBI claim totals" />}
        </div>
      </Card>
    </div>
  );
}
