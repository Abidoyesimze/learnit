"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { erc20Abi, parseUnits } from "viem";
import { Loading03Icon, Tick02Icon, PauseIcon } from "hugeicons-react";
import { useApi } from "@/lib/useApi";
import { useMe } from "@/lib/useMe";
import { friendlyError } from "@/lib/txErrors";
import { streakVaultAbi } from "@learnit/backend/abis";
import { ADDR } from "@learnit/backend/chain";
import { fmtGD } from "@learnit/backend/format";
import { TabBar } from "@/components/TabBar";
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

  return (
    <main className="mx-auto max-w-md px-4 pb-28 pt-6">
      <h1 className="text-3xl font-bold tracking-tighter">Stake</h1>
      <p className="mt-1 text-sm text-muted">Put G$ behind a 7-day streak. Keep your streak, keep your G$. Miss a day and your stake goes to the finishers.</p>

      {isPaused && <p role="status" className="mt-4 flex items-center gap-2 rounded-card border border-ink p-4 text-sm font-medium"><PauseIcon size={18} strokeWidth={1.75} /> Staking is paused right now. Your stake is safe.</p>}
      {!c && <p className="mt-6 text-sm text-muted">No open challenge right now. A new one starts every week.</p>}

      {c && (
        <section className="mt-6 rounded-card border border-ink p-5">
          <p className="text-sm text-muted">{fmtDate(c.start)} to {fmtDate(c.end)}</p>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div><p className="text-xs text-muted">Pot</p><p className="font-mono text-2xl font-semibold">{fmtGD(c.pot)}</p></div>
            <div><p className="text-xs text-muted">Members</p><p className="font-mono text-2xl font-semibold">{c.members}</p></div>
          </div>

          {/* Already staked: progress comes from the server's streak days, no contract read needed. */}
          {staked && c.progress && (
            <div className="mt-5">
              <p className="text-sm font-medium">Your stake: {fmtGD(c.mine!.stake)} G$ &middot; {c.progress.completed} of 7 days</p>
              <ol className="mt-2 grid grid-cols-7 gap-1.5" aria-label="Daily progress">
                {c.progress.done.map((d, i) => <li key={i} className={`grid h-9 place-items-center rounded-input text-xs font-semibold ${d ? "bg-yellow text-[#111]" : "border border-line text-muted"}`}>{d ? <Tick02Icon size={16} strokeWidth={2} /> : i + 1}</li>)}
              </ol>
            </div>
          )}

          {/* Not staked yet. */}
          {!staked && !c.joinable && <p className="mt-5 text-sm">The join window for this challenge has closed. The next one opens soon.</p>}
          {!staked && c.joinable && !isPaused && (
            <div className="mt-5">
              {blocker && <p role="alert" className="mb-4 rounded-input border border-line p-3 text-sm">{blocker}</p>}
              <label htmlFor="amt" className="text-sm font-medium">Amount (G$)</label>
              <input id="amt" inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); setErr(null); }} placeholder={`${fmtGD(c.min)} to ${fmtGD(c.max)}`} aria-invalid={outOfBounds}
                disabled={!!blocker} className="mt-2 w-full rounded-input border border-ink bg-transparent px-4 py-3 font-mono text-lg disabled:opacity-50" />
              <p className="mt-1 min-h-5 text-xs text-muted">{outOfBounds ? <span className="font-medium text-ink">Stake between {fmtGD(c.min)} and {fmtGD(c.max)} G$.</span> : "G$ transfers can take a small fee. Your stake is the amount the vault actually receives."}</p>
              <button onClick={stake} disabled={busy || !!blocker || wei === null || outOfBounds} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-yellow px-5 py-4 font-semibold text-[#111] transition active:scale-[0.98] disabled:opacity-40">
                {busy && <Loading03Icon className="animate-spin" size={18} strokeWidth={1.75} />}
                {busy ? STEP_LABEL[step!] : "Stake and join"}
              </button>
            </div>
          )}

          {/* After settlement. */}
          {staked && c.settled && c.mine!.finished && !c.mine!.withdrawn && (
            <button onClick={withdraw} disabled={busy} className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-yellow px-5 py-4 font-semibold text-[#111] transition active:scale-[0.98] disabled:opacity-50">
              {busy && <Loading03Icon className="animate-spin" size={18} strokeWidth={1.75} />}
              {busy ? STEP_LABEL[step!] : `Withdraw ${fmtGD(c.mine!.payout)} G$`}
            </button>
          )}
          {staked && c.settled && !c.mine!.finished && <p className="mt-5 text-sm">This challenge is settled. You missed a day, so the stake was forfeited.</p>}
          {staked && c.mine!.withdrawn && <p className="mt-5 text-sm">Withdrawn.</p>}
          {staked && !c.settled && c.end * 1000 < Date.now() && <p className="mt-5 text-sm text-muted">The challenge has ended. Results are being settled.</p>}
        </section>
      )}
      {err && <p role="alert" className="mt-3 text-sm font-medium">{err}</p>}
      <TabBar />
    </main>
  );
}
