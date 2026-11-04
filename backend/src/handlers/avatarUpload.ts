import { requireUser, authFail } from "../auth";
import { db } from "../db";
import { sniffImage, avatarUrlFor, MAX_AVATAR_BYTES } from "../profile";

/** POST the image bytes as the request body (the app sends a 256px JPEG). The type is checked from the bytes, not the header. */
export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const declared = Number(req.headers.get("content-length") ?? 0);
    if (declared > MAX_AVATAR_BYTES) return Response.json({ error: "Photo is too large" }, { status: 413 });
    const bytes = new Uint8Array(await req.arrayBuffer());
    if (bytes.length === 0) return Response.json({ error: "No photo received" }, { status: 400 });
    if (bytes.length > MAX_AVATAR_BYTES) return Response.json({ error: "Photo is too large" }, { status: 413 });
    const type = sniffImage(bytes);
    if (!type) return Response.json({ error: "Use a JPG, PNG or WebP photo" }, { status: 415 });

    await db.avatar.upsert({ where: { userId: user.id }, create: { userId: user.id, data: bytes, type }, update: { data: bytes, type } });
    const updated = await db.user.update({ where: { id: user.id }, data: { hasAvatar: true, avatarVersion: { increment: 1 } } });
    return Response.json({ avatarUrl: avatarUrlFor(updated) });
  } catch (e) { return authFail(e); }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireUser(req);
    await db.avatar.deleteMany({ where: { userId: user.id } });
    await db.user.update({ where: { id: user.id }, data: { hasAvatar: false, avatarVersion: { increment: 1 } } });
    return Response.json({ avatarUrl: null });
  } catch (e) { return authFail(e); }
}
