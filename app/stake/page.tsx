"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { erc20Abi, parseUnits } from "viem";
import { CircleNotch, Check } from "@phosphor-icons/react";
import { useApi } from "@/lib/useApi";
import { useMe } from "@/lib/useMe";
import { streakVaultAbi } from "@/lib/abis";
import { ADDR } from "@/lib/chain";
import { fmtGD } from "@/lib/format";
import { TabBar } from "@/components/TabBar";
import { useAuthGate } from "@/components/useAuthGate";

type Cohort = { id: number; start: number; end: number; min: string; max: string; pot: string; settled: boolean; joinable: boolean; members: number; mine: { stake: string; finished: boolean; withdrawn: boolean; payout: string } | null; progress: { required: string[]; done: boolean[]; completed: number } | null };

const fmtDate = (s: number) => new Date(s * 1000).toLocaleDateString("en", { month: "short", day: "numeric" });

export default function Stake() {
  const ok = useAuthGate();
  const api = useApi();
  const qc = useQueryClient();
  const pc = usePublicClient();
  const { address } = useAccount();
  const { data: me } = useMe();
  const { writeContractAsync } = useWriteContract();
  const { data } = useQuery({ queryKey: ["cohorts"], queryFn: () => api<{ cohorts: Cohort[] }>("/api/cohorts/open"), enabled: ok });
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const c = data?.cohorts[0];
  const staked = c?.mine && BigInt(c.mine.stake) > 0n;

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label); setErr(null);
    try { await fn(); await qc.invalidateQueries({ queryKey: ["cohorts"] }); }
    catch (e) { setErr(e instanceof Error ? e.message.split("\n")[0] : "Transaction failed"); }
    finally { setBusy(null); }
  }

  const stake = () => run("stake", async () => {
    if (!c || !pc || !address || !ADDR.streakVault) throw new Error("Staking is not live yet.");
    const wei = parseUnits(amount || "0", 18);
    if (wei < BigInt(c.min) || wei > BigInt(c.max)) throw new Error(`Stake between ${fmtGD(c.min)} and ${fmtGD(c.max)} G$`);
    const allowance = await pc.readContract({ address: ADDR.gd, abi: erc20Abi, functionName: "allowance", args: [address, ADDR.streakVault] });
    if (allowance < wei) {
      const h = await writeContractAsync({ address: ADDR.gd, abi: erc20Abi, functionName: "approve", args: [ADDR.streakVault, wei] });
      await pc.waitForTransactionReceipt({ hash: h });
    }
    const h2 = await writeContractAsync({ address: ADDR.streakVault, abi: streakVaultAbi, functionName: "stake", args: [BigInt(c.id), wei] });
    await pc.waitForTransactionReceipt({ hash: h2 });
  });

  const withdraw = () => run("withdraw", async () => {
    if (!c || !pc || !ADDR.streakVault) return;
    const h = await writeContractAsync({ address: ADDR.streakVault, abi: streakVaultAbi, functionName: "withdraw", args: [BigInt(c.id)] });
    await pc.waitForTransactionReceipt({ hash: h });
  });

  return (
    <main className="mx-auto max-w-md px-4 pb-28 pt-6">
      <h1 className="text-3xl font-bold tracking-tighter">Stake</h1>
      <p className="mt-1 text-sm text-muted">Put G$ behind a 7-day streak. Keep your streak, keep your G$. Miss a day and your stake goes to the finishers.</p>
      {me && !me.verified && <p className="mt-4 rounded-card border border-ink p-4 text-sm">Only verified users can stake. Verify with GoodDollar on the home screen.</p>}
      {!data && <div className="mt-6 h-40 animate-pulse rounded-card bg-line" />}
      {data && !c && <p className="mt-6 text-sm text-muted">No open challenge right now. A new one starts every week.</p>}
      {c && (
        <section className="mt-6 rounded-card border border-ink p-5">
          <p className="text-sm text-muted">{fmtDate(c.start)} to {fmtDate(c.end)}</p>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div><p className="text-xs text-muted">Pot</p><p className="font-mono text-2xl font-semibold">{fmtGD(c.pot)}</p></div>
            <div><p className="text-xs text-muted">Members</p><p className="font-mono text-2xl font-semibold">{c.members}</p></div>
          </div>
          {staked && c.progress && (
            <div className="mt-5">
              <p className="text-sm font-medium">Your stake: {fmtGD(c.mine!.stake)} G$ &middot; {c.progress.completed} of 7 days</p>
              <ol className="mt-2 grid grid-cols-7 gap-1.5" aria-label="Daily progress">
                {c.progress.done.map((d, i) => <li key={i} className={`grid h-9 place-items-center rounded-input text-xs font-semibold ${d ? "bg-yellow text-[#111]" : "border border-line text-muted"}`}>{d ? <Check size={16} weight="bold" /> : i + 1}</li>)}
              </ol>
            </div>
          )}
          {!staked && c.joinable && (
            <div className="mt-5">
              <label htmlFor="amt" className="text-sm font-medium">Amount (G$)</label>
              <input id="amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`${fmtGD(c.min)} to ${fmtGD(c.max)}`}
                className="mt-2 w-full rounded-input border border-ink bg-transparent px-4 py-3 font-mono text-lg" />
              <p className="mt-1 text-xs text-muted">G$ transfers can take a small fee. Your stake is the amount the vault actually receives.</p>
              <button onClick={stake} disabled={!!busy || !me?.verified} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-yellow px-5 py-4 font-semibold text-[#111] disabled:opacity-50">
                {busy === "stake" && <CircleNotch className="animate-spin" size={18} />} Stake and join
              </button>
            </div>
          )}
          {staked && c.settled && c.mine!.finished && !c.mine!.withdrawn && (
            <button onClick={withdraw} disabled={!!busy} className="mt-5 w-full rounded-full bg-yellow px-5 py-4 font-semibold text-[#111] disabled:opacity-50">Withdraw {fmtGD(c.mine!.payout)} G$</button>
          )}
          {staked && c.settled && !c.mine!.finished && <p className="mt-5 text-sm">This challenge is settled. You missed a day, so the stake was forfeited.</p>}
          {staked && c.mine!.withdrawn && <p className="mt-5 text-sm">Withdrawn.</p>}
        </section>
      )}
      {err && <p role="alert" className="mt-3 text-sm font-medium">{err}</p>}
      <TabBar />
    </main>
  );
}
