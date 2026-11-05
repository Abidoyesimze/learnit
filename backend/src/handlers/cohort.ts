import { requireUser, authFail } from "../auth";
import { readCohort, memberCount, myState, progressFor } from "../cohorts";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser(req);
    const id = Number(params.id);
    if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Bad id" }, { status: 400 });
    const c = await readCohort(id);
    if (!c) return Response.json({ error: "Not found" }, { status: 404 });
    const mine = await myState(id, user);
    return Response.json({ ...c, members: await memberCount(id), mine, progress: await progressFor(user, c.start, c.end) });
  } catch (e) { return authFail(e); }
}
