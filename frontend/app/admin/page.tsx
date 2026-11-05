"use client";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, useConnect, useDisconnect, usePublicClient, useSignMessage, useWriteContract } from "wagmi";
import { encodeFunctionData, keccak256, parseUnits, toBytes, zeroHash } from "viem";
import { Copy, ExternalLink, PauseCircle, PlayCircle, Plus, ShieldCheck } from "lucide-react";
import { friendlyError } from "@/lib/txErrors";
import { streakVaultAbi } from "@learnit/backend/abis";
import { ADDR } from "@learnit/backend/chain";
import { fmtGD } from "@learnit/backend/format";
import { Badge, Button, Card, CardHeader, EmptyState, Label, Notice, PageHeader, fieldClass } from "@/components/ui";

const GUARDIAN = keccak256(toBytes("GUARDIAN_ROLE"));
const DAY = 86_400;
const MIN_LEAD = 10 * 60; // the contract needs a start in the future when the transaction lands, so leave some room

type UbiDay = { day: string; claims: number; claimers: number; total: string };
type UbiStats = { allTime: Omit<UbiDay, "day">; today: Omit<UbiDay, "day">; days: UbiDay[] };

type Row = { id: number; start: number; end: number; min: bigint; max: bigint; pot: bigint; finishedStake: bigint; settled: boolean };

const when = (s: number) => new Date(s * 1000).toLocaleString("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
const parseG = (v: string): bigint | null => {
  const t = v.trim();
  if (!/^\d*\.?\d*$/.test(t) || t === "" || t === ".") return null;
  try { return parseUnits(t, 18); } catch { return null; }
};

function statusOf(c: Row, now: number): { label: string; tone: "sage" | "coral" | "neutral" | "navy" } {
  if (c.settled) return { label: "Settled", tone: "neutral" };
  if (now < c.start) return { label: "Upcoming", tone: "navy" };
  if (now < c.start + DAY) return { label: "Open to join", tone: "sage" };
  if (now < c.end) return { label: "Running", tone: "sage" };
  return { label: "Ended, needs finalizing", tone: "coral" };
}

/** For wallets without the role (the Safe is the admin): the exact transaction to paste into the Safe app's Transaction Builder. */
function SafeTx({ to, data, note }: { to: string; data: `0x${string}`; note: string }) {
  const [copied, setCopied] = useState(false);
  const copy = (t: string) => { void navigator.clipboard?.writeText(t).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {}); };
  return (
    <div className="grid gap-2 rounded-input bg-sunken p-3 text-sm">
      <p className="text-ink-2">{note}</p>
      <p className="text-xs text-muted">To address</p>
      <p className="break-all font-mono text-xs text-ink">{to}</p>
      <p className="text-xs text-muted">Data (hex)</p>
      <p className="break-all font-mono text-xs text-ink">{data}</p>
      <Button variant="outline" size="sm" icon={Copy} onClick={() => copy(data)}>{copied ? "Copied" : "Copy data"}</Button>
    </div>
  );
}

export default function Admin() {
  const qc = useQueryClient();
  const pc = usePublicClient();
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { connect, connectors, isPending: connecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const ok = true; // no login gate: the contract checks the wallet's role, the API checks a signed message
  const live = Boolean(ADDR.streakVault);
  const vault = ADDR.streakVault;

  // Defaults to the next whole hour, a day from now.
  const defaultStart = useMemo(() => { const d = new Date(Date.now() + DAY * 1000); d.setMinutes(0, 0, 0); return toLocalInput(d); }, []);
  const [start, setStart] = useState(defaultStart);
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [busy, setBusy] = useState<null | "create" | "pause">(null);
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

  // Server checks the admin role on-chain; a non-admin gets a 403 and the card shows nothing.
  const ubi = useQuery({ queryKey: ["admin", "ubi", address], enabled: !!address, staleTime: 30_000, retry: false,
    queryFn: async () => {
      // Prove wallet ownership with a signature; the server checks it and the on-chain admin role.
      const ts = Date.now();
      const signature = await signMessageAsync({ message: `LearnIt admin ${ts}` });
      const res = await fetch("/api/admin/ubi", { headers: { "x-admin-address": address!, "x-admin-ts": String(ts), "x-admin-sig": signature } });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
      return res.json() as Promise<UbiStats>;
    } });

  const isAdmin = roles.data?.admin === true;
  const isGuardian = roles.data?.guardian === true;
  const isViewer = !!ubi.data; // the server let this wallet read stats (admin role or on the viewer list)
  const startSec = Math.floor(new Date(start).getTime() / 1000);
  const minWei = parseG(min), maxWei = parseG(max);
  const now = Math.floor(Date.now() / 1000);
  const problem =
    !Number.isFinite(startSec) ? "Pick a start date and time."
    : startSec < now + MIN_LEAD ? "The start must be at least 10 minutes from now."
    : minWei === null || minWei === 0n ? "Enter a minimum stake above 0."
    : maxWei === null || maxWei < minWei ? "The maximum must be at least the minimum."
    : null;

  async function send(kind: "create" | "pause", fn: "createCohort" | "pause" | "unpause", args: readonly unknown[], text: string) {
    if (!pc || !address) return;
    setBusy(kind); setErr(null); setDone(null);
    try {
      // Simulate first: a wrong wallet or bad value fails here with a readable reason, before any gas is spent.
      const { request } = await pc.simulateContract({ account: address, address: vault, abi: streakVaultAbi, functionName: fn, args } as never);
      const hash = await writeContractAsync(request);
      await pc.waitForTransactionReceipt({ hash });
      setDone({ text, hash });
      await Promise.all([qc.invalidateQueries({ queryKey: ["admin"] }), qc.invalidateQueries({ queryKey: ["cohorts"] }), qc.invalidateQueries({ queryKey: ["paused"] })]);
    } catch (e) { setErr(friendlyError(e)); } finally { setBusy(null); }
  }

  const create = () => { if (!problem) void send("create", "createCohort", [BigInt(startSec), minWei!, maxWei!], `Challenge created. It starts ${when(startSec)} and runs for 7 days.`); };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <PageHeader title="Admin" description="Create streak challenges and pause staking. Everything here is a transaction signed by your wallet, and the contract checks your role." />

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="grid content-start gap-6">
          {!live ? (
            <Notice tone="info" title="The StreakVault is not set up yet">Set NEXT_PUBLIC_STREAK_VAULT_ADDRESS after you deploy the contracts, then reload.</Notice>
          ) : !address ? (
            <Notice tone="info" title="No wallet connected" action={
              <Button size="sm" loading={connecting} onClick={() => connect({ connector: connectors[0] })}>Connect wallet</Button>}>
              Connect the admin wallet to continue.
            </Notice>
          ) : roles.isLoading ? (
            <Notice tone="info">Checking this wallet's role...</Notice>
          ) : !isAdmin && !isGuardian ? (
            <Notice tone={isViewer ? "info" : "warning"} title={isViewer ? "View only" : "This wallet is not an admin"}>
              <span className="break-all">{address}</span> has no admin or guardian role on the StreakVault
              {isViewer ? ", so it can see the stats. Create and pause go through the Safe: use the transaction data below." : ". Only the Safe can create challenges or pause."}
            </Notice>
          ) : null}

          {live && (
            <Card className="p-6">
              <CardHeader title="Create a challenge" description="A 7-day streak challenge. People can join until the first day is over." />
              <div className="mt-5 grid gap-4">
                <div>
                  <Label htmlFor="start">Starts</Label>
                  <input id="start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className={`${fieldClass} mt-1.5`} />
                  {Number.isFinite(startSec) && <p className="mt-1.5 text-sm text-muted">Joining closes {when(startSec + DAY)}. It ends {when(startSec + 7 * DAY)}.</p>}
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
                {isAdmin ? (
                  <Button onClick={create} disabled={!!problem} loading={busy === "create"} icon={Plus} block>
                    {busy === "create" ? "Confirm in your wallet..." : "Create challenge"}
                  </Button>
                ) : problem ? (
                  <p className="text-sm text-muted">Fill in the fields above to get the Safe transaction.</p>
                ) : (
                  <SafeTx to={vault} data={encodeFunctionData({ abi: streakVaultAbi, functionName: "createCohort", args: [BigInt(startSec), minWei!, maxWei!] })}
                    note="In the Safe app, open New transaction, then Transaction builder, paste this address and data, and send it for signing. Value is 0." />
                )}
              </div>
            </Card>
          )}


          {ubi.data && (
            <Card className="p-6">
              <CardHeader title="Daily UBI claims" description="G$ claimed through LearnIt, by UTC day. Only claims made in this app are counted." />
              <dl className="mt-4 grid grid-cols-3 gap-3">
                {([["Today", ubi.data.today], ["All time", ubi.data.allTime]] as const).map(([label, v]) => (
                  <div key={label} className="rounded-input bg-sunken px-3 py-2">
                    <dt className="text-xs text-muted">{label}</dt>
                    <dd className="font-semibold text-ink tabular">{fmtGD(v.total)} G$</dd>
                    <dd className="text-xs text-muted tabular">{v.claims} claims, {v.claimers} people</dd>
                  </div>
                ))}
                <div className="rounded-input bg-sunken px-3 py-2">
                  <dt className="text-xs text-muted">Last 30 days</dt>
                  <dd className="font-semibold text-ink tabular">{fmtGD(ubi.data.days.reduce((s, d) => s + BigInt(d.total), 0n))} G$</dd>
                </div>
              </dl>
              {ubi.data.days.length > 0 && (
                <ul className="mt-4 grid divide-y divide-line text-sm tabular">
                  {ubi.data.days.map((d) => (
                    <li key={d.day} className="flex items-center justify-between gap-3 py-2">
                      <span className="text-ink-2">{new Date(d.day + "T00:00:00Z").toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" })}</span>
                      <span className="text-muted">{d.claimers} people</span>
                      <span className="font-medium text-ink">{fmtGD(d.total)} G$</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {address && <p className="text-sm text-muted">Connected: <span className="break-all font-mono">{address}</span> <button className="underline underline-offset-4" onClick={() => disconnect()}>Disconnect</button></p>}
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
                        return (
                          <li key={c.id} className="grid gap-1.5 py-4 first:pt-0 last:pb-0">
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-semibold text-ink">Challenge {c.id}</p>
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
                ) : null}
              </div>
              {!isGuardian && (
                <div className="mt-3">
                  <SafeTx to={vault} data={encodeFunctionData({ abi: streakVaultAbi, functionName: paused.data ? "unpause" : "pause" })}
                    note={`Only the guardian (the Safe) can ${paused.data ? "resume" : "pause"} staking. Send this from the Safe.`} />
                </div>
              )}
            </Card>
            <Card className="p-6">
              <CardHeader title="Finalizing" description="After a challenge ends, the backend script marks who finished all 7 days and settles it. It runs from a machine that holds the signer key, never from this page." />
            </Card>
          </aside>
        )}
      </div>
    </div>
  );
}
