import { PrismaClient } from "@prisma/client";

/**
 * Neon's pooled URL goes through PgBouncer (transaction mode), so Prisma needs pgbouncer=true.
 * Connections can take several seconds to open (idle compute waking up, slow links), and Prisma's
 * defaults (5s connect, 10s pool) are too tight, so widen them.
 */
function runtimeUrl() {
  const u = process.env.DATABASE_URL;
  if (!u) return u;
  const add: string[] = [];
  if (u.includes("-pooler") && !u.includes("pgbouncer=")) add.push("pgbouncer=true");
  if (!u.includes("connect_timeout=")) add.push("connect_timeout=30");
  if (!u.includes("pool_timeout=")) add.push("pool_timeout=30");
  return add.length ? u + (u.includes("?") ? "&" : "?") + add.join("&") : u;
}

const g = globalThis as unknown as { prisma?: PrismaClient };
export const db = g.prisma ?? new PrismaClient({ datasources: { db: { url: runtimeUrl() } } });
if (process.env.NODE_ENV !== "production") g.prisma = db;
