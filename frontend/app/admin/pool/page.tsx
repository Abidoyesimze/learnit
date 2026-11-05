"use client";
import { encodeFunctionData } from "viem";
import { rewardsPoolAbi } from "@learnit/backend/abis";
import { ADDR } from "@learnit/backend/chain";
import { fmtGD } from "@learnit/backend/format";
import { Badge, Card, CardHeader, Notice, PageHeader, Progress, Stat } from "@/components/ui";
import { Sk } from "@/components/ui/Sk";
import { usePool } from "@/components/admin/data";
import { ErrorNote, SafeTx, shortAddr } from "@/components/admin/bits";

export default function Pool() {
  const pool = usePool();
  const addr = ADDR.rewardsPool;
  const d = pool.data;

  if (!addr) {
    return (
      <div className="grid gap-6">
        <PageHeader title="Rewards pool" />
        <Notice tone="info" title="The RewardsPool is not set up yet">Set NEXT_PUBLIC_REWARDS_POOL_ADDRESS after you deploy the contracts, then reload.</Notice>
      </div>
    );
  }

  const usedPct = d && d.dailyBudget > 0n ? Number((d.spentToday * 1000n) / d.dailyBudget) / 1000 : 0;
  const daysLeft = d && d.dailyBudget > 0n ? Number(d.balance / d.dailyBudget) : null;

  return (
    <div className="grid gap-8">
      <PageHeader title="Rewards pool" description="The G$ that pays lesson and checkpoint rewards. It only pays out what has been deposited."
        action={d && <Badge tone={d.paused ? "coral" : "sage"}>{d.paused ? "Paused" : "Paying out"}</Badge>} />

      <ErrorNote error={pool.error} />

      {d && d.balance < d.dailyBudget && !d.paused && (
        <Notice tone="warning" title="The pool holds less than one day's budget">Rewards will start failing once it runs out. Send more G$ from the Safe with approve, then deposit.</Notice>
      )}

      <Card className="grid gap-6 p-6 sm:grid-cols-2 lg:grid-cols-4">
        {pool.isLoading ? [0, 1, 2, 3].map((i) => <Sk key={i} className="h-14 rounded-input" />) : d && (
          <>
            <Stat label="Balance" value={fmtGD(d.balance)} unit="G$" hint={daysLeft === null ? undefined : `About ${daysLeft} days at the daily budget`} />
            <Stat label="Daily budget" value={fmtGD(d.dailyBudget)} unit="G$" hint="Across everyone" />
            <Stat label="Per person, daily" value={fmtGD(d.dailyCap)} unit="G$" />
            <Stat label="Per person, weekly" value={fmtGD(d.weeklyCap)} unit="G$" />
          </>
        )}
      </Card>

      {d && (
        <Card className="p-6">
          <CardHeader title="Paid out today" description="UTC day. Resets at midnight UTC." />
          <div className="mt-4 flex items-baseline justify-between gap-3 tabular">
            <p className="text-2xl font-semibold tracking-[-0.02em] text-ink">{fmtGD(d.spentToday)} <span className="text-sm font-medium text-muted">G$</span></p>
            <p className="text-sm text-muted">of {fmtGD(d.dailyBudget)} G$</p>
          </div>
          <Progress className="mt-3" value={usedPct} tone={usedPct > 0.9 ? "coral" : "sage"} label="Share of today's budget paid out" />
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <CardHeader title="Contract" />
          <dl className="mt-4 grid gap-3 text-sm">
            <div><dt className="text-xs font-medium text-muted">Pool address</dt><dd className="mt-0.5 break-all font-mono text-xs text-ink">{addr}</dd></div>
            {d && <div><dt className="text-xs font-medium text-muted">Voucher signer</dt><dd className="mt-0.5 font-mono text-xs text-ink">{shortAddr(d.signer)}</dd></div>}
          </dl>
        </Card>
        {d && (
          <Card className="p-6">
            <CardHeader title={d.paused ? "Resume payouts" : "Pause payouts"} description="Only the guardian (the Safe) can do this." />
            <div className="mt-4">
              <SafeTx to={addr} data={encodeFunctionData({ abi: rewardsPoolAbi, functionName: d.paused ? "unpause" : "pause" })}
                note={`Send this from the Safe to ${d.paused ? "resume" : "pause"} reward payouts. Stakes are not affected.`} />
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
