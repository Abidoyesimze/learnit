import { requireUser, authFail } from "../auth";
import { db } from "../db";
import { configurePush } from "./../push";

/** GET: is push available, and is this account subscribed (and at what hour)? */
export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const sub = await db.pushSubscription.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
    return Response.json({ available: configurePush(), subscribed: Boolean(sub), reminderHour: sub?.reminderHour ?? 18 });
  } catch (e) { return authFail(e); }
}
