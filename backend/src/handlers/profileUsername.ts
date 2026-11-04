import { requireUser, authFail } from "../auth";
import { db } from "../db";
import { validateUsername } from "../profile";

/** GET ?u=name: is this username valid and free? Used for the live check while typing. */
export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const u = new URL(req.url).searchParams.get("u") ?? "";
    const v = validateUsername(u);
    if (!v.ok) return Response.json({ available: false, reason: v.reason });
    if (user.username === v.value) return Response.json({ available: true });
    const taken = await db.user.findUnique({ where: { username: v.value }, select: { id: true } });
    return Response.json(taken ? { available: false, reason: "That username is taken" } : { available: true });
  } catch (e) { return authFail(e); }
}
