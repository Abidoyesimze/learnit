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

/** Short-lived cache of user rows so auth does not cost a database round trip on every request. Cleared on any user write. */
export const userCache = new Map<string, { at: number; user: import("@prisma/client").User }>();

function create() {
  return new PrismaClient({ datasources: { db: { url: runtimeUrl() } } }).$extends({
    query: {
      user: {
        async $allOperations({ operation, args, query }) {
          const r = await query(args);
          if (/^(create|update|upsert|delete)/.test(operation)) userCache.clear();
          return r;
        },
      },
    },
  });
}

const g = globalThis as unknown as { prisma?: ReturnType<typeof create> };
export const db = g.prisma ?? create();
if (process.env.NODE_ENV !== "production") g.prisma = db;
