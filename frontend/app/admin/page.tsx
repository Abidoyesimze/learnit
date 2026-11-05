"use client";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { erc20Abi, keccak256, parseUnits, toBytes, zeroHash } from "viem";
import { ExternalLink, PauseCircle, PlayCircle, Plus, ShieldCheck, Sparkles } from "lucide-react";
import { friendlyError } from "@/lib/txErrors";
import { streakVaultAbi } from "@learnit/backend/abis";
import { ADDR } from "@learnit/backend/chain";
import { fmtGD } from "@learnit/backend/format";
import { AppShell } from "@/components/AppShell";
import { Badge, Button, Card, CardHeader, EmptyState, Label, Notice, PageHeader, fieldClass } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useAuthGate } from "@/components/useAuthGate";
import { StakeSkeleton } from "@/components/Skeletons";

const GUARDIAN = keccak256(toBytes("GUARDIAN_ROLE"));
const DAY = 86_400;
const MIN_LEAD = 10 * 60; // the contract needs a start in the future when the transaction lands, so leave some room
const LENGTHS = [7, 14, 30] as const;

type Row = { id: number; start: number; end: number; min: bigint; max: bigint; pot: bigint; finishedStake: bigint; settled: boolean };

const when = (s: number) => new Date(s * 1000).toLocaleString("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
const parseG = (v: string): bigint | null => {
  const t = v.trim();
  if (!/^\d*\.?\d*$/.test(t) || t === "" || t === ".") return null;
  try { return parseUnits(t, 18); } catch { return null; }
};
/** "6" (percent, what an admin types) <-> 600 (bps, what the contract stores). */
const pctToBps = (v: string): number | null => {
  const t = v.trim();
  if (!/^\d*\.?\d*$/.test(t) || t === "" || t === ".") return null;
  const n = Math.round(parseFloat(t) * 100);
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const bpsToPct = (bps: number) => (bps / 100).toString();

function statusOf(c: Row, now: number): { label: string; tone: "sage" | "coral" | "neutral" | "navy" } {
  if (c.settled) return { label: "Settled", tone: "neutral" };
  if (now < c.start) return { label: "Upcoming", tone: "navy" };
  if (now < c.start + DAY) return { label: "Open to join", tone: "sage" };
  if (now < c.end) return { label: "Running", tone: "sage" };
  return { label: "Ended, needs finalizing", tone: "coral" };
}

export default function Admin() {
  const ok = useAuthGate();
  const qc = useQueryClient();
  const pc = usePublicClient();
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const live = Boolean(ADDR.streakVault);
  const vault = ADDR.streakVault;

  // Defaults to the next whole hour, a day from now.
  const defaultStart = useMemo(() => { const d = new Date(Date.now() + DAY * 1000); d.setMinutes(0, 0, 0); return toLocalInput(d); }, []);
  const [start, setStart] = useState(defaultStart);
  const [lengthDays, setLengthDays] = useState<(typeof LENGTHS)[number]>(7);
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [bonusPct, setBonusPct] = useState<Record<number, string>>({});
  const [fundAmount, setFundAmount] = useState("");
  const [busy, setBusy] = useState<null | "create" | "pause" | `bonus-${number}` | "fund">(null);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ text: string; hash: `0x${string}` } | null>(null);

  const roles = useQuery({
    queryKey: ["admin", "roles", address], enabled: ok && live && !!pc && !!address, staleTime: 15_000,
    queryFn: async () => {
      const [admin, guardian] = await Promise.all([
        pc!.readContract({ address: vault, abi: streakVaultAbi, functionName: "hasRole", args: [zeroHash, address!] }),
        pc!.readContract({ address: vault, abi: streakVaultAbi, functionName: "hasRole", args: [GUARDIAN, address!] }),
      ]);
      return { admin, guardian };
    },
  });
  const paused = useQuery({ queryKey: ["admin", "paused"], enabled: ok && live && !!pc, staleTime: 10_000,
    queryFn: () => pc!.readContract({ address: vault, abi: streakVaultAbi, functionName: "paused" }) });
  const bonus = useQuery({
    queryKey: ["admin", "bonus"], enabled: ok && live && !!pc, staleTime: 15_000,
    queryFn: async () => {
      const [bps7, bps14, bps30, reserve, capBps] = await Promise.all([
        pc!.readContract({ address: vault, abi: streakVaultAbi, functionName: "bonusBpsFor", args: [7] }),
        pc!.readContract({ address: vault, abi: streakVaultAbi, functionName: "bonusBpsFor", args: [14] }),
        pc!.readContract({ address: vault, abi: streakVaultAbi, functionName: "bonusBpsFor", args: [30] }),
        pc!.readContract({ address: vault, abi: streakVaultAbi, functionName: "bonusReserve" }),
        pc!.readContract({ address: vault, abi: streakVaultAbi, functionName: "MAX_BONUS_BPS" }),
      ]);
      return { bpsFor: { 7: bps7, 14: bps14, 30: bps30 } as Record<number, number>, reserve, capBps };
    },
  });
  const list = useQuery({
    queryKey: ["admin", "cohorts"], enabled: ok && live && !!pc, staleTime: 15_000,
    queryFn: async (): Promise<Row[]> => {
      const next = Number(await pc!.readContract({ address: vault, abi: streakVaultAbi, functionName: "nextCohortId" }));
      const ids = Array.from({ length: Math.max(0, next - 1) }, (_, i) => i + 1);
      if (!ids.length) return [];
      const res = await pc!.multicall({ allowFailure: false, contracts: ids.map((id) => ({ address: vault, abi: streakVaultAbi, functionName: "cohorts" as const, args: [BigInt(id)] as const })) });
      return res.map((r, i) => ({ id: ids[i], start: Number(r[0]), end: Number(r[1]), min: r[2], max: r[3], pot: r[4], finishedStake: r[5], settled: r[7] })).reverse();
    },
  });

  if (!ok) return <StakeSkeleton />;

  const isAdmin = roles.data?.admin === true;
  const isGuardian = roles.data?.guardian === true;
  const startSec = Math.floor(new Date(start).getTime() / 1000);
  const minWei = parseG(min), maxWei = parseG(max);
  const now = Math.floor(Date.now() / 1000);
  const problem =
    !Number.isFinite(startSec) ? "Pick a start date and time."
    : startSec < now + MIN_LEAD ? "The start must be at least 10 minutes from now."
    : minWei === null || minWei === 0n ? "Enter a minimum stake above 0."
    : maxWei === null || maxWei < minWei ? "The maximum must be at least the minimum."
    : null;

  async function send(key: NonNullable<typeof busy>, fn: string, args: readonly unknown[], text: string) {
    if (!pc || !address) return;
    setBusy(key); setErr(null); setDone(null);
    try {
      // Simulate first: a wrong wallet or bad value fails here with a readable reason, before any gas is spent.
      const { request } = await pc.simulateContract({ account: address, address: vault, abi: streakVaultAbi, functionName: fn, args } as never);
      const hash = await writeContractAsync(request);
      await pc.waitForTransactionReceipt({ hash });
      setDone({ text, hash });
      await Promise.all([qc.invalidateQueries({ queryKey: ["admin"] }), qc.invalidateQueries({ queryKey: ["cohorts"] })]);
    } catch (e) { setErr(friendlyError(e)); } finally { setBusy(null); }
  }

  const create = () => { if (!problem) void send("create", "createCohort", [BigInt(startSec), lengthDays, minWei!, maxWei!], `Challenge created. It starts ${when(startSec)} and runs ${lengthDays} days.`); };

  const saveBonus = (len: number) => {
    const bps = pctToBps(bonusPct[len] ?? "");
    if (bps === null || !bonus.data) return;
    if (bps > bonus.data.capBps) { setErr(`That bonus rate is above the ${bonus.data.capBps / 100}% cap.`); return; }
    void send(`bonus-${len}`, "setBonusBps", [len, bps], `${len}-day bonus set to ${bps / 100}%.`);
  };

  const fundReserve = async () => {
    const wei = parseG(fundAmount);
    if (!pc || !address || wei === null || wei === 0n) return;
    setBusy("fund"); setErr(null); setDone(null);
    try {
      const allowance = await pc.readContract({ address: ADDR.gd, abi: erc20Abi, functionName: "allowance", args: [address, vault] });
      if (allowance < wei) {
        const h = await writeContractAsync({ address: ADDR.gd, abi: erc20Abi, functionName: "approve", args: [vault, wei] });
        await pc.waitForTransactionReceipt({ hash: h });
      }
      const { request } = await pc.simulateContract({ account: address, address: vault, abi: streakVaultAbi, functionName: "fundBonusReserve", args: [wei] });
      const hash = await writeContractAsync(request);
      await pc.waitForTransactionReceipt({ hash });
      setDone({ text: `Added ${fmtGD(wei)} G$ to the bonus reserve.`, hash });
      setFundAmount("");
      await qc.invalidateQueries({ queryKey: ["admin", "bonus"] });
    } catch (e) { setErr(friendlyError(e)); } finally { setBusy(null); }
  };

  return (
    <AppShell>
      <PageHeader title="Admin" description="Create streak challenges, tune the length bonus, and pause staking. Everything here is a transaction signed by your wallet, and the contract checks your role." />

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="grid content-start gap-6">
          {!live ? (
            <Notice tone="info" title="The StreakVault is not set up yet">Set NEXT_PUBLIC_STREAK_VAULT_ADDRESS after you deploy the contracts, then reload.</Notice>
          ) : !address ? (
            <Notice tone="info" title="No wallet connected">Connect the admin wallet to continue.</Notice>
          ) : roles.isLoading ? (
            <Notice tone="info">Checking this wallet's role...</Notice>
          ) : !isAdmin && !isGuardian ? (
            <Notice tone="warning" title="This wallet is not an admin">
              <span className="break-all">{address}</span> has no admin or guardian role on the StreakVault. If admin is a Safe, connect through the Safe's WalletConnect session instead of a personal wallet.
            </Notice>
          ) : null}

          {live && isAdmin && (
            <Card className="p-6">
              <CardHeader title="Create a challenge" description="Pick how long it runs and set the stake range. People can join until the first day is over." />
              <div className="mt-5 grid gap-4">
                <div>
                  <Label>Length</Label>
                  <div className="mt-1.5 inline-flex rounded-full border border-line bg-sunken p-1" role="tablist" aria-label="Challenge length">
                    {LENGTHS.map((d) => (
                      <button key={d} type="button" role="tab" aria-selected={lengthDays === d} onClick={() => setLengthDays(d)}
                        className={cn("rounded-full px-4 py-1.5 text-sm font-medium transition", lengthDays === d ? "bg-ink text-paper" : "text-ink-2 hover:text-ink")}>
                        {d} days
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label htmlFor="start">Starts</Label>
                  <input id="start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className={`${fieldClass} mt-1.5`} />
                  {Number.isFinite(startSec) && <p className="mt-1.5 text-sm text-muted">Joining closes {when(startSec + DAY)}. It ends {when(startSec + lengthDays * DAY)}.</p>}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="min">Minimum stake (G$)</Label>
                    <input id="min" inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} placeholder="1" className={`${fieldClass} mt-1.5`} />
                  </div>
                  <div>
                    <Label htmlFor="max">Maximum stake (G$)</Label>
                    <input id="max" inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} placeholder="100" className={`${fieldClass} mt-1.5`} />
                  </div>
                </div>
                {problem && (min || max) && <p className="text-sm text-danger" role="alert">{problem}</p>}
                <Button onClick={create} disabled={!!problem} loading={busy === "create"} icon={Plus} block>
                  {busy === "create" ? "Confirm in your wallet..." : "Create challenge"}
                </Button>
              </div>
            </Card>
          )}

          {live && isAdmin && (
            <Card className="p-6">
              <CardHeader title="Length bonus" description="An extra bonus for finishers, on top of the usual forfeit-sharing, by challenge length. Paid only from the reserve below, never from stakers' own principal." />
              <div className="mt-5 grid gap-3">
                {LENGTHS.map((d) => {
                  const current = bonus.data?.bpsFor[d];
                  return (
                    <div key={d} className="flex items-end gap-3">
                      <div className="flex-1">
                        <Label htmlFor={`bonus-${d}`}>{d}-day bonus</Label>
                        <div className="relative mt-1.5">
                          <input id={`bonus-${d}`} inputMode="decimal" placeholder={current !== undefined ? bpsToPct(current) : "0"}
                            value={bonusPct[d] ?? ""} onChange={(e) => setBonusPct((s) => ({ ...s, [d]: e.target.value }))}
                            className={cn(fieldClass, "pr-9")} />
                          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted">%</span>
                        </div>
                      </div>
                      <Button variant="outline" size="md" loading={busy === `bonus-${d}`} onClick={() => saveBonus(d)}>Save</Button>
                    </div>
                  );
                })}
                <p className="mt-1 text-xs text-muted">Currently set: {LENGTHS.map((d) => `${d}d ${bonus.data ? bpsToPct(bonus.data.bpsFor[d]) : "..."}%`).join(" · ")}. Capped at {bonus.data ? bpsToPct(bonus.data.capBps) : "50"}%.</p>
              </div>
              <div className="mt-6 border-t border-line pt-5">
                <Label htmlFor="fund">Fund the bonus reserve</Label>
                <p className="mt-1 text-xs text-muted">Current reserve: <span className="tabular font-medium text-ink-2">{bonus.data ? fmtGD(bonus.data.reserve) : "..."} G$</span></p>
                <div className="mt-2 flex gap-3">
                  <input id="fund" inputMode="decimal" value={fundAmount} onChange={(e) => setFundAmount(e.target.value)} placeholder="Amount in G$" className={fieldClass} />
                  <Button variant="outline" icon={Sparkles} loading={busy === "fund"} onClick={fundReserve}>Fund</Button>
                </div>
                <p className="mt-2 text-xs text-muted">Two steps in your wallet if allowance is short: approve, then fund.</p>
              </div>
            </Card>
          )}

          {err && <Notice tone="danger">{err}</Notice>}
          {done && (
            <Notice tone="success" title="Done" action={<a className="inline-flex items-center gap-1 font-medium underline underline-offset-4" href={`https://celoscan.io/tx/${done.hash}`} target="_blank" rel="noreferrer">View transaction <ExternalLink size={13} aria-hidden /></a>}>
              {done.text}
            </Notice>
          )}

          {live && (
            <Card className="p-6">
              <CardHeader title="Challenges" description="Read straight from the contract." />
              <div className="mt-4">
                {list.isLoading ? <p className="text-sm text-muted">Loading...</p>
                  : !list.data?.length ? <EmptyState icon={ShieldCheck} title="No challenges yet">Create the first one above.</EmptyState>
                  : (
                    <ul className="grid divide-y divide-line">
                      {list.data.map((c) => {
                        const st = statusOf(c, now);
                        const days = Math.round((c.end - c.start) / DAY);
                        return (
                          <li key={c.id} className="grid gap-1.5 py-4 first:pt-0 last:pb-0">
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-semibold text-ink">Challenge {c.id} <span className="font-normal text-muted">· {days} days</span></p>
                              <Badge tone={st.tone}>{st.label}</Badge>
                            </div>
                            <p className="text-sm text-muted">{when(c.start)} to {when(c.end)}</p>
                            <p className="text-sm text-ink-2 tabular">Stake {fmtGD(c.min)} to {fmtGD(c.max)} G$. Pot {fmtGD(c.pot)} G$.</p>
                            {!c.settled && now >= c.end && (
                              <p className="mt-1 rounded-input bg-sunken px-3 py-2 font-mono text-xs text-ink-2">From the backend folder: npx tsx --env-file=.env scripts/finalize-cohort.mts {c.id} --send</p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
              </div>
            </Card>
          )}
        </div>

        {live && (
          <aside className="grid content-start gap-6">
            <Card className="p-6">
              <CardHeader title="Staking switch" description="Pausing stops new stakes. Stakes already in stay safe." />
              <div className="mt-4 flex items-center justify-between gap-3">
                <Badge tone={paused.data ? "coral" : "sage"}>{paused.data ? "Paused" : "Running"}</Badge>
                {isGuardian ? (
                  <Button variant="outline" size="sm" loading={busy === "pause"} icon={paused.data ? PlayCircle : PauseCircle}
                    onClick={() => send("pause", paused.data ? "unpause" : "pause", [], paused.data ? "Staking is running again." : "Staking is paused.")}>
                    {paused.data ? "Resume staking" : "Pause staking"}
                  </Button>
                ) : <span className="text-sm text-muted">Needs the guardian role</span>}
              </div>
            </Card>
            <Card className="p-6">
              <CardHeader title="Finalizing" description="After a challenge ends, the backend script marks who finished every day and settles it. It runs from a machine that holds the signer key, never from this page." />
            </Card>
          </aside>
        )}
      </div>
    </AppShell>
  );
}
