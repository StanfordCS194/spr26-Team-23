import { AnalysisResponse, CompanyInput } from "@/types";
import Image from "next/image";
import Link from "next/link";
import { ExportButton } from "./ExportButton";
import { LlmsTxtPanel } from "./LlmsTxtPanel";
import { CategoryBreakdown } from "./CategoryBreakdown";
import { CompetitorComparison } from "./CompetitorComparison";
import { SentimentChart } from "./SentimentChart";
import { RankDistribution } from "./RankDistribution";
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
    : "-";
  const topCompetitorHelper = stats.topCompetitor
    ? `${stats.topCompetitor.mentions} mention${stats.topCompetitor.mentions === 1 ? "" : "s"} across prompts`
    : "No competitor mentions detected";

  return (
    <main className="min-h-screen px-5 py-6 text-slate-950 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="tunnel-report-header rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="relative z-10">
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <Link
                href="/"
                className="inline-flex items-center rounded-md border border-slate-200 bg-white/80 px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm backdrop-blur transition hover:border-slate-300 hover:bg-white hover:text-slate-950"
              >
                &lt;- New Analysis
              </Link>
              <ExportButton />
              <LlmsTxtPanel company={company} data={data} />
            </div>
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Tunnel report
                </p>
                <div className="mt-3 flex items-start gap-4">
                  {company.logoUrl && (
                    <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm">
                      <Image
                        src={company.logoUrl}
                        alt=""
                        width={32}
                        height={32}
                        unoptimized
                        className="rounded-sm"
                      />
                    </span>
                  )}
                  <div>
                    <h1 className="text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl">
                      {company.companyName}
                    </h1>
                    <p className="mt-2 max-w-3xl text-base text-slate-600">
                      {company.description}
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-600 shadow-sm backdrop-blur">
                <p className="font-medium text-slate-950">{company.website}</p>
                <p>{company.category}</p>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <VisibilityScoreCard
            score={stats.visibilityScore}
            mentioned={stats.visibilityCount.mentioned}
            total={stats.visibilityCount.total}
          />
          <MetricCard
            label="Avg Rank"
            value={stats.averageRank ?? "-"}
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
          <SentimentChart analyses={data.promptAnalyses} />
          <RankDistribution analyses={data.promptAnalyses} />
        </section>

        <MissedOpportunities stats={stats} />

        <PromptResultTable analyses={data.promptAnalyses} />

        <PossibleInaccuracies stats={stats} />

        <RecommendationsPanel stats={stats} />
      </div>
    </main>
  );
}
