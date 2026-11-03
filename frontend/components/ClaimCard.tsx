"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loading03Icon } from "hugeicons-react";
import { useApi } from "@/lib/useApi";
import { useGoodSdk } from "@/lib/useGoodSdk";
import { fmtGD } from "@learnit/backend/format";
import { ClaimCardSkeleton } from "./Skeletons";

type Status = { claimable: string; canClaim: boolean; nextClaimAt: number | null; lastClaimTx: string | null };

function useCountdown(to: number | null) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!to) return;
    const tick = () => setLeft(Math.max(0, to - Math.floor(Date.now() / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [to]);
  const h = Math.floor(left / 3600), m = Math.floor((left % 3600) / 60), s = left % 60;
  return { left, text: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` };
}

export function ClaimCard() {
  const api = useApi();
  const sdk = useGoodSdk();
  const router = useRouter();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["ubi"], queryFn: () => api<Status>("/api/ubi/status"), refetchInterval: 60_000 });
  const cd = useCountdown(data?.nextClaimAt ?? null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tx, setTx] = useState<string | null>(null);

  async function claim() {
    if (!sdk) return;
    setBusy(true); setErr(null);
    try {
      const receipt = await sdk.claim.claim();
      const hash = (receipt as { transactionHash: string }).transactionHash;
      setTx(hash);
      await api("/api/ubi/claimed", { method: "POST", body: JSON.stringify({ txHash: hash }) });
      await qc.invalidateQueries({ queryKey: ["ubi"] });
      router.push("/learn");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Claim failed");
    } finally { setBusy(false); }
  }

  if (isLoading || !data) return <ClaimCardSkeleton />;

  return (
    <section className="rounded-card bg-yellow p-5 text-[#111]">
      <p className="text-sm font-medium">Daily G$</p>
      {data.canClaim ? (
        <>
          <p className="mt-1 font-mono text-5xl font-semibold tracking-tight">{fmtGD(data.claimable)}</p>
          <p className="text-sm">ready to claim today</p>
          <button onClick={claim} disabled={busy || !sdk} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#111] px-5 py-4 font-semibold text-[#fafafa] transition active:scale-[0.98] disabled:opacity-60">
            {busy && <Loading03Icon className="animate-spin" size={18}  strokeWidth={1.75} />} {busy ? "Claiming..." : "Claim"}
          </button>
        </>
      ) : (
        <>
          <p className="mt-1 text-2xl font-bold tracking-tight">Claimed for today</p>
          <p className="mt-1 text-sm">Next claim in <span className="font-mono font-semibold">{cd.text}</span></p>
          <button onClick={() => router.push("/learn")} className="mt-4 w-full rounded-full bg-[#111] px-5 py-4 font-semibold text-[#fafafa] transition active:scale-[0.98]">Go to today&apos;s lesson</button>
        </>
      )}
      {tx && <p className="mt-3 break-all font-mono text-xs">tx {tx}</p>}
      {err && <p role="alert" className="mt-3 text-sm font-medium">{err}</p>}
    </section>
  );
}
