// Exercises profile storage against the real database and a running server, then cleans up.
// Run (server on :3000): npm run profile:check -w @learnit/backend
import { db } from "../src/db";
import { avatarUrlFor } from "../src/profile";

const base = process.env.BASE ?? "http://localhost:3000";
const tag = `pc${Date.now()}`;
// smallest valid JPEG header + padding; enough for the type check the server stores and serves
const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);
const ok = (name: string, pass: boolean, extra = "") => { console.log(`${pass ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`); if (!pass) process.exitCode = 1; };

const a = await db.user.create({ data: { privyUserId: tag + "a", wallet: `0x${(tag + "a").padEnd(40, "0").slice(0, 40)}`, username: tag } });
const b = await db.user.create({ data: { privyUserId: tag + "b", wallet: `0x${(tag + "b").padEnd(40, "0").slice(0, 40)}` } });
try {
  // username is unique, even when only the casing differs at the app layer (stored lowercase)
  let dup = false;
  try { await db.user.update({ where: { id: b.id }, data: { username: tag } }); } catch (e) { dup = (e as { code?: string }).code === "P2002"; }
  ok("duplicate username rejected by the database", dup);

  await db.avatar.create({ data: { userId: a.id, data: jpeg, type: "image/jpeg" } });
  const u = await db.user.update({ where: { id: a.id }, data: { hasAvatar: true, avatarVersion: { increment: 1 } } });
  ok("avatar url is versioned", avatarUrlFor(u) === `/api/avatar/${a.id}?v=1`, String(avatarUrlFor(u)));

  const r = await fetch(`${base}${avatarUrlFor(u)}`);
  const bytes = new Uint8Array(await r.arrayBuffer());
  ok("GET /api/avatar/:id serves the bytes", r.status === 200 && bytes.length === jpeg.length && bytes[0] === 0xff, `HTTP ${r.status}, ${bytes.length} bytes`);
  ok("content-type is image/jpeg", r.headers.get("content-type") === "image/jpeg");
  ok("cached for a year (immutable)", /max-age=31536000/.test(r.headers.get("cache-control") ?? "") && /immutable/.test(r.headers.get("cache-control") ?? ""));
  ok("nosniff and locked-down CSP", r.headers.get("x-content-type-options") === "nosniff" && /default-src 'none'/.test(r.headers.get("content-security-policy") ?? ""));
  const miss = await fetch(`${base}/api/avatar/does-not-exist`);
  ok("unknown user gets 404", miss.status === 404);

  // deleting the user removes the photo too (cascade)
  await db.user.delete({ where: { id: a.id } });
  ok("avatar removed with the user (cascade)", (await db.avatar.count({ where: { userId: a.id } })) === 0);
} finally {
  await db.avatar.deleteMany({ where: { userId: { in: [a.id, b.id] } } });
  await db.user.deleteMany({ where: { id: { in: [a.id, b.id] } } });
  console.log("cleaned up, leftover test users:", await db.user.count({ where: { privyUserId: { startsWith: tag } } }));
  await db.$disconnect();
}
