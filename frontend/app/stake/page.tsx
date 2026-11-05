"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { erc20Abi, parseUnits } from "viem";
import { CalendarDays, Check, ExternalLink, Flame, Lock, ShieldCheck, Trophy, Users, PiggyBank } from "lucide-react";
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

const fmtDate = (s: number) => new Date(s * 1000).toLocaleDateString("en", { month: "short", day: "numeric" });
const STEP_LABEL: Record<Exclude<Step, null>, string> = {
  checking: "Checking...",
  approve: "Step 1 of 2: approve G$ in your wallet",
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
    : !me?.verified ? "Only GoodDollar-verified users can stake. Verify on the home screen first."
    : expiresBeforeEnd ? `Your verification expires on ${new Date(verifiedUntilSec! * 1000).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}, before this challenge ends. Renew it with GoodDollar, then join.`
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
      if (r.status !== "success") throw new Error("The approval failed on the network.");
    }
    setStep("checking");
    const { request } = await pc.simulateContract({ account: address, address: ADDR.streakVault, abi: streakVaultAbi, functionName: "stake", args: [BigInt(c.id), wei] });
    setStep("stake");
    const h2 = await writeContractAsync(request);
    const r2 = await pc.waitForTransactionReceipt({ hash: h2 });
    if (r2.status !== "success") throw new Error("The stake failed on the network.");
    setAmount("");
  });

  const withdraw = () => run(async () => {
    if (!c || !pc || !address) return;
    setStep("checking");
    const { request } = await pc.simulateContract({ account: address, address: ADDR.streakVault, abi: streakVaultAbi, functionName: "withdraw", args: [BigInt(c.id)] });
    setStep("withdraw");
    const h = await writeContractAsync(request);
    const r = await pc.waitForTransactionReceipt({ hash: h });
    if (r.status !== "success") throw new Error("The withdrawal failed on the network.");
  });

  const ended = !!c && c.end * 1000 < Date.now();
  const status = !c ? null : c.settled ? { label: "Settled", tone: "neutral" as const } : ended ? { label: "Settling", tone: "outline" as const } : c.joinable ? { label: "Open to join", tone: "sage" as const } : { label: "In progress", tone: "coral" as const };
  const days = c ? Math.round((c.end - c.start) / 86400) : 7;

  return (
    <AppShell>
      <PageHeader eyebrow="Staking & Rewards" title="Streak stake" description="Put G$ behind a 7-day streak. Keep your streak and take your stake back, plus a share of what others forfeit. Miss a day and your stake goes to the finishers." action={<RewardsTabs />} />

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

              <dl className="grid grid-cols-2 divide-line border-b border-line sm:grid-cols-4 sm:divide-x">
                {[
                  { Icon: PiggyBank, k: "Total staked", v: <><span className="tabular">{fmtGD(c.pot)}</span> <span className="text-sm font-medium text-muted">G$</span></> },
                  { Icon: Users, k: "Members", v: <span className="tabular">{c.members}</span> },
                  { Icon: Lock, k: "Lock period", v: <>{days} <span className="text-sm font-medium text-muted">days</span></> },
                  { Icon: Trophy, k: "Stake range", v: <span className="tabular text-lg">{fmtGD(c.min, 0)}–{fmtGD(c.max, 0)}</span> },
                ].map(({ Icon, k, v }) => (
                  <div key={k} className="px-6 py-5">
                    <dt className="flex items-center gap-1.5 text-[13px] font-medium text-muted"><Icon size={14} aria-hidden />{k}</dt>
                    <dd className="mt-1.5 text-2xl font-semibold tracking-[-0.02em] text-ink">{v}</dd>
                  </div>
                ))}
              </dl>

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
                            {d ? <Check size={18} strokeWidth={3} aria-label={`Day ${i + 1} done`} /> : <span aria-label={`Day ${i + 1} not done yet`}>{i + 1}</span>}
                          </span>
                          <span className="text-[11px] text-muted">Day {i + 1}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Not staked yet. */}
                {!staked && !c.joinable && <Notice tone="info" title="Joining has closed for this challenge">The next one opens soon. Keep your streak going so you're ready.</Notice>}
                {!staked && c.joinable && !isPaused && (
                  <div>
                    {blocker && <Notice tone="warning" className="mb-5">{blocker}</Notice>}
                    <Label htmlFor="amt">Amount to stake</Label>
                    <div className="relative mt-2">
                      <input id="amt" inputMode="decimal" autoComplete="off" value={amount} onChange={(e) => { setAmount(e.target.value); setErr(null); }} placeholder={`${fmtGD(c.min)} to ${fmtGD(c.max)}`} aria-invalid={outOfBounds} aria-describedby="amt-help"
                        disabled={!!blocker} className={cn(fieldClass, "tabular h-14 pr-16 text-xl font-semibold")} />
                      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted">G$</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {[c.min, c.max].map((w, i) => (
                        <button key={i} type="button" disabled={!!blocker} onClick={() => { /* min rounds up, max rounds down, so the preset is always in range */ setAmount(String(Number(i === 0 ? (BigInt(w) + 10n ** 16n - 1n) / 10n ** 16n : BigInt(w) / 10n ** 16n) / 100)); setErr(null); }}
                          className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink-2 transition hover:border-ink/30 disabled:opacity-50">
                          {i === 0 ? "Min" : "Max"} · <span className="tabular">{fmtGD(w)}</span>
                        </button>
                      ))}
                    </div>
                    <p id="amt-help" className={cn("mt-3 min-h-5 text-xs", outOfBounds ? "font-medium text-danger" : "text-muted")}>
                      {outOfBounds ? `Stake between ${fmtGD(c.min)} and ${fmtGD(c.max)} G$.` : "G$ transfers can take a small fee. Your stake is the amount the vault actually receives."}
                    </p>
                    <Button onClick={stake} loading={busy} disabled={!!blocker || wei === null || outOfBounds} size="lg" block className="mt-5">
                      {busy ? STEP_LABEL[step!] : "Stake and join challenge"}
                    </Button>
                    <p className="mt-3 text-center text-xs text-muted">You&apos;ll confirm up to two steps in your wallet: approve, then stake.</p>
                  </div>
                )}

                {/* After settlement. */}
                {staked && c.settled && c.mine!.finished && !c.mine!.withdrawn && (
                  <div className="mt-6 rounded-card bg-sage-50 p-5 ring-1 ring-inset ring-sage-100">
                    <p className="font-semibold text-sage-700">You finished all 7 days</p>
                    <p className="mt-1 text-sm text-ink-2">Your payout, including your share of forfeited stakes, is ready.</p>
                    <Button onClick={withdraw} loading={busy} size="lg" block className="mt-4">{busy ? STEP_LABEL[step!] : `Withdraw ${fmtGD(c.mine!.payout)} G$`}</Button>
                  </div>
                )}
                {staked && c.settled && !c.mine!.finished && <Notice tone="warning" className="mt-6" title="Stake forfeited">This challenge is settled. A day was missed, so the stake went to the finishers. You can join the next one.</Notice>}
                {staked && c.mine!.withdrawn && <Notice tone="success" className="mt-6" title="Withdrawn">Your payout is in your wallet.</Notice>}
                {staked && !c.settled && ended && <Notice tone="info" className="mt-6">The challenge has ended. Results are being settled.</Notice>}
              </div>
            </Card>
          )}
          {err && <Notice tone="danger">{err}</Notice>}
        </div>

        <aside className="grid content-start gap-6">
          <Card className="p-6">
            <h2 className="text-[15px] font-semibold text-ink">How it works</h2>
            <ol className="mt-5 grid gap-5">
              {[
                { Icon: PiggyBank, t: "Stake G$", b: c ? `Choose an amount between ${fmtGD(c.min, 0)} and ${fmtGD(c.max, 0)} G$ while the challenge is open.` : "Choose an amount while a challenge is open." },
                { Icon: Flame, t: "Learn every day", b: "Pass at least one lesson on each of the 7 days, in your own timezone." },
                { Icon: Trophy, t: "Withdraw", b: "Finish and take back your stake plus a share of stakes forfeited by others." },
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
          </Card>
          <Card className="p-6">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink"><ShieldCheck size={17} className="text-sage-600" aria-hidden /> Good to know</h2>
            <ul className="mt-4 grid gap-3 text-pretty text-sm leading-relaxed text-ink-2">
              <li>There&apos;s no fixed APY. What you gain depends on how many members miss a day.</li>
              <li>Stakes are held by the StreakVault contract, not by LearnIt.</li>
              <li>The contract can be paused if anything looks wrong. Paused stakes stay safe.</li>
            </ul>
            {live && (
              <a href={`https://celoscan.io/address/${ADDR.streakVault}`} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-ink underline-offset-4 hover:underline">
                View the contract <ExternalLink size={13} aria-hidden />
              </a>
            )}
          </Card>
        </aside>
      </div>
    </AppShell>
  );
}
