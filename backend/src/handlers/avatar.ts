import { db } from "../db";

/** Public image for a user id. The URL carries ?v=<version>, so it is safe to cache for a year. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const a = await db.avatar.findUnique({ where: { userId: params.id } });
  if (!a) return new Response("Not found", { status: 404 });
  return new Response(a.data, {
    headers: {
      "content-type": a.type,
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'",
    },
  });
}
