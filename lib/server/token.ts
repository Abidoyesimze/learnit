import { createHmac, timingSafeEqual } from "node:crypto";

const secret = () => {
  const s = process.env.APP_SECRET || process.env.SIGNER_PRIVATE_KEY;
  if (!s) throw new Error("APP_SECRET (or SIGNER_PRIVATE_KEY) not set");
  return s;
};
const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export type Start = { userId: string; kind: "lesson" | "checkpoint"; targetId: string; startedAt: number; seed: number };

/** Server-issued start token: lets the server measure time spent and re-derive a checkpoint draw. */
export function issueStart(s: Start) {
  const p = Buffer.from(JSON.stringify(s)).toString("base64url");
  return `${p}.${sign(p)}`;
}
export function readStart(token: string): Start | null {
  const [p, sig] = token.split(".");
  if (!p || !sig) return null;
  const good = sign(p);
  if (good.length !== sig.length || !timingSafeEqual(Buffer.from(good), Buffer.from(sig))) return null;
  try { return JSON.parse(Buffer.from(p, "base64url").toString()) as Start; } catch { return null; }
}
