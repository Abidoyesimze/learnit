import { z } from "zod";
import { requireUser, authFail } from "../auth";
import { db } from "../db";
import { configurePush } from "../push";

const Body = z.object({
  subscription: z.object({ endpoint: z.string().url().max(2000), keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(10).max(100) }) }),
  reminderHour: z.number().int().min(0).max(23).default(18),
});

/** POST: save this device for the daily reminder. Calling it again updates the hour. */
export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    if (!configurePush()) return Response.json({ error: "Reminders are not available right now" }, { status: 503 });
    const { subscription, reminderHour } = Body.parse(await req.json());
    await db.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      create: { userId: user.id, endpoint: subscription.endpoint, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, reminderHour },
      update: { userId: user.id, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, reminderHour },
    });
    return Response.json({ ok: true, reminderHour });
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json({ error: "Bad request" }, { status: 400 });
    return authFail(e);
  }
}

/** PATCH: change the reminder hour on every device of this account. */
export async function PATCH(req: Request) {
  try {
    const user = await requireUser(req);
    const { reminderHour } = z.object({ reminderHour: z.number().int().min(0).max(23) }).parse(await req.json());
    await db.pushSubscription.updateMany({ where: { userId: user.id }, data: { reminderHour } });
    return Response.json({ ok: true, reminderHour });
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json({ error: "Bad request" }, { status: 400 });
    return authFail(e);
  }
}

/** DELETE: turn reminders off for this account (all devices), or just one endpoint if given. */
export async function DELETE(req: Request) {
  try {
    const user = await requireUser(req);
    const body = (await req.json().catch(() => ({}))) as { endpoint?: string };
    await db.pushSubscription.deleteMany({ where: { userId: user.id, ...(body.endpoint ? { endpoint: body.endpoint } : {}) } });
    return Response.json({ ok: true });
  } catch (e) { return authFail(e); }
}
