"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWriteContract, usePublicClient } from "wagmi";
import { Loading03Icon } from "hugeicons-react";
import { useApi } from "@/lib/useApi";
import { rewardsPoolAbi } from "@learnit/backend/abis";
import { ADDR } from "@learnit/backend/chain";
import { fmtGD } from "@learnit/backend/format";
import { TabBar } from "@/components/TabBar";
import { useAuthGate } from "@/components/useAuthGate";
import { EarnSkeleton } from "@/components/Skeletons";

type V = { id: string; root: `0x${string}`; amount: string; nonce: string; expiry: number; signature: `0x${string}`; reason: string };
type Data = { verified: boolean; vouchers: V[]; earnedToday: string; dailyCap: string; capRemaining: string };

const toArg = (v: V) => ({ root: v.root, amount: BigInt(v.amount), nonce: BigInt(v.nonce), expiry: BigInt(v.expiry) });

export default function Earn() {
  const ok = useAuthGate();
  const api = useApi();
  const qc = useQueryClient();
  const pc = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tx, setTx] = useState<string | null>(null);
  const { data } = useQuery({ queryKey: ["vouchers"], queryFn: () => api<Data>("/api/vouchers"), enabled: ok });

  async function claim(list: V[]) {
    if (!pc || !ADDR.rewardsPool) return setErr("Rewards are not live yet.");
    setBusy(true); setErr(null);
    try {
      const hash = list.length === 1
        ? await writeContractAsync({ address: ADDR.rewardsPool, abi: rewardsPoolAbi, functionName: "claim", args: [toArg(list[0]), list[0].signature] })
        : await writeContractAsync({ address: ADDR.rewardsPool, abi: rewardsPoolAbi, functionName: "claimBatch", args: [list.map(toArg), list.map((v) => v.signature)] });
      setTx(hash);
      await pc.waitForTransactionReceipt({ hash });
      await qc.invalidateQueries({ queryKey: ["vouchers"] });
    } catch (e) { setErr(e instanceof Error ? e.message.split("\n")[0] : "Claim failed"); } finally { setBusy(false); }
  }

  if (!data) return <EarnSkeleton />;
  const total = data?.vouchers.reduce((s, v) => s + BigInt(v.amount), 0n) ?? 0n;
  return (
    <main className="mx-auto max-w-md px-4 pb-28 pt-6">
      <h1 className="text-3xl font-bold tracking-tighter">Earn</h1>
      <section className="mt-4 rounded-card border border-line p-5">
        <p className="text-sm text-muted">Earned today</p>
        <p className="font-mono text-4xl font-semibold tracking-tight">{data ? fmtGD(data.earnedToday) : " "} <span className="text-base text-muted">G$</span></p>
        <p className="mt-1 text-sm text-muted">{data ? `${fmtGD(data.capRemaining)} G$ left under today's cap` : ""}</p>
      </section>
      {data && !data.verified && <p className="mt-4 text-sm">Verify with GoodDollar on the home screen to earn.</p>}
      <h2 className="mt-8 text-lg font-bold">Ready to claim</h2>
      {data?.verified && data.vouchers.length === 0 && <p className="mt-2 text-sm text-muted">Pass a lesson to earn G$. Rewards show up here.</p>}
      <ul className="mt-3 grid gap-3">
        {data?.vouchers.map((v) => (
          <li key={v.id} className="flex items-center justify-between rounded-card border border-line p-4">
            <div><p className="font-mono text-lg font-semibold">{fmtGD(v.amount)} G$</p><p className="text-sm text-muted">{v.reason === "checkpoint" ? "Checkpoint passed" : "Lesson passed"}</p></div>
            <button disabled={busy} onClick={() => claim([v])} className="rounded-full bg-yellow px-5 py-2 font-semibold text-[#111] disabled:opacity-50">Claim</button>
          </li>
        ))}
      </ul>
      {data && data.vouchers.length > 1 && (
        <button disabled={busy} onClick={() => claim(data.vouchers)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-ink px-5 py-4 font-semibold text-paper disabled:opacity-50">
          {busy && <Loading03Icon className="animate-spin" size={18}  strokeWidth={1.75} />} Claim all ({fmtGD(total)} G$)
        </button>
      )}
      {tx && <p className="mt-3 break-all font-mono text-xs text-muted">tx {tx}</p>}
      {err && <p role="alert" className="mt-3 text-sm font-medium">{err}</p>}
      <TabBar />
    </main>
  );
}
