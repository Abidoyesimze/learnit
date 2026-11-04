// End-to-end check of the reminder job against the real database and a local mock push service.
// Run: CERT_DIR=<dir with key.pem and cert.pem> npm run push:check -w @learnit/backend
import https from "node:https";
import fs from "node:fs";
import crypto from "node:crypto";
import { db } from "../src/db";
import { GET as cron } from "../src/handlers/cronReminders";
import { hourIn } from "../src/push";
import { localDate } from "../src/streak";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // the mock uses a self-signed cert; this script only
const dir = process.env.CERT_DIR!;
const hits: { path: string; encoding?: string; ttl?: string }[] = [];
const server = https.createServer({ key: fs.readFileSync(`${dir}/key.pem`), cert: fs.readFileSync(`${dir}/cert.pem`) }, (req, res) => {
  req.resume();
  hits.push({ path: req.url ?? "", encoding: req.headers["content-encoding"] as string, ttl: req.headers["ttl"] as string });
  res.statusCode = req.url === "/gone" ? 410 : 201; res.end();
});
await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
const port = (server.address() as { port: number }).port;

const ok = (name: string, pass: boolean, extra = "") => { console.log(`${pass ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`); if (!pass) process.exitCode = 1; };
const tag = `pk${Date.now()}`;
const keys = () => { const e = crypto.createECDH("prime256v1"); e.generateKeys(); return { p256dh: e.getPublicKey().toString("base64url"), auth: crypto.randomBytes(16).toString("base64url") }; };
const call = () => cron(new Request("http://x/api/cron/reminders", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } })).then((r) => r.json() as Promise<Record<string, number>>);

const now = new Date();
const mkUser = (n: string) => db.user.create({ data: { privyUserId: `${tag}${n}`, wallet: `0x${(tag + n).padEnd(40, "0").slice(0, 40)}`, timezone: "UTC", course: n === "b" ? "es" : "fr" } });
const [a, b, c, d] = await Promise.all(["a", "b", "c", "d"].map(mkUser));
const hour = hourIn("UTC", now), today = localDate(now, "UTC");
const mkSub = (userId: string, path: string, h: number) => db.pushSubscription.create({ data: { userId, endpoint: `https://127.0.0.1:${port}${path}`, reminderHour: h, ...keys() } });
const [sa, sb, sc, sd] = await Promise.all([mkSub(a.id, "/ok", hour), mkSub(b.id, "/ok-b", hour), mkSub(c.id, "/gone", hour), mkSub(d.id, "/other-hour", (hour + 5) % 24)]);
await db.streakDay.create({ data: { userId: b.id, date: today } }); // b already learned today

try {
  const r1 = await call();
  console.log("run 1:", JSON.stringify(r1));
  ok("sends to the person who is due and has not learned", hits.some((h) => h.path === "/ok") && hits.find((h) => h.path === "/ok")?.encoding === "aes128gcm");
  ok("sends an encrypted payload with a TTL", Boolean(hits.find((h) => h.path === "/ok")?.ttl));
  ok("skips someone who already learned today", !hits.some((h) => h.path === "/ok-b"));
  ok("does not send outside the chosen hour", !hits.some((h) => h.path === "/other-hour"));
  ok("removes a device the push service says is gone (410)", (await db.pushSubscription.findUnique({ where: { id: sc.id } })) === null);
  ok("records the local date after sending", (await db.pushSubscription.findUnique({ where: { id: sa.id } }))?.lastSentDate === today);

  const before = hits.length;
  const r2 = await call();
  console.log("run 2:", JSON.stringify(r2));
  ok("never sends twice on the same local day", hits.length === before);

  const unauth = await cron(new Request("http://x/api/cron/reminders"));
  ok("rejects a call without the cron secret", unauth.status === 401);
} finally {
  await db.pushSubscription.deleteMany({ where: { userId: { in: [a.id, b.id, c.id, d.id] } } });
  await db.streakDay.deleteMany({ where: { userId: { in: [a.id, b.id, c.id, d.id] } } });
  await db.user.deleteMany({ where: { id: { in: [a.id, b.id, c.id, d.id] } } });
  console.log("cleaned up, leftover test users:", await db.user.count({ where: { privyUserId: { startsWith: tag } } }));
  server.close(); await db.$disconnect();
}
