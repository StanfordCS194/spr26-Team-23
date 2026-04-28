import { AnalysisResponse, CompanyInput } from "@/types";
import { CategoryBreakdown } from "./CategoryBreakdown";
import { CompetitorComparison } from "./CompetitorComparison";
import { MetricCard } from "./MetricCard";
import { MissedOpportunities } from "./MissedOpportunities";
import { PromptResultTable } from "./PromptResultTable";
import { RecommendationsPanel } from "./RecommendationsPanel";
import { VisibilityScoreCard } from "./VisibilityScoreCard";

interface TunnelDashboardProps {
  company: CompanyInput;
  data: AnalysisResponse;
}

export function TunnelDashboard({ company, data }: TunnelDashboardProps) {
  const stats = data.aggregateStats;

  return (
    <main className="min-h-screen px-4 py-8 md:px-10">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="rounded-2xl border border-blue-500/30 bg-slate-950/85 p-9 shadow-[0_0_35px_rgba(30,64,175,0.25)] backdrop-blur">
          <p className="text-lg uppercase tracking-[0.18em] text-blue-100/90">Tunnel Report</p>
          <h1 className="mt-1 text-5xl font-bold tracking-tight text-blue-100">{company.companyName} Tunnel Report</h1>
          <p className="mt-2 text-blue-100">See how AI sees you</p>
        </header>

        <section className="grid gap-5 md:grid-cols-3">
          <VisibilityScoreCard score={stats.visibilityScore} />
          <MetricCard label="Avg Rank" value={stats.averageRank ?? "-"} helper="Average position when mentioned" />
          <MetricCard label="# Prompts Analyzed" value={data.promptAnalyses.length} helper="Total evaluated prompts" />
        </section>

        <section className="grid gap-5 md:grid-cols-2">
          <CategoryBreakdown visibilityByCategory={stats.visibilityByCategory} />
          <CompetitorComparison stats={stats} />
        </section>

        <PromptResultTable analyses={data.promptAnalyses} />

        <section className="grid gap-5 md:grid-cols-2">
          <MissedOpportunities stats={stats} />
          <RecommendationsPanel stats={stats} />
        </section>
      </div>
    </main>
  );
}
