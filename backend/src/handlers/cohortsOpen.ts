import { requireUser, authFail } from "../auth";
import { listCohortIds, readCohort, memberCount, myState, progressFor, mirrorCohort } from "../cohorts";

/** Cohorts a user can join (first day not over) plus ones they are already in. */
export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const now = Date.now() / 1000;
    const out = [];
    for (const id of (await listCohortIds()).slice(-6)) {
      const c = await readCohort(id);
      if (!c) continue;
      await mirrorCohort(c);
      const mine = await myState(id, user);
      const joinable = now < c.start + 86400;
      if (!joinable && !(mine && BigInt(mine.stake) > 0n)) continue;
      out.push({ ...c, joinable, members: await memberCount(id), mine, progress: mine && BigInt(mine.stake) > 0n ? await progressFor(user, c.start) : null });
    }
    return Response.json({ cohorts: out.reverse() });
  } catch (e) { return authFail(e); }
}
