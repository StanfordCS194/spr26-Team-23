import { AggregateStats } from "@/types";

const CATEGORY_LABEL: Record<string, string> = {
  discovery: "Discovery",
  comparison: "Comparison",
  use_case: "Use Case",
  niche: "Niche",
  purchase: "Purchase Intent",
};

interface MissedOpportunitiesProps {
  stats: AggregateStats;
}

export function MissedOpportunities({ stats }: MissedOpportunitiesProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <h3 className="text-xl font-semibold tracking-tight text-slate-950">
        Missed Opportunities
      </h3>
      <p className="mt-1 text-sm leading-6 text-slate-500">
        Prompts where competitors appeared but your company did not. Highest-leverage targets.
      </p>

      <div className="mt-4 space-y-4">
        {stats.topMissedOpportunities.length === 0 ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            No major misses found.
          </p>
        ) : (
          stats.topMissedOpportunities.map((item) => (
            <div
              key={item.promptId}
              className="rounded-md border border-rose-200 bg-rose-50 p-4"
            >
              <div className="flex flex-wrap items-start gap-2">
                <span className="rounded-full border border-rose-200 bg-white px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-rose-700">
                  {CATEGORY_LABEL[item.category] ?? item.category}
                </span>
                <p className="min-w-0 flex-1 text-sm font-medium leading-6 text-slate-900">
                  {item.prompt}
                </p>
              </div>
              <p className="mt-3 text-sm font-medium text-rose-700">
                Competitors mentioned: {item.competitorMentions.join(", ") || "-"}
              </p>
              {item.explanation ? (
                <p className="mt-1 text-sm leading-6 text-slate-600">{item.explanation}</p>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
