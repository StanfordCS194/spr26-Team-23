"use client";

import { useState } from "react";
import { UserButton } from "@clerk/nextjs";
import { AIModel, AnalysisResponse, CompanyInput } from "@/types";
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
import { formatAuditedDate } from "@/lib/report-session";
import { VisibilityScoreCard } from "./VisibilityScoreCard";

const MODEL_LABELS: Record<AIModel, string> = {
  "gpt-4o": "GPT-4o",
  "claude": "Claude",
  "gemini": "Gemini",
};

interface TunnelDashboardProps {
  company: CompanyInput;
  data: AnalysisResponse;
  auditedAt?: string;
}

export function TunnelDashboard({ company, data, auditedAt }: TunnelDashboardProps) {
  const [activeModel, setActiveModel] = useState<AIModel | null>(
    data.models?.length ? data.models[0].model : null,
  );

  const activeModelData = data.models?.find((m) => m.model === activeModel) ?? null;
  const displayStats = activeModelData?.aggregateStats ?? data.aggregateStats;
  const displayAnalyses = activeModelData?.promptAnalyses ?? data.promptAnalyses;

  const topCompetitorLabel = displayStats.topCompetitor
    ? displayStats.topCompetitor.name
    : "-";
  const topCompetitorHelper = displayStats.topCompetitor
    ? `${displayStats.topCompetitor.mentions} mention${displayStats.topCompetitor.mentions === 1 ? "" : "s"} across prompts`
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
              <Link
                href="/reports"
                className="inline-flex items-center rounded-md border border-slate-200 bg-white/80 px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm backdrop-blur transition hover:border-slate-300 hover:bg-white hover:text-slate-950"
              >
                Report History
              </Link>
              <ExportButton />
              <LlmsTxtPanel company={company} data={data} />
              <div className="ml-auto">
                <UserButton />
              </div>
            </div>
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Tunnel report
                </p>
                {auditedAt ? (
                  <p className="mt-1 text-sm text-slate-500">
                    Audited {formatAuditedDate(auditedAt)}
                  </p>
                ) : null}
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

        {data.models && data.models.length > 1 && (
          <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 w-fit">
            {data.models.map((m) => (
              <button
                key={m.model}
                type="button"
                onClick={() => setActiveModel(m.model)}
                className={`rounded-md px-4 py-1.5 text-sm font-semibold transition ${
                  activeModel === m.model
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {MODEL_LABELS[m.model]}
              </button>
            ))}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <VisibilityScoreCard
            score={displayStats.visibilityScore}
            mentioned={displayStats.visibilityCount.mentioned}
            total={displayStats.visibilityCount.total}
          />
          <MetricCard
            label="Avg Rank"
            value={displayStats.averageRank ?? "-"}
            helper="Average position when mentioned"
          />
          <MetricCard
            label="Prompts Analyzed"
            value={displayAnalyses.length}
            helper="Total prompts evaluated"
          />
          <MetricCard
            label="Top Competitor"
            value={topCompetitorLabel}
            helper={topCompetitorHelper}
          />
        </section>

        <PositioningSummary stats={displayStats} />

        <section className="grid gap-5 md:grid-cols-2">
          <CategoryBreakdown visibilityByCategory={displayStats.visibilityByCategory} />
          <CompetitorComparison stats={displayStats} />
          <SentimentChart analyses={displayAnalyses} />
          <RankDistribution analyses={displayAnalyses} />
        </section>

        <MissedOpportunities stats={displayStats} />

        <PromptResultTable analyses={displayAnalyses} />

        <PossibleInaccuracies stats={displayStats} />

        <RecommendationsPanel stats={displayStats} />
      </div>
    </main>
  );
}
