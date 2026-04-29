import { AggregateStats } from "@/types";

interface RecommendationsPanelProps {
  stats: AggregateStats;
}

export function RecommendationsPanel({ stats }: RecommendationsPanelProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <h3 className="text-xl font-semibold tracking-tight text-slate-950">
        Recommendations
      </h3>
      <ul className="mt-4 grid gap-3 md:grid-cols-2">
        {stats.recommendations.map((rec) => (
          <li
            key={rec}
            className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700"
          >
            {rec}
          </li>
        ))}
      </ul>
    </section>
  );
}
