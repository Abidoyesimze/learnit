"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Notification01Icon, Loading03Icon } from "hugeicons-react";
import { useApi } from "@/lib/useApi";
import { needsInstallFirst, pushSupported, PermissionDenied, subscribeThisDevice, unsubscribeThisDevice } from "@/lib/push";
import { Sk } from "./Skeletons";

type Settings = { available: boolean; subscribed: boolean; reminderHour: number };
const HOURS = Array.from({ length: 24 }, (_, h) => ({ h, label: new Date(2000, 0, 1, h).toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" }) }));

/** Daily reminder: a switch and a time. The reminder is sent at that hour in the learner's own timezone. */
export function ReminderCard() {
  const api = useApi();
  const qc = useQueryClient();
  const { data, isError } = useQuery({ queryKey: ["push"], queryFn: () => api<Settings>("/api/push/settings"), retry: false });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (isError) return <section className="mt-10 border-t border-line pt-6"><h2 className="flex items-center gap-2 text-lg font-bold tracking-tight"><Notification01Icon size={20} strokeWidth={1.75} /> Daily reminder</h2><p className="mt-3 text-sm text-muted">Reminders are not available right now.</p></section>;
  if (!data) return <Sk className="mt-10 h-28 w-full rounded-card" />;

  const supported = pushSupported();
  const installFirst = needsInstallFirst();
  const hour = data.reminderHour;

  async function turnOn() {
    setBusy(true); setErr(null);
    try {
      const subscription = await subscribeThisDevice();
      await api("/api/push/subscribe", { method: "POST", body: JSON.stringify({ subscription, reminderHour: hour }) });
      await qc.invalidateQueries({ queryKey: ["push"] });
    } catch (e) {
      setErr(e instanceof PermissionDenied ? "Notifications are blocked for this site. Allow them in your browser settings, then try again." : e instanceof Error ? e.message : "Could not turn on reminders.");
    } finally { setBusy(false); }
  }
  async function turnOff() {
    setBusy(true); setErr(null);
    try { await api("/api/push/subscribe", { method: "DELETE", body: JSON.stringify({}) }); await unsubscribeThisDevice(); await qc.invalidateQueries({ queryKey: ["push"] }); }
    catch (e) { setErr(e instanceof Error ? e.message : "Could not turn off reminders."); }
    finally { setBusy(false); }
  }
  async function changeHour(h: number) {
    qc.setQueryData<Settings>(["push"], { ...data!, reminderHour: h });
    if (data!.subscribed) await api("/api/push/subscribe", { method: "PATCH", body: JSON.stringify({ reminderHour: h }) }).catch(() => qc.invalidateQueries({ queryKey: ["push"] }));
  }

  return (
    <section className="mt-10 border-t border-line pt-6" aria-labelledby="reminder">
      <h2 id="reminder" className="flex items-center gap-2 text-lg font-bold tracking-tight"><Notification01Icon size={20} strokeWidth={1.75} /> Daily reminder</h2>
      {!data.available ? (
        <p className="mt-3 text-sm text-muted">Reminders are not available right now.</p>
      ) : installFirst ? (
        <p className="mt-3 text-sm text-muted">On iPhone, add LearnIt to your Home Screen first (Share, then Add to Home Screen). Then come back here to turn on reminders.</p>
      ) : !supported ? (
        <p className="mt-3 text-sm text-muted">This browser does not support notifications.</p>
      ) : (
        <>
          <div className="mt-4 flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">Remind me to learn</p>
              <p className="text-sm text-muted">One short nudge a day. Skipped if you already learned.</p>
            </div>
            <button role="switch" aria-checked={data.subscribed} aria-label="Daily reminder" disabled={busy} onClick={() => (data.subscribed ? turnOff() : turnOn())}
              className={`relative h-8 w-14 shrink-0 rounded-full border transition ${data.subscribed ? "border-ink bg-yellow" : "border-line bg-transparent"} disabled:opacity-60`}>
              <span className={`absolute top-1 grid h-6 w-6 place-items-center rounded-full bg-ink transition-[left] ${data.subscribed ? "left-7" : "left-1"}`}>
                {busy && <Loading03Icon className="animate-spin text-paper" size={14} strokeWidth={2} />}
              </span>
            </button>
          </div>
          <div className="mt-4">
            <label htmlFor="remind-at" className="text-sm font-medium">Time</label>
            <select id="remind-at" value={hour} onChange={(e) => void changeHour(Number(e.target.value))} className="mt-2 w-full rounded-input border border-line bg-transparent px-4 py-3">
              {HOURS.map(({ h, label }) => <option key={h} value={h}>{label}</option>)}
            </select>
            <p className="mt-1 text-xs text-muted">In your own timezone.</p>
          </div>
        </>
      )}
      {err && <p role="alert" className="mt-3 text-sm font-medium">{err}</p>}
    </section>
  );
}
