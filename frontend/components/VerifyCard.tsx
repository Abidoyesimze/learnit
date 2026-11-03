"use client";
import { useState } from "react";
import { SecurityCheckIcon } from "hugeicons-react";
import { useGoodSdk } from "@/lib/useGoodSdk";
import { CHAIN_ID } from "@learnit/backend/chain";

export function VerifyCard() {
  const sdk = useGoodSdk();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go() {
    if (!sdk) return;
    setBusy(true); setErr(null);
    try {
      const link = await sdk.identity.generateFVLink(false, `${window.location.origin}/?fv=1`, CHAIN_ID as never);
      window.location.href = link;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not start verification");
      setBusy(false);
    }
  }
  return (
    <section className="rounded-card border border-ink p-5">
      <SecurityCheckIcon size={28} strokeWidth={1.75} />
      <h2 className="mt-3 text-xl font-bold tracking-tight">Verify to claim and earn</h2>
      <p className="mt-1 text-sm text-muted">A quick face check proves you are one person. Lessons stay free either way.</p>
      <button onClick={go} disabled={!sdk || busy} className="mt-4 w-full rounded-full bg-yellow px-5 py-4 font-semibold text-[#111] transition active:scale-[0.98] disabled:opacity-50">
        {busy ? "Opening..." : "Verify with GoodDollar"}
      </button>
      {err && <p role="alert" className="mt-2 text-sm">{err}</p>}
    </section>
  );
}
