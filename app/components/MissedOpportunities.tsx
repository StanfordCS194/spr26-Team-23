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
    <section className="rounded-xl border border-blue-500/30 bg-slate-950/80 p-9 shadow-[0_0_30px_rgba(37,99,235,0.12)]">
      <h3 className="text-2xl font-semibold text-blue-100">Missed Opportunities</h3>
      <p className="mt-1 text-lg text-blue-100/85">
        Prompts where competitors appeared but your company did not. Highest-leverage targets.
      </p>

      <div className="mt-4 space-y-4">
        {stats.topMissedOpportunities.length === 0 ? (
          <p className="text-lg text-blue-100/90">No major misses found.</p>
        ) : (
          stats.topMissedOpportunities.map((item) => (
            <div
              key={item.promptId}
              className="rounded-lg border border-rose-300/40 bg-rose-500/10 p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-sm uppercase tracking-wide text-rose-100">
                  {CATEGORY_LABEL[item.category] ?? item.category}
                </span>
                <p className="text-lg text-blue-50">{item.prompt}</p>
              </div>
              <p className="mt-2 text-base text-rose-100/95">
                Competitors mentioned: {item.competitorMentions.join(", ") || "—"}
              </p>
              {item.explanation ? (
                <p className="mt-1 text-base text-blue-100/85">{item.explanation}</p>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
