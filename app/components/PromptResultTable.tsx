"use client";

import { PromptAnalysis, PromptCategory, Sentiment } from "@/types";
import { useMemo, useState } from "react";
import { RawResponseViewer } from "./RawResponseViewer";

interface PromptResultTableProps {
  analyses: PromptAnalysis[];
}

const SENTIMENT_TONE: Record<Sentiment, string> = {
  positive: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  neutral: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
  negative: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  not_mentioned: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
};

const CATEGORY_LABEL: Record<PromptCategory, string> = {
  discovery: "Discovery",
  comparison: "Comparison",
  use_case: "Use Case",
  niche: "Niche",
  purchase: "Purchase Intent",
};

const ALL_CATEGORIES: PromptCategory[] = ["discovery", "comparison", "use_case", "niche", "purchase"];
const ALL_SENTIMENTS: Sentiment[] = ["positive", "neutral", "negative", "not_mentioned"];
type MentionFilter = "all" | "mentioned" | "not_mentioned";
type CompetitorWinFilter = "all" | "won" | "not_won";
type QuickFilter = "missed" | "inaccuracies" | null;
type SortOption = "original" | "rank" | "category" | "visibility";

const selectClass =
  "w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100";

const quickButtonClass = (active: boolean) =>
  `rounded-md border px-3 py-1.5 text-sm font-medium shadow-sm transition ${
    active
      ? "border-sky-300 bg-sky-50 text-sky-700"
      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
  }`;

function visibilityOutcome(item: PromptAnalysis) {
  if (item.analysis.competitorWon) {
    return {
      label: "Competitor won",
      tone: "border-rose-200 bg-rose-50 text-rose-700",
      sortRank: 0,
    };
  }

  if (item.analysis.targetMentioned) {
    return {
      label: "Mentioned",
      tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
      sortRank: 1,
    };
  }

  return {
    label: "Not mentioned",
    tone: "border-slate-200 bg-slate-50 text-slate-600",
    sortRank: 2,
  };
}

function promptAnchor(promptId: string): string {
  return `prompt-${promptId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

export function PromptResultTable({ analyses }: PromptResultTableProps) {
  const [openPromptId, setOpenPromptId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<PromptCategory | "all">("all");
  const [filterMentioned, setFilterMentioned] = useState<MentionFilter>("all");
  const [filterSentiment, setFilterSentiment] = useState<Sentiment | "all">("all");
  const [filterCompetitorWon, setFilterCompetitorWon] = useState<CompetitorWinFilter>("all");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>(null);
  const [sortBy, setSortBy] = useState<SortOption>("original");
  const [searchQuery, setSearchQuery] = useState("");

  const query = searchQuery.trim().toLowerCase();

  const missedCount = analyses.filter((a) => a.analysis.competitorWon).length;
  const inaccuraciesCount = analyses.filter(
    (a) => a.analysis.possibleInaccuracies.length > 0,
  ).length;

  const sorted = useMemo(() => {
    const filtered = analyses
      .filter((a) => filterCategory === "all" || a.category === filterCategory)
      .filter((a) => {
        if (filterMentioned === "mentioned") return a.analysis.targetMentioned;
        if (filterMentioned === "not_mentioned") return !a.analysis.targetMentioned;
        return true;
      })
      .filter((a) => filterSentiment === "all" || a.analysis.sentiment === filterSentiment)
      .filter((a) => {
        if (filterCompetitorWon === "won") return a.analysis.competitorWon;
        if (filterCompetitorWon === "not_won") return !a.analysis.competitorWon;
        return true;
      })
      .filter((a) => {
        if (quickFilter === "missed") return a.analysis.competitorWon;
        if (quickFilter === "inaccuracies") return a.analysis.possibleInaccuracies.length > 0;
        return true;
      })
      .filter((a) => {
        if (!query) return true;
        const searchable = [
          a.prompt,
          a.response,
          a.rationale,
          a.analysis.explanation,
          a.analysis.targetDescription,
          a.analysis.usefulQuote,
          a.analysis.mentionedCompetitors.join(" "),
          a.analysis.allMentionedCompanies.join(" "),
          a.analysis.possibleInaccuracies.join(" "),
        ];
        return searchable.some((value) => value.toLowerCase().includes(query));
      });

    return filtered
      .map((item, index) => ({ item, index }))
      .sort((a, b) => {
        if (sortBy === "rank") {
          const rankA = a.item.analysis.targetRank ?? Number.POSITIVE_INFINITY;
          const rankB = b.item.analysis.targetRank ?? Number.POSITIVE_INFINITY;
          if (rankA !== rankB) return rankA - rankB;
        }

        if (sortBy === "category") {
          const categoryA = ALL_CATEGORIES.indexOf(a.item.category);
          const categoryB = ALL_CATEGORIES.indexOf(b.item.category);
          if (categoryA !== categoryB) return categoryA - categoryB;
        }

        if (sortBy === "visibility") {
          const outcomeA = visibilityOutcome(a.item).sortRank;
          const outcomeB = visibilityOutcome(b.item).sortRank;
          if (outcomeA !== outcomeB) return outcomeA - outcomeB;
        }

        return a.index - b.index;
      })
      .map(({ item }) => item);
  }, [
    analyses,
    filterCategory,
    filterCompetitorWon,
    filterMentioned,
    filterSentiment,
    query,
    quickFilter,
    sortBy,
  ]);

  const hasFilters =
    filterCategory !== "all" ||
    filterMentioned !== "all" ||
    filterSentiment !== "all" ||
    filterCompetitorWon !== "all" ||
    quickFilter !== null ||
    sortBy !== "original" ||
    searchQuery !== "";

  const clearFilters = () => {
    setFilterCategory("all");
    setFilterMentioned("all");
    setFilterSentiment("all");
    setFilterCompetitorWon("all");
    setQuickFilter(null);
    setSortBy("original");
    setSearchQuery("");
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-xl font-semibold tracking-tight text-slate-950">
            Prompt-by-Prompt Results
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            How AI answered each prompt and how your company showed up.
          </p>
        </div>
        <span className="w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-600">
          {sorted.length === analyses.length
            ? `${analyses.length} prompts`
            : `${sorted.length} of ${analyses.length} prompts`}
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <input
          type="text"
          placeholder="Search prompts and responses..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={quickFilter === "missed"}
            onClick={() => setQuickFilter((v) => (v === "missed" ? null : "missed"))}
            className={quickButtonClass(quickFilter === "missed")}
          >
            Missed opportunities ({missedCount})
          </button>
          <button
            type="button"
            aria-pressed={quickFilter === "inaccuracies"}
            onClick={() =>
              setQuickFilter((v) => (v === "inaccuracies" ? null : "inaccuracies"))
            }
            className={quickButtonClass(quickFilter === "inaccuracies")}
          >
            Possible inaccuracies ({inaccuraciesCount})
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <label>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Category
          </span>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as PromptCategory | "all")}
            className={selectClass}
          >
            <option value="all">All categories</option>
            {ALL_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Mentioned
          </span>
          <select
            value={filterMentioned}
            onChange={(e) => setFilterMentioned(e.target.value as MentionFilter)}
            className={selectClass}
          >
            <option value="all">Mentioned or not</option>
            <option value="mentioned">Mentioned</option>
            <option value="not_mentioned">Not mentioned</option>
          </select>
        </label>

        <label>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Sentiment
          </span>
          <select
            value={filterSentiment}
            onChange={(e) => setFilterSentiment(e.target.value as Sentiment | "all")}
            className={selectClass}
          >
            <option value="all">All sentiments</option>
            {ALL_SENTIMENTS.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Competitor
          </span>
          <select
            value={filterCompetitorWon}
            onChange={(e) => setFilterCompetitorWon(e.target.value as CompetitorWinFilter)}
            className={selectClass}
          >
            <option value="all">Any outcome</option>
            <option value="won">Competitor won</option>
            <option value="not_won">No competitor win</option>
          </select>
        </label>

        <label>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Sort
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className={selectClass}
          >
            <option value="original">Original order</option>
            <option value="rank">Rank</option>
            <option value="category">Category</option>
            <option value="visibility">Visibility outcome</option>
          </select>
        </label>
      </div>

      <div className="mt-2 flex min-h-6 items-center">
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm font-medium text-slate-500 underline-offset-4 hover:text-slate-800 hover:underline"
          >
            Clear
          </button>
        )}
      </div>

      <div className="mt-5 hidden grid-cols-12 gap-3 border-b border-slate-200 px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid">
        <span className="col-span-4">Prompt</span>
        <span className="col-span-1">Category</span>
        <span className="col-span-2">Outcome</span>
        <span className="col-span-1">Rank</span>
        <span className="col-span-2">Competitors</span>
        <span className="col-span-2">Sentiment</span>
      </div>

      <div className="divide-y divide-slate-200">
        {sorted.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-400">
            No prompts match the selected filters.
          </p>
        )}
        {sorted.map((item) => {
          const isOpen = openPromptId === item.promptId;
          const outcome = visibilityOutcome(item);
          return (
            <div
              key={item.promptId}
              id={promptAnchor(item.promptId)}
              className={`scroll-mt-4 py-4 ${
                item.error
                  ? "rounded-md border border-rose-200 bg-rose-50 px-3"
                  : ""
              }`}
            >
              <div className="grid gap-3 text-sm md:grid-cols-12 md:items-start">
                <div className="md:col-span-4">
                  <p className="font-medium leading-6 text-slate-950">{item.prompt}</p>
                  {item.rationale ? (
                    <p className="mt-1 leading-6 text-slate-500">{item.rationale}</p>
                  ) : null}
                </div>

                <p className="text-slate-600 md:col-span-1">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400 md:hidden">
                    Category
                  </span>
                  {CATEGORY_LABEL[item.category]}
                </p>

                <div className="md:col-span-2">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400 md:hidden">
                    Outcome
                  </span>
                  <span
                    className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${outcome.tone}`}
                  >
                    {outcome.label}
                  </span>
                </div>

                <p className="md:col-span-1 text-slate-700">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400 md:hidden">
                    Rank
                  </span>
                  {item.analysis.targetRank ?? "-"}
                </p>

                <p className="md:col-span-2 leading-6 text-slate-600">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400 md:hidden">
                    Competitors
                  </span>
                  {item.analysis.mentionedCompetitors.join(", ") || "-"}
                </p>

                <div className="md:col-span-2">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400 md:hidden">
                    Sentiment
                  </span>
                  <span
                    className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${SENTIMENT_TONE[item.analysis.sentiment]}`}
                  >
                    {item.analysis.sentiment.replace("_", " ")}
                  </span>
                </div>
              </div>

              {item.analysis.explanation && !item.error ? (
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {item.analysis.explanation}
                </p>
              ) : null}

              {item.analysis.possibleInaccuracies.length > 0 ? (
                <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-sm font-semibold text-amber-900">
                    Possible inaccuracies
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-6 text-amber-800">
                    {item.analysis.possibleInaccuracies.map((inaccuracy) => (
                      <li key={inaccuracy}>{inaccuracy}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {item.error ? (
                <p className="mt-3 text-sm font-medium text-rose-700">
                  Error: {item.error}
                </p>
              ) : null}

              <button
                type="button"
                onClick={() => setOpenPromptId(isOpen ? null : item.promptId)}
                className="mt-3 text-sm font-semibold text-slate-600 underline-offset-4 hover:text-slate-950 hover:underline"
              >
                {isOpen ? "Hide raw response" : "Show raw response"}
              </button>

              {isOpen && item.response ? (
                <RawResponseViewer response={item.response} />
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
