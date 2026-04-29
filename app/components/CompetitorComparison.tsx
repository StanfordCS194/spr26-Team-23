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
    <section className="rounded-xl border border-blue-500/30 bg-slate-950/80 p-9 shadow-[0_0_30px_rgba(37,99,235,0.12)]">
      <h3 className="text-2xl font-semibold text-blue-100">Competitor Share of Voice</h3>
      <p className="mt-1 text-lg text-blue-100/85">
        How often each company is mentioned across AI responses.
      </p>
      <div className="mt-5 space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="space-y-1">
            <div className="flex items-center justify-between text-lg">
              <span className={row.isTarget ? "font-semibold text-cyan-200" : "text-blue-50"}>
                {row.label}
              </span>
              <span className="text-blue-100/95">
                {row.mentions} · {row.share}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-blue-950">
              <div
                className={`h-2 rounded-full ${row.isTarget ? "bg-cyan-400" : "bg-blue-400"}`}
                style={{ width: `${Math.min(row.share, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
