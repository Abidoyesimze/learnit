import { requireUser, authFail } from "../auth";
import { listCohortIds, readCohort, memberCount, myState, progressFor, mirrorCohort } from "../cohorts";

/** Cohorts a user can join (first day not over) plus ones they are already in. */
export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const now = Date.now() / 1000;
    const out = [];
    const ids = await listCohortIds();
    const recent = new Set(ids.slice(-6));
    for (const id of ids) {
      const mine = await myState(id, user);
      const owed = !!mine && BigInt(mine.payout) > 0n; // not withdrawn yet: finished a settled challenge, or staked in a cancelled one
      // Older challenges only matter while the person still has a payout to collect, so they never drop off the list.
      if (!recent.has(id) && !owed) continue;
      const c = await readCohort(id);
      if (!c) continue;
      await mirrorCohort(c);
      const joinable = now < c.start + 86400;
      if (!joinable && !(mine && BigInt(mine.stake) > 0n)) continue;
      out.push({ ...c, joinable, members: recent.has(id) ? await memberCount(id) : 0, mine, progress: mine && BigInt(mine.stake) > 0n ? await progressFor(user, c.start, c.end) : null });
    }
    return Response.json({ cohorts: out.reverse() });
  } catch (e) { return authFail(e); }
}
