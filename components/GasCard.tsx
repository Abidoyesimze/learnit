"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CircleNotch } from "@phosphor-icons/react";
import { useApi } from "@/lib/useApi";

export function GasCard() {
  const api = useApi();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function go() {
    setBusy(true); setErr(null);
    try { await api("/api/gas/topup", { method: "POST" }); await qc.invalidateQueries({ queryKey: ["me"] }); }
    catch (e) { setErr(e instanceof Error ? e.message : "Top-up failed"); } finally { setBusy(false); }
  }
  return (
    <section className="mt-4 rounded-card border border-line p-5">
      <h2 className="font-semibold">Get started</h2>
      <p className="mt-1 text-sm text-muted">Your wallet needs a little CELO to pay network fees for claims and stakes. We send a small amount, once.</p>
      <button onClick={go} disabled={busy} className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-ink px-5 py-3 font-semibold disabled:opacity-50">
        {busy && <CircleNotch className="animate-spin" size={18} />} Get CELO for fees
      </button>
      {err && <p role="alert" className="mt-2 text-sm">{err}</p>}
    </section>
  );
}
