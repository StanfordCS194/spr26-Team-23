import { AggregateStats } from "@/types";

interface CompetitorComparisonProps {
  stats: AggregateStats;
}

export function CompetitorComparison({ stats }: CompetitorComparisonProps) {
  const targetShare = stats.shareOfVoice.target;
  const rows = [
    { label: "Your company", share: targetShare, mentions: stats.visibilityCount.mentioned, isTarget: true },
    ...stats.shareOfVoice.competitors.map((c) => ({
      label: c.competitor,
      share: c.share,
      mentions: c.mentions,
      isTarget: false,
    })),
  ].sort((a, b) => b.share - a.share);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <h3 className="text-xl font-semibold tracking-tight text-slate-950">
        Competitor Share of Voice
      </h3>
      <p className="mt-1 text-sm leading-6 text-slate-500">
        How often each company is mentioned across AI responses.
      </p>
      <div className="mt-5 space-y-4">
        {rows.map((row) => (
          <div key={row.label} className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className={row.isTarget ? "font-semibold text-emerald-700" : "font-medium text-slate-700"}>
                {row.label}
              </span>
              <span className="text-slate-500">
                {row.mentions} - {row.share}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div
                className={`h-2 rounded-full ${row.isTarget ? "bg-emerald-500" : "bg-slate-400"}`}
                style={{ width: `${Math.min(row.share, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
