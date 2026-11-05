"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Fuel } from "lucide-react";
import { CELO_HELP_URL } from "@/lib/links";
import { useApi } from "@/lib/useApi";
import { Button, Card } from "./ui";

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
    <Card className="p-6">
      <div className="flex gap-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-input bg-sunken text-ink-2"><Fuel size={18} strokeWidth={1.85} aria-hidden /></span>
        <div>
          <h2 className="text-sm font-semibold text-ink">One more step</h2>
          <p className="mt-1 text-pretty text-sm leading-relaxed text-muted">Your wallet needs a little CELO to pay network fees for claims and stakes. We send a small amount, once.</p>
        </div>
      </div>
      <Button onClick={go} loading={busy} variant="outline" block className="mt-5">Get CELO for fees</Button>
      {err && <p role="alert" className="mt-2 text-sm text-danger">{err}</p>}
      <p className="mt-4 text-sm text-muted">
        Need more later?{" "}
        <a href={CELO_HELP_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-ink underline underline-offset-4">Get CELO in our Telegram group <ExternalLink size={13} aria-hidden /></a>
      </p>
    </Card>
  );
}
