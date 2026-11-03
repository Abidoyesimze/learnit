import { db } from "../db";

/** Liveness for the Neon services this app uses: Postgres (via Prisma) and the Neon Function. */
export async function GET() {
  const out: Record<string, unknown> = {};
  try {
    const t = Date.now();
    await db.$queryRaw`SELECT 1`;
    out.postgres = { ok: true, tables: await db.user.count().then(() => true), ms: Date.now() - t };
  } catch (e) {
    out.postgres = { ok: false, error: e instanceof Error ? e.message.split("\n").pop() : "error" };
  }
  const fn = process.env.NEON_FUNCTION_HELLO_BASE_URL;
  if (!fn) out.function = { ok: false, error: "NEON_FUNCTION_HELLO_BASE_URL not set" };
  else {
    try {
      const t = Date.now();
      const r = await fetch(fn, { signal: AbortSignal.timeout(8000), cache: "no-store" });
      out.function = { ok: r.ok, status: r.status, body: (await r.text()).slice(0, 80), ms: Date.now() - t };
    } catch (e) {
      out.function = { ok: false, error: e instanceof Error ? e.message : "error" };
    }
  }
  const ok = Object.values(out).every((v) => (v as { ok: boolean }).ok);
  return Response.json({ ok, ...out }, { status: ok ? 200 : 503 });
}
