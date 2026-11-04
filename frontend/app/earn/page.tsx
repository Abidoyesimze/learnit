"use client";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { Loading03Icon, PauseIcon } from "hugeicons-react";
import { useApi } from "@/lib/useApi";
import { friendlyError, STALE_ERRORS } from "@/lib/txErrors";
import { rewardsPoolAbi } from "@learnit/backend/abis";
import { ADDR } from "@learnit/backend/chain";
import { fmtGD } from "@learnit/backend/format";
import { TabBar } from "@/components/TabBar";
import { useAuthGate } from "@/components/useAuthGate";
import { EarnSkeleton } from "@/components/Skeletons";

type V = { id: string; root: `0x${string}`; amount: string; nonce: string; expiry: number; signature: `0x${string}`; reason: string };
type Data = { verified: boolean; vouchers: V[]; earnedToday: string; dailyCap: string; capRemaining: string };
type Step = null | "checking" | "wallet" | "confirming";

const REASON: Record<string, string> = { lesson: "Lesson passed", checkpoint: "Checkpoint passed", league: "League bonus" };
const STEP_LABEL: Record<Exclude<Step, null>, string> = { checking: "Checking...", wallet: "Confirm in your wallet", confirming: "Waiting for confirmation" };
const toArg = (v: V) => ({ root: v.root, amount: BigInt(v.amount), nonce: BigInt(v.nonce), expiry: BigInt(v.expiry) });

export default function Earn() {
  const ok = useAuthGate();
  const api = useApi();
  const qc = useQueryClient();
  const pc = usePublicClient();
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [step, setStep] = useState<Step>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tx, setTx] = useState<string | null>(null);
  const live = Boolean(ADDR.rewardsPool);
  const busy = step !== null;

  const { data } = useQuery({ queryKey: ["vouchers"], queryFn: () => api<Data>("/api/vouchers"), enabled: ok });

  // Is the pool paused? Checked before we offer a Claim button, so nobody hits a revert.
  const paused = useQuery({ queryKey: ["paused", "pool"], enabled: ok && live && !!pc, staleTime: 30_000,
    queryFn: () => pc!.readContract({ address: ADDR.rewardsPool, abi: rewardsPoolAbi, functionName: "paused" }) });

  // Has any voucher already been claimed (for example on another device)? The contract is the source of truth.
  const list = data?.vouchers ?? [];
  const used = useQuery({ queryKey: ["nonces", list.map((v) => v.id).join()], enabled: ok && live && !!pc && list.length > 0,
    queryFn: async () => {
      const res = await pc!.multicall({ allowFailure: true, contracts: list.map((v) => ({ address: ADDR.rewardsPool, abi: rewardsPoolAbi, functionName: "nonceUsed" as const, args: [v.root, BigInt(v.nonce)] as const })) });
      return Object.fromEntries(list.map((v, i) => [v.id, res[i].status === "success" && res[i].result === true])) as Record<string, boolean>;
    } });
  useEffect(() => { if (Object.values(used.data ?? {}).some(Boolean)) void qc.invalidateQueries({ queryKey: ["vouchers"] }); }, [used.data, qc]);

  if (!data) return <EarnSkeleton />;

  const now = Math.floor(Date.now() / 1000);
  const stateOf = (v: V): "ready" | "expired" | "claimed" => (v.expiry < now ? "expired" : used.data?.[v.id] ? "claimed" : "ready");
  const ready = list.filter((v) => stateOf(v) === "ready");
  const isPaused = paused.data === true;
  const total = ready.reduce((s, v) => s + BigInt(v.amount), 0n);

  async function claim(batch: V[]) {
    if (!pc || !address || !live) return setErr("Rewards are not live yet.");
    setErr(null); setTx(null); setStep("checking");
    try {
      const call = batch.length === 1
        ? { functionName: "claim", args: [toArg(batch[0]), batch[0].signature] }
        : { functionName: "claimBatch", args: [batch.map(toArg), batch.map((v) => v.signature)] };
      // Simulate first: a revert becomes a clear message instead of a failed, fee-costing transaction.
      const { request } = await pc.simulateContract({ account: address, address: ADDR.rewardsPool, abi: rewardsPoolAbi, ...call } as never);
      setStep("wallet");
      const hash = await writeContractAsync(request as never);
      setTx(hash); setStep("confirming");
      const receipt = await pc.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("The transaction failed on the network.");
      await qc.invalidateQueries({ queryKey: ["vouchers"] });
    } catch (e) {
      const msg = friendlyError(e);
      setErr(msg);
      if (STALE_ERRORS.test(msg)) await qc.invalidateQueries({ queryKey: ["vouchers"] });
    } finally { setStep(null); }
  }

  return (
    <main className="mx-auto max-w-md px-4 pb-28 pt-6">
      <h1 className="text-3xl font-bold tracking-tighter">Earn</h1>
      <section className="mt-4 rounded-card border border-line p-5">
        <p className="text-sm text-muted">Earned today</p>
        <p className="font-mono text-4xl font-semibold tracking-tight">{fmtGD(data.earnedToday)} <span className="text-base text-muted">G$</span></p>
        <p className="mt-1 text-sm text-muted">{fmtGD(data.capRemaining)} G$ left under today&apos;s cap</p>
      </section>

      {!data.verified && <p className="mt-4 rounded-card border border-ink p-4 text-sm">Verify with GoodDollar on the home screen to earn.</p>}
      {!live && <p className="mt-4 rounded-card border border-line p-4 text-sm text-muted">Rewards are not live yet.</p>}
      {isPaused && (
        <p role="status" className="mt-4 flex items-center gap-2 rounded-card border border-ink p-4 text-sm font-medium"><PauseIcon size={18} strokeWidth={1.75} /> Rewards are paused right now. Your rewards are safe and will be here when they resume.</p>
      )}

      <h2 className="mt-8 text-lg font-bold">Ready to claim</h2>
      {data.verified && list.length === 0 && <p className="mt-2 text-sm text-muted">Pass a lesson to earn G$. Rewards show up here.</p>}
      <ul className="mt-3 grid gap-3">
        {list.map((v) => {
          const st = stateOf(v);
          return (
            <li key={v.id} className="flex items-center justify-between gap-3 rounded-card border border-line p-4">
              <div>
                <p className="font-mono text-lg font-semibold">{fmtGD(v.amount)} G$</p>
                <p className="text-sm text-muted">{REASON[v.reason] ?? "Reward"}</p>
              </div>
              {st === "ready" && !isPaused && <button disabled={busy || !live} onClick={() => claim([v])} className="rounded-full bg-yellow px-5 py-2 font-semibold text-[#111] transition active:scale-[0.98] disabled:opacity-50">Claim</button>}
              {st === "ready" && isPaused && <span className="text-sm text-muted">Paused</span>}
              {st === "expired" && <span className="text-sm font-medium text-muted">Expired</span>}
              {st === "claimed" && <span className="text-sm font-medium text-muted">Already claimed</span>}
            </li>
          );
        })}
      </ul>

      {ready.length > 1 && !isPaused && (
        <button disabled={busy || !live} onClick={() => claim(ready)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-ink px-5 py-4 font-semibold text-paper transition active:scale-[0.98] disabled:opacity-50">
          {busy && <Loading03Icon className="animate-spin" size={18} strokeWidth={1.75} />}
          {busy ? STEP_LABEL[step!] : `Claim all (${fmtGD(total)} G$)`}
        </button>
      )}
      {busy && ready.length <= 1 && <p role="status" className="mt-3 flex items-center gap-2 text-sm"><Loading03Icon className="animate-spin" size={16} strokeWidth={1.75} /> {STEP_LABEL[step!]}</p>}
      {tx && <p className="mt-3 break-all text-xs text-muted">Transaction <a className="font-mono underline" href={`https://celoscan.io/tx/${tx}`} target="_blank" rel="noreferrer">{tx.slice(0, 12)}...{tx.slice(-6)}</a></p>}
      {err && <p role="alert" className="mt-3 text-sm font-medium">{err}</p>}
      <TabBar />
    </main>
  );
}
