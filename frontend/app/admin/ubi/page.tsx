"use client";
import { Coins, Download } from "lucide-react";
import { fmtGD } from "@learnit/backend/format";
import { Button, Card, CardHeader, EmptyState, PageHeader, Stat } from "@/components/ui";
import { Sk } from "@/components/ui/Sk";
import { usePublicStats, type UbiDay } from "@/components/admin/data";
import { DayBars, ErrorNote, fillDays } from "@/components/admin/bits";

const label = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" });

function csv(days: UbiDay[]) {
  const rows = ["date_utc,claims,people,g_dollars", ...days.map((d) => `${d.day},${d.claims},${d.claimers},${(Number(BigInt(d.total) / 10n ** 14n) / 10_000).toFixed(4)}`)];
  const url = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url; a.download = "learnit-ubi-claims.csv"; a.click();
  URL.revokeObjectURL(url);
}

export default function Ubi() {
  const { data, isLoading, error } = usePublicStats();
  const ubi = data?.ubi;
  const days = ubi ? fillDays(ubi.days, 30) : [];
  const total30 = days.reduce((s, d) => s + BigInt(d.total), 0n);
  const active = days.filter((d) => d.claims > 0).length;

  return (
    <div className="grid gap-8">
      <PageHeader title="UBI claims" description="G$ claimed through LearnIt, by UTC day. Claims made in other apps are not counted. Totals only: no names or wallets."
        action={ubi && <Button variant="outline" size="sm" icon={Download} onClick={() => csv(ubi.days)}>Export CSV</Button>} />

      <ErrorNote error={error} />
      {isLoading && <Card className="grid gap-4 p-6"><Sk className="h-6 w-40" /><Sk className="h-32" /></Card>}

      {ubi && (
        <>
          <Card className="grid gap-6 p-6 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Today" value={fmtGD(ubi.today.total)} unit="G$" hint={`${ubi.today.claims} claims, ${ubi.today.claimers} people`} />
            <Stat label="Last 30 days" value={fmtGD(total30)} unit="G$" hint={`${active} active days`} />
            <Stat label="All time" value={fmtGD(ubi.allTime.total)} unit="G$" hint={`${ubi.allTime.claims} claims`} />
            <Stat label="People who claimed" value={ubi.allTime.claimers.toLocaleString("en")} hint="All time" />
          </Card>

          <Card className="p-6">
            <CardHeader title="Last 30 days" description="G$ claimed per day." />
            <div className="mt-5">
              <DayBars values={days.map((d) => BigInt(d.total))} labels={days.map((d) => label(d.day))} format={(v) => fmtGD(v)} />
            </div>
          </Card>

          {ubi.allTime.claims === 0 ? (
            <EmptyState icon={Coins} title="No claims recorded yet">Claims appear here after someone claims from the LearnIt home screen.</EmptyState>
          ) : (
            <Card className="overflow-hidden">
              <table className="tabular w-full text-left text-sm">
                <caption className="sr-only">G$ claimed per UTC day, last 30 days</caption>
                <thead className="border-b border-line bg-sunken/60 text-xs text-muted">
                  <tr><th scope="col" className="px-5 py-3 font-medium">Day</th><th scope="col" className="px-3 py-3 text-right font-medium">Claims</th><th scope="col" className="px-3 py-3 text-right font-medium">People</th><th scope="col" className="px-5 py-3 text-right font-medium">G$</th></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {[...days].reverse().map((d) => (
                    <tr key={d.day} className={d.claims === 0 ? "text-muted" : "text-ink"}>
                      <th scope="row" className="px-5 py-2.5 font-medium">{label(d.day)}</th>
                      <td className="px-3 py-2.5 text-right">{d.claims}</td>
                      <td className="px-3 py-2.5 text-right">{d.claimers}</td>
                      <td className="px-5 py-2.5 text-right font-medium">{fmtGD(d.total, 2, false)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
          <p className="text-xs text-muted">Updated {new Date(data!.generatedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}. Refreshes every few minutes.</p>
        </>
      )}
    </div>
  );
}
