import { db } from "@/lib/server/db";
import { requireUser, authFail } from "@/lib/server/auth";
import { readVerification } from "@/lib/server/identity";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const v = await readVerification(user.wallet as `0x${string}`);
    const updated = await db.user.update({
      where: { id: user.id },
      data: { whitelistedRoot: v.root, verifiedUntil: v.verifiedUntil },
    });
    return Response.json({
      wallet: updated.wallet,
      verified: v.verified && (!v.verifiedUntil || v.verifiedUntil > new Date()),
      root: v.root,
      verifiedUntil: v.verifiedUntil,
      timezone: updated.timezone,
      course: updated.course,
      gasTopupDone: Boolean(updated.gasTopupTx),
    });
  } catch (e) {
    return authFail(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireUser(req);
    const body = (await req.json()) as { timezone?: string; course?: string };
    const data: { timezone?: string; course?: string } = {};
    if (body.timezone) {
      try { new Intl.DateTimeFormat("en", { timeZone: body.timezone }); data.timezone = body.timezone; } catch {}
    }
    if (body.course === "fr" || body.course === "es") data.course = body.course;
    await db.user.update({ where: { id: user.id }, data });
    return Response.json({ ok: true });
  } catch (e) {
    return authFail(e);
  }
}
