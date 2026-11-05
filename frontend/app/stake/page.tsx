"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { erc20Abi, formatUnits, parseUnits } from "viem";
import { CalendarDays, Check, Flame, Lock, Trophy, Users, PiggyBank } from "lucide-react";
import { useApi } from "@/lib/useApi";
import { useMe } from "@/lib/useMe";
import { friendlyError } from "@/lib/txErrors";
import { streakVaultAbi } from "@learnit/backend/abis";
import { ADDR } from "@learnit/backend/chain";
import { fmtGD } from "@learnit/backend/format";
import { AppShell } from "@/components/AppShell";
import { RewardsTabs } from "@/components/RewardsTabs";
import { Badge, Button, Card, EmptyState, GMark, Label, Notice, PageHeader, Progress, fieldClass } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useAuthGate } from "@/components/useAuthGate";
import { StakeSkeleton } from "@/components/Skeletons";

type Cohort = {
  id: number; start: number; end: number; min: string; max: string; pot: string; settled: boolean; joinable: boolean; members: number;
  mine: { stake: string; finished: boolean; withdrawn: boolean; payout: string } | null;
  progress: { required: string[]; done: boolean[]; completed: number } | null;
};
type Step = null | "checking" | "approve" | "stake" | "withdraw";

const fmtDate = (s: number) => new Date(s * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const STEP_LABEL: Record<Exclude<Step, null>, string> = {
  checking: "Checking…",
  approve: "Step 1 of 2: allow G$ in your wallet",
  stake: "Step 2 of 2: confirm the stake in your wallet",
  withdraw: "Confirm the withdrawal in your wallet",
};

function parseAmount(v: string): bigint | null {
  if (!/^\d*\.?\d*$/.test(v.trim()) || v.trim() === "" || v.trim() === ".") return null;
  try { return parseUnits(v.trim(), 18); } catch { return null; }
}

export default function Stake() {
  const ok = useAuthGate();
  const api = useApi();
  const qc = useQueryClient();
  const pc = usePublicClient();
  const { address } = useAccount();
  const { data: me } = useMe();
  const { writeContractAsync } = useWriteContract();
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<Step>(null);
  const [err, setErr] = useState<string | null>(null);
  const live = Boolean(ADDR.streakVault);
  const busy = step !== null;

  const { data } = useQuery({ queryKey: ["cohorts"], queryFn: () => api<{ cohorts: Cohort[] }>("/api/cohorts/open"), enabled: ok });
  // Checked before the stake form is shown, so nobody hits a revert.
  const paused = useQuery({ queryKey: ["paused", "vault"], enabled: ok && live && !!pc, staleTime: 30_000,
    queryFn: () => pc!.readContract({ address: ADDR.streakVault, abi: streakVaultAbi, functionName: "paused" }) });

  if (!data) return <StakeSkeleton />;

  const c = data.cohorts[0];
  const staked = !!c?.mine && BigInt(c.mine.stake) > 0n;
  const isPaused = paused.data === true;

  // Why the form cannot be used, in the order a person would fix them.
  const verifiedUntilSec = me?.verifiedUntil ? Date.parse(me.verifiedUntil) / 1000 : null;
  const expiresBeforeEnd = !!c && verifiedUntilSec !== null && verifiedUntilSec < c.end;
  const wei = parseAmount(amount);
  const outOfBounds = !!c && wei !== null && (wei < BigInt(c.min) || wei > BigInt(c.max));
  const blocker =
    !live ? "Staking is not live yet."
    : !me?.verified ? "Staking needs a GoodDollar face check. Verify on the home screen, then come back."
    : expiresBeforeEnd ? `Your verification expires on ${new Date(verifiedUntilSec! * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}, before this challenge ends. Renew it with GoodDollar, then join.`
    : null;

  async function run(fn: () => Promise<void>) {
    setErr(null);
    try { await fn(); await qc.invalidateQueries({ queryKey: ["cohorts"] }); }
    catch (e) { setErr(friendlyError(e)); await qc.invalidateQueries({ queryKey: ["cohorts"] }); }
    finally { setStep(null); }
  }

  const stake = () => run(async () => {
    if (!c || !pc || !address) throw new Error("Connect your wallet first.");
    if (blocker) throw new Error(blocker);
    if (wei === null) throw new Error("Enter an amount in G$.");
    if (outOfBounds) throw new Error(`Stake between ${fmtGD(c.min)} and ${fmtGD(c.max)} G$.`);
    setStep("checking");
    // Approve only when the current allowance is too small. Two prompts, two receipts.
    const allowance = await pc.readContract({ address: ADDR.gd, abi: erc20Abi, functionName: "allowance", args: [address, ADDR.streakVault] });
    if (allowance < wei) {
      setStep("approve");
      const h = await writeContractAsync({ address: ADDR.gd, abi: erc20Abi, functionName: "approve", args: [ADDR.streakVault, wei] });
      const r = await pc.waitForTransactionReceipt({ hash: h });
      if (r.status !== "success") throw new Error("The approval didn't go through. Nothing was staked.");
    }
    setStep("checking");
    const { request } = await pc.simulateContract({ account: address, address: ADDR.streakVault, abi: streakVaultAbi, functionName: "stake", args: [BigInt(c.id), wei] });
    setStep("stake");
    const h2 = await writeContractAsync(request);
    const r2 = await pc.waitForTransactionReceipt({ hash: h2 });
    if (r2.status !== "success") throw new Error("The stake didn't go through. Your G$ stayed in your wallet.");
    setAmount("");
  });

  const withdraw = () => run(async () => {
    if (!c || !pc || !address) return;
    setStep("checking");
    const { request } = await pc.simulateContract({ account: address, address: ADDR.streakVault, abi: streakVaultAbi, functionName: "withdraw", args: [BigInt(c.id)] });
    setStep("withdraw");
    const h = await writeContractAsync(request);
    const r = await pc.waitForTransactionReceipt({ hash: h });
    if (r.status !== "success") throw new Error("The withdrawal didn't go through. Your payout is still waiting for you.");
  });

  const ended = !!c && c.end * 1000 < Date.now();
  const status = !c ? null : c.settled ? { label: "Closed", tone: "neutral" as const } : ended ? { label: "Results pending", tone: "outline" as const } : c.joinable ? { label: "Open to join", tone: "sage" as const } : { label: "Running", tone: "coral" as const };
  const days = c ? Math.round((c.end - c.start) / 86400) : 7;

  const formShown = !staked && !!c?.joinable && !isPaused;
  const amt = wei !== null && !outOfBounds ? Number(formatUnits(wei, 18)).toLocaleString("en", { maximumFractionDigits: 4 }) : null;
  const stats = (cls: string) => c ? (
      <dl className={`grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x ${cls}`}>
        {[
          { Icon: PiggyBank, k: "Total staked", v: <><span className="tabular">{fmtGD(c.pot)}</span> <span className="text-sm font-medium text-muted">G$</span></> },
          { Icon: Users, k: "People in", v: <span className="tabular">{c.members}</span> },
          { Icon: Lock, k: "Length", v: <>{days} <span className="text-sm font-medium text-muted">days</span></> },
          { Icon: Trophy, k: "Stake limits", v: <span className="tabular text-lg">{fmtGD(c.min, 0)}–{fmtGD(c.max, 0)}</span> },
        ].map(({ Icon, k, v }) => (
          <div key={k} className="px-4 py-3.5 sm:px-6 sm:py-5">
            <dt className="flex items-center gap-1.5 text-[13px] font-medium text-muted"><Icon size={14} aria-hidden />{k}</dt>
            <dd className="mt-1.5 text-xl font-semibold sm:text-2xl tracking-[-0.02em] text-ink">{v}</dd>
          </div>
        ))}
      </dl>
  ) : null;
  const howItWorks = (
    <>
      <h2 className="text-[15px] font-semibold text-ink">How it works</h2>
      <ol className="mt-5 grid gap-5">
        {[
          { Icon: PiggyBank, t: "Put G$ behind it", b: c ? `Choose an amount between ${fmtGD(c.min, 0)} and ${fmtGD(c.max, 0)} G$ while the challenge is open.` : "Choose an amount while a challenge is open." },
          { Icon: Flame, t: "Show up for 7 days", b: "Pass at least one lesson on each of the 7 days, in your own timezone." },
          { Icon: Trophy, t: "Get it back", b: "Finish all 7 days and withdraw your stake." },
        ].map(({ Icon, t, b }, i) => (
          <li key={t} className="flex gap-4">
            <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sunken text-ink-2">
              <Icon size={16} aria-hidden />
              {i < 2 && <span aria-hidden className="absolute left-1/2 top-full h-5 w-px -translate-x-1/2 bg-line-strong" />}
            </span>
            <span><span className="block text-sm font-semibold text-ink">{t}</span><span className="mt-0.5 block text-pretty text-sm leading-relaxed text-muted">{b}</span></span>
          </li>
        ))}
      </ol>
      <p className="mt-6 border-t border-line pt-4 text-sm leading-relaxed text-muted">If you miss a day, your stake is shared with the people who finished.</p>
    </>
  );

  return (
    <AppShell>
      <PageHeader eyebrow="Staking & Rewards" title="Stay committed" description="Commit to 7 days in a row and put G$ behind it. Learn every day and you get your stake back. Miss a day and it is shared with the people who finished." action={<RewardsTabs />} />

      {isPaused && <Notice tone="paused" className="mt-6" title="Staking is paused">Your stake is safe. Joining and withdrawing will resume shortly.</Notice>}

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8">
        <div className="grid content-start gap-6">
          {!c && <EmptyState icon={CalendarDays} title="No open challenge right now">A new 7-day challenge opens every week. Check back soon, and keep your streak going in the meantime.</EmptyState>}

          {c && (
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-5">
                <div>
                  <p className="text-[15px] font-semibold text-ink">This week&apos;s challenge</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted"><CalendarDays size={14} aria-hidden />{fmtDate(c.start)} to {fmtDate(c.end)}</p>
                </div>
                {status && <Badge tone={status.tone} className="px-3 py-1">{status.label}</Badge>}
              </div>

              {!staked && stats("border-b border-line")}

              <div className="p-6">
                {/* Already staked: progress comes from the server's streak days, no contract read needed. */}
                {staked && c.progress && (
                  <div>
                    <div className="flex flex-wrap items-end justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-muted">Your stake</p>
                        <p className="tabular mt-1 flex items-center gap-2 text-[2rem] font-semibold leading-none tracking-[-0.03em] text-ink"><GMark size={26} />{fmtGD(c.mine!.stake)}</p>
                      </div>
                      <p className="text-sm text-muted"><span className="tabular font-semibold text-ink">{c.progress.completed}</span> of 7 days complete</p>
                    </div>
                    <Progress className="mt-5" value={c.progress.completed / 7} label="Challenge progress" />
                    <ol className="mt-5 grid grid-cols-7 gap-2" aria-label="Daily progress">
                      {c.progress.done.map((d, i) => (
                        <li key={i} className="flex flex-col items-center gap-1.5">
                          <span className={cn("grid aspect-square w-full max-w-[52px] place-items-center rounded-input text-sm font-semibold transition",
                            d ? "bg-sage-600 text-white" : "border border-dashed border-line-strong bg-canvas text-muted")}>
                            {d ? <Check size={18} strokeWidth={3} role="img" aria-label={`Day ${i + 1} done`} /> : <span role="img" aria-label={`Day ${i + 1} not done yet`}>{i + 1}</span>}
                          </span>
                          <span className="text-[11px] text-muted">Day {i + 1}</span>
                        </li>
                      ))}
                    </ol>
                    {(() => {
                      if (c.settled || ended) return null;
                      const i = c.progress.required.indexOf(new Date().toLocaleDateString("en-CA"));
                      if (i < 0) return null;
                      return <p className="mt-4 text-sm text-ink-2">{c.progress.done[i] ? "Today is done. See you tomorrow." : "Pass one lesson today to keep this going."}</p>;
                    })()}
                  </div>
                )}

                {/* Not staked yet. */}
                {!staked && !c.joinable && <Notice tone="info" title="Joining has closed for this challenge">The next one opens soon. Keep your streak going so you're ready.</Notice>}
                {formShown && (
                  <form onSubmit={(e) => { e.preventDefault(); if (!busy) void stake(); }} noValidate>
                    <div className="mb-5 rounded-input bg-sunken p-4 lg:hidden">{howItWorks}</div>
                    {blocker && <Notice tone="warning" className="mb-5">{blocker}</Notice>}
                    <Label htmlFor="amt">Amount to stake</Label>
                    <div className="relative mt-2">
                      <input id="amt" inputMode="decimal" autoComplete="off" value={amount} onChange={(e) => { setAmount(e.target.value); setErr(null); }} placeholder={`e.g. ${fmtGD(c.min, 0)}`} spellCheck={false} aria-invalid={outOfBounds} aria-describedby="amt-help"
                        disabled={!!blocker} className={cn(fieldClass, "tabular h-14 pr-16 text-xl font-semibold")} />
                      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted">G$</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {[c.min, c.max].map((w, i) => (
                        <button key={i} type="button" disabled={!!blocker} onClick={() => { /* min rounds up, max rounds down, so the preset is always in range */ setAmount(String(Number(i === 0 ? (BigInt(w) + 10n ** 16n - 1n) / 10n ** 16n : BigInt(w) / 10n ** 16n) / 100)); setErr(null); }}
                          className="inline-flex h-11 items-center rounded-full border border-line bg-surface px-4 text-sm font-medium text-ink-2 transition hover:border-ink/30 disabled:opacity-50">
                          {i === 0 ? "Min" : "Max"} · <span className="tabular">{fmtGD(w)}</span>
                        </button>
                      ))}
                    </div>
                    <p id="amt-help" className={cn("mt-3 min-h-5 text-xs", outOfBounds ? "font-medium text-danger" : "text-muted")}>
                      {`Stake between ${fmtGD(c.min)} and ${fmtGD(c.max)} G$. A small transfer fee may apply, and your stake is the amount that arrives.`}
                    </p>
                    {amt ? (
                      <dl className="mt-5 grid gap-px overflow-hidden rounded-input border border-line bg-line text-sm sm:grid-cols-2">
                        <div className="bg-sage-50 px-4 py-3"><dt className="text-xs font-medium text-sage-700">If you finish all 7 days</dt><dd className="tabular mt-0.5 font-semibold text-ink">{amt} G$ back</dd></div>
                        <div className="bg-coral-50 px-4 py-3"><dt className="text-xs font-medium text-coral-700">If you miss a day</dt><dd className="mt-0.5 font-semibold text-ink">You lose the stake</dd></div>
                      </dl>
                    ) : (
                      <p className="mt-5 rounded-input bg-sunken px-4 py-3 text-sm leading-relaxed text-ink-2">Pass a lesson on all 7 days to get your stake back. Miss one and you lose it.</p>
                    )}
                    <Button type="submit" loading={busy} disabled={!!blocker || wei === null || outOfBounds} size="lg" block className="mt-4">
                      {busy ? STEP_LABEL[step!] : amt ? `Stake ${amt} G$` : "Stake G$"}
                    </Button>
                    <p className="mt-3 text-center text-xs text-muted">First you allow LearnIt to use your G$, then you confirm the stake. Your wallet asks twice.</p>
                    {err && <Notice tone="danger" className="mt-4">{err}</Notice>}
                  </form>
                )}

                {/* After settlement. */}
                {staked && c.settled && c.mine!.finished && !c.mine!.withdrawn && (
                  <div className="mt-6 rounded-card bg-sage-50 p-5 ring-1 ring-inset ring-sage-100">
                    <p className="font-semibold text-sage-700">You kept your word: 7 days out of 7</p>
                    <p className="mt-1 text-sm text-ink-2">Your stake is ready to withdraw, including your share of the stakes from people who missed a day.</p>
                    <Button onClick={withdraw} loading={busy} size="lg" block className="mt-4">{busy ? STEP_LABEL[step!] : `Withdraw ${fmtGD(c.mine!.payout)} G$`}</Button>
                  </div>
                )}
                {staked && c.settled && !c.mine!.finished && <Notice tone="warning" className="mt-6" title="Challenge closed">A day was missed, so your stake went to the people who finished. You can commit again when the next challenge opens.</Notice>}
                {staked && c.mine!.withdrawn && <Notice tone="success" className="mt-6" title="Withdrawn">Your payout is in your wallet.</Notice>}
                {staked && !c.settled && ended && <Notice tone="info" className="mt-6">The challenge has ended. We are confirming who finished.</Notice>}
              </div>
              {staked && stats("border-t border-line")}
            </Card>
          )}
          {err && !formShown && <Notice tone="danger">{err}</Notice>}
        </div>

        <aside className="hidden content-start gap-6 lg:grid">
          <Card className="p-6">{howItWorks}</Card>
        </aside>
      </div>
    </AppShell>
  );
}
