import { AnalysisResponse, CompanyInput } from "@/types";
import Link from "next/link";
import { CategoryBreakdown } from "./CategoryBreakdown";
import { CompetitorComparison } from "./CompetitorComparison";
import { MetricCard } from "./MetricCard";
import { MissedOpportunities } from "./MissedOpportunities";
import { PositioningSummary } from "./PositioningSummary";
import { PossibleInaccuracies } from "./PossibleInaccuracies";
import { PromptResultTable } from "./PromptResultTable";
import { RecommendationsPanel } from "./RecommendationsPanel";
import { VisibilityScoreCard } from "./VisibilityScoreCard";

interface TunnelDashboardProps {
  company: CompanyInput;
  data: AnalysisResponse;
}

export function TunnelDashboard({ company, data }: TunnelDashboardProps) {
  const stats = data.aggregateStats;
  const topCompetitorLabel = stats.topCompetitor
    ? stats.topCompetitor.name
    : "—";
  const topCompetitorHelper = stats.topCompetitor
    ? `${stats.topCompetitor.mentions} mention${stats.topCompetitor.mentions === 1 ? "" : "s"} across prompts`
    : "No competitor mentions detected";

  return (
    <main className="min-h-screen px-4 py-8 md:px-10">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="rounded-2xl border border-blue-500/30 bg-slate-950/85 p-9 shadow-[0_0_35px_rgba(30,64,175,0.25)] backdrop-blur">
          <Link href="/" className="inline-flex items-center gap-1 text-base text-blue-300 hover:text-blue-100 mb-4">
            ← New Analysis
          </Link>
          <p className="text-lg uppercase tracking-[0.18em] text-blue-100/90">
            Tunnel Report
          </p>
          <div className="mt-1 flex items-center gap-4">
            {company.logoUrl && (
              <img
                src={company.logoUrl}
                alt=""
                width={56}
                height={56}
                className="rounded-xl"
              />
            )}
            <h1 className="text-5xl font-bold tracking-tight text-blue-100">
              {company.companyName}
            </h1>
          </div>
          <p className="mt-2 text-lg text-blue-100/90">See how AI sees you</p>
        </header>

        <section className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <VisibilityScoreCard
            score={stats.visibilityScore}
            mentioned={stats.visibilityCount.mentioned}
            total={stats.visibilityCount.total}
          />
          <MetricCard
            label="Avg Rank"
            value={stats.averageRank ?? "—"}
            helper="Average position when mentioned"
          />
          <MetricCard
            label="Prompts Analyzed"
            value={data.promptAnalyses.length}
            helper="Total prompts evaluated"
          />
          <MetricCard
            label="Top Competitor"
            value={topCompetitorLabel}
            helper={topCompetitorHelper}
          />
        </section>

        <PositioningSummary stats={stats} />

        <section className="grid gap-5 md:grid-cols-2">
          <CategoryBreakdown visibilityByCategory={stats.visibilityByCategory} />
          <CompetitorComparison stats={stats} />
        </section>

        <MissedOpportunities stats={stats} />

        <PromptResultTable analyses={data.promptAnalyses} />

        <PossibleInaccuracies stats={stats} />

        <RecommendationsPanel stats={stats} />
      </div>
    </main>
  );
}
