import { AggregateStats } from "@/types";

interface RecommendationsPanelProps {
  stats: AggregateStats;
}

export function RecommendationsPanel({ stats }: RecommendationsPanelProps) {
  const recommendations: string[] = [];

  if (stats.visibilityByCategory.discovery < 35) {
    recommendations.push("You are not appearing in discovery prompts. Improve broad category messaging and SEO-style product descriptions.");
  }

  if (stats.visibilityByCategory.niche >= 50) {
    recommendations.push("You perform well in niche queries. Double down on this positioning in marketing copy.");
  }

  const topCompetitor = [...stats.shareOfVoice.competitors].sort((a, b) => b.share - a.share)[0];
  if (topCompetitor && topCompetitor.share > stats.shareOfVoice.target) {
    recommendations.push(`${topCompetitor.competitor} dominates comparison and recommendation surfaces. Create direct comparison pages and content.`);
  }

  if (recommendations.length === 0) {
    recommendations.push("Current visibility is stable. Keep improving differentiated use-case language.");
  }

  return (
    <section className="rounded-xl border border-blue-500/30 bg-slate-950/80 p-9 shadow-[0_0_30px_rgba(37,99,235,0.12)]">
      <h3 className="text-lg font-semibold text-blue-100">Recommendations</h3>
      <ul className="mt-4 space-y-4">
        {recommendations.map((rec) => (
          <li key={rec} className="rounded-lg bg-blue-500/10 p-4 text-lg text-blue-50">
            {rec}
          </li>
        ))}
      </ul>
    </section>
  );
}
