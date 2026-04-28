import { AggregateStats } from "@/types";

interface CompetitorComparisonProps {
  stats: AggregateStats;
}

export function CompetitorComparison({ stats }: CompetitorComparisonProps) {
  return (
    <section className="rounded-xl border border-blue-500/30 bg-slate-950/80 p-9 shadow-[0_0_30px_rgba(37,99,235,0.12)]">
      <h3 className="text-lg font-semibold text-blue-100">Competitor Comparison</h3>
      <p className="mt-1 text-lg text-blue-100/95">Share of voice in responses</p>
      <div className="mt-4 space-y-4">
        <div className="flex items-center justify-between rounded-lg bg-blue-500/10 px-4 py-3 text-lg">
          <span className="font-medium text-blue-50">Your company</span>
          <span className="font-semibold text-blue-100">{stats.shareOfVoice.target}%</span>
        </div>
        {stats.shareOfVoice.competitors.map((competitor) => (
          <div key={competitor.competitor} className="flex items-center justify-between rounded-lg bg-blue-500/10 px-4 py-3 text-lg">
            <span className="text-blue-50">{competitor.competitor}</span>
            <span className="font-semibold text-blue-100">{competitor.share}%</span>
          </div>
        ))}
      </div>
    </section>
  );
}
