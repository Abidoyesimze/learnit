import { timingSafeEqual } from "node:crypto";
import { db } from "../db";
import { configurePush, isDue, reminderFor, send } from "../push";
import { streakCount } from "../streak";

const authorized = (req: Request) => {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get("authorization") ?? "";
  if (!secret) return false;
  const want = `Bearer ${secret}`;
  return got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
};

/**
 * Run every hour (Vercel Cron sends the Authorization header from CRON_SECRET).
 * Sends today's reminder to anyone whose chosen hour it is, who has not learned yet today.
 */
export async function GET(req: Request) {
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!configurePush()) return Response.json({ error: "Push is not configured" }, { status: 503 });

  const subs = await db.pushSubscription.findMany({ include: { user: { select: { id: true, timezone: true, course: true } } } });
  const due = subs.map((s) => ({ s, ...isDue(s, s.user.timezone) })).filter((x) => x.due);
  if (due.length === 0) return Response.json({ checked: subs.length, sent: 0 });

  // Who already learned today, and what is their streak? One query for everyone due.
  const userIds = [...new Set(due.map((d) => d.s.userId))];
  const days = await db.streakDay.findMany({ where: { userId: { in: userIds } }, select: { userId: true, date: true } });
  const byUser = new Map<string, string[]>();
  for (const d of days) byUser.set(d.userId, [...(byUser.get(d.userId) ?? []), d.date]);

  let sent = 0, skipped = 0, removed = 0, failed = 0;
  for (const { s, today } of due) {
    const dates = byUser.get(s.userId) ?? [];
    if (dates.includes(today)) { skipped++; await db.pushSubscription.update({ where: { id: s.id }, data: { lastSentDate: today } }); continue; }
    const payload = reminderFor(streakCount(dates, today), s.user.course === "es" ? "es" : "fr");
    try {
      await send({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 3 * 3600, urgency: "normal" });
      await db.pushSubscription.update({ where: { id: s.id }, data: { lastSentDate: today } });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) { await db.pushSubscription.delete({ where: { id: s.id } }).catch(() => {}); removed++; } // the device unsubscribed
      else { failed++; console.error("push failed", code); }
    }
  }
  return Response.json({ checked: subs.length, due: due.length, sent, skipped, removed, failed });
}
