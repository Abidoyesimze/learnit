// Measures Neon latency: first connection vs steady-state queries. Run: npm run latency -w @learnit/backend
import { db } from "../src/db";
const t = async (label: string, fn: () => Promise<unknown>) => { const s = performance.now(); await fn(); console.log(label.padEnd(34), Math.round(performance.now() - s) + " ms"); };
await t("1st query (new connection)", () => db.$queryRaw`SELECT 1`);
for (let i = 2; i <= 5; i++) await t(`query ${i} (warm)`, () => db.$queryRaw`SELECT 1`);
await t("user.findUnique (warm)", () => db.user.findFirst());
await t("10 parallel queries", () => Promise.all(Array.from({ length: 10 }, () => db.$queryRaw`SELECT 1`)));
await db.$disconnect();
