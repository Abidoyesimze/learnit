"use client";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { fmtGD } from "@learnit/backend/format";
import { Badge, Card, CardHeader, Notice, PageHeader, Stat } from "@/components/ui";
import { Sk } from "@/components/ui/Sk";
import { cohortStatus, useCohorts, usePool, usePublicStats, useVaultPaused } from "@/components/admin/data";
import { DayBars, ErrorNote, fillDays } from "@/components/admin/bits";

const label = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" });
const num = (n: number | null | undefined) => (n === null || n === undefined ? "n/a" : n.toLocaleString("en"));

export default function Overview() {
  const stats = usePublicStats();
  const cohorts = useCohorts();
  const pool = usePool();
  const vaultPaused = useVaultPaused();
  const now = Math.floor(Date.now() / 1000);
  const s = stats.data;

  const live = (cohorts.data ?? []).filter((c) => ["open", "running"].includes(cohortStatus(c, now)));
  const toFinalize = (cohorts.data ?? []).filter((c) => cohortStatus(c, now) === "finalize");
  const upcoming = (cohorts.data ?? []).filter((c) => cohortStatus(c, now) === "upcoming");
  const staked = live.reduce((t, c) => t + c.pot, 0n);

  // Things that need a person, most urgent first.
  const attention: { key: string; text: string; href: string }[] = [];
  if (toFinalize.length) attention.push({ key: "fin", text: `${toFinalize.length === 1 ? `Challenge ${toFinalize[0].id} has` : `${toFinalize.length} challenges have`} ended and need finalizing.`, href: "/admin/challenges" });
  if (vaultPaused.data) attention.push({ key: "vp", text: "Staking is paused.", href: "/admin/challenges" });
  if (pool.data?.paused) attention.push({ key: "pp", text: "Reward payouts are paused.", href: "/admin/pool" });
  if (pool.data && pool.data.balance < pool.data.dailyBudget) attention.push({ key: "low", text: "The rewards pool holds less than one day's budget.", href: "/admin/pool" });
  if (cohorts.data && !live.length && !upcoming.length) attention.push({ key: "none", text: "No challenge is open or scheduled.", href: "/admin/challenges" });

  const days = s ? fillDays(s.ubi.days, 14) : [];

  return (
    <div className="grid gap-8">
      <PageHeader title="Overview" description="LearnIt's public performance dashboard: people, G$ claimed and on-chain activity. Totals only, no personal data." />

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

      <ErrorNote error={stats.error} />

      <section aria-labelledby="people" className="grid gap-4">
        <h2 id="people" className="text-[15px] font-semibold text-ink">People</h2>
        <Card className="grid gap-6 p-6 sm:grid-cols-2 lg:grid-cols-4">
          {stats.isLoading ? [0, 1, 2, 3].map((i) => <Sk key={i} className="h-14 rounded-input" />) : s && (
            <>
              <Stat label="Users" value={num(s.users.total)} hint={`${num(s.users.newLast7d)} new this week`} />
              <Stat label="Active this week" value={num(s.users.active7d)} hint={`${num(s.users.active1d)} today, ${num(s.users.active30d)} in 30 days`} />
              <Stat label="GoodDollar-verified" value={num(s.users.verified)} hint={s.users.total ? `of ${num(s.users.total)} users` : undefined} />
              <Stat label="Lessons passed" value={num(s.learning.passed)} hint={`${num(s.learning.learnersWithPass)} learners, ${num(s.learning.attempts)} attempts`} />
            </>
          )}
        </Card>
      </section>

      <section aria-labelledby="gd" className="grid gap-4">
        <h2 id="gd" className="text-[15px] font-semibold text-ink">G$ and on-chain</h2>
        <Card className="grid gap-6 p-6 sm:grid-cols-2 lg:grid-cols-4">
          {stats.isLoading || pool.isLoading || cohorts.isLoading ? [0, 1, 2, 3].map((i) => <Sk key={i} className="h-14 rounded-input" />) : (
            <>
              <Stat label="UBI claimed, all time" value={s ? fmtGD(s.ubi.allTime.total) : "n/a"} unit={s ? "G$" : undefined} hint={s ? `${num(s.ubi.allTime.claims)} claims, ${num(s.ubi.allTime.claimers)} people` : undefined} />
              <Stat label="UBI claimed today" value={s ? fmtGD(s.ubi.today.total) : "n/a"} unit={s ? "G$" : undefined} hint={s ? `${num(s.ubi.today.claimers)} people` : undefined} />
              <Stat label="Rewards pool" value={pool.data ? fmtGD(pool.data.balance) : "n/a"} unit={pool.data ? "G$" : undefined} hint={pool.data ? `${fmtGD(pool.data.spentToday)} G$ paid out today` : "Not set up"} />
              <div>
                <Stat label="Staked now" value={fmtGD(staked)} unit="G$" hint={`${live.length} live ${live.length === 1 ? "challenge" : "challenges"}`} />
                <div className="mt-2">{vaultPaused.isLoading ? <Sk className="h-5 w-16 rounded-full" /> : <Badge tone={vaultPaused.data ? "coral" : "sage"} icon={vaultPaused.data ? undefined : CheckCircle2}>{vaultPaused.data ? "Staking paused" : "Staking running"}</Badge>}</div>
              </div>
            </>
          )}
        </Card>
      </section>

      <Card className="p-6">
        <CardHeader title="UBI claims, last 14 days" description="G$ claimed through LearnIt per UTC day."
          action={s && <Link href="/admin/ubi" className="inline-flex items-center gap-1 text-sm font-medium text-ink underline-offset-4 hover:underline">Details <ArrowRight size={14} aria-hidden /></Link>} />
        <div className="mt-5">
          {s ? <DayBars values={days.map((d) => BigInt(d.total))} labels={days.map((d) => label(d.day))} format={(v) => fmtGD(v)} /> : stats.isLoading ? <Sk className="h-32" /> : <p className="text-sm text-muted">Numbers are unavailable right now.</p>}
        </div>
      </Card>
    </div>
  );
}
