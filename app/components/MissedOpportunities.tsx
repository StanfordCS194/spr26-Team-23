import { AggregateStats } from "@/types";

interface MissedOpportunitiesProps {
  stats: AggregateStats;
}

export function MissedOpportunities({ stats }: MissedOpportunitiesProps) {
  return (
    <section className="rounded-xl border border-blue-500/30 bg-slate-950/80 p-9 shadow-[0_0_30px_rgba(37,99,235,0.12)]">
      <h3 className="text-lg font-semibold text-blue-100">Missed Opportunities</h3>
      <p className="mt-1 text-lg text-blue-100/95">
        Prompts where competitors appear but your company does not.
      </p>

      <div className="mt-4 space-y-4">
        {stats.topMissedOpportunities.length === 0 ? (
          <p className="text-lg text-blue-100/90">No major misses found.</p>
        ) : (
          stats.topMissedOpportunities.map((item) => (
            <div key={item.promptId} className="rounded-lg border border-rose-100 bg-rose-500/10 p-4">
              <p className="text-lg text-blue-100">{item.prompt}</p>
              <p className="mt-1 text-lg text-rose-200">
                Competitors: {item.competitorMentions.join(", ")}
              </p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
