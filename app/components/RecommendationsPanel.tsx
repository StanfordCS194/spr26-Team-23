import { AggregateStats } from "@/types";

interface RecommendationsPanelProps {
  stats: AggregateStats;
}

export function RecommendationsPanel({ stats }: RecommendationsPanelProps) {
  return (
    <section className="rounded-xl border border-blue-500/30 bg-slate-950/80 p-9 shadow-[0_0_30px_rgba(37,99,235,0.12)]">
      <h3 className="text-2xl font-semibold text-blue-100">Recommendations</h3>
      <ul className="mt-4 space-y-4">
        {stats.recommendations.map((rec) => (
          <li
            key={rec}
            className="rounded-lg border border-blue-500/25 bg-blue-500/10 p-4 text-lg text-blue-50"
          >
            {rec}
          </li>
        ))}
      </ul>
    </section>
  );
}
