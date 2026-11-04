import { requireUser, authFail } from "../auth";
import { leaderboardFor } from "../leagues";
import { short } from "../format";

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const board = await leaderboardFor(user);
    if (!board) return Response.json({ joined: false });
    return Response.json({
      joined: true,
      weekKey: board.weekKey,
      endsAt: board.endsAt,
      rows: board.rows.map((r) => ({ you: r.userId === user.id, wallet: short(r.wallet), name: r.name, avatarUrl: r.avatarUrl, points: r.points, rank: r.rank })),
    });
  } catch (e) { return authFail(e); }
}
