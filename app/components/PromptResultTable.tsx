"use client";

import { PromptAnalysis, PromptCategory, Sentiment } from "@/types";
import { useState } from "react";
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

const CATEGORY_LABEL: Record<string, string> = {
  discovery: "Discovery",
  comparison: "Comparison",
  use_case: "Use Case",
  niche: "Niche",
  purchase: "Purchase",
};

const ALL_CATEGORIES: PromptCategory[] = ["discovery", "comparison", "use_case", "niche", "purchase"];
const ALL_SENTIMENTS: Sentiment[] = ["positive", "neutral", "negative", "not_mentioned"];

const selectClass =
  "rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100";

function promptAnchor(promptId: string): string {
  return `prompt-${promptId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

export function PromptResultTable({ analyses }: PromptResultTableProps) {
  const [openPromptId, setOpenPromptId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<PromptCategory | "all">("all");
  const [filterSentiment, setFilterSentiment] = useState<Sentiment | "all">("all");
  const [sortByRank, setSortByRank] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const query = searchQuery.trim().toLowerCase();

  const filtered = analyses
    .filter((a) => filterCategory === "all" || a.category === filterCategory)
    .filter((a) => filterSentiment === "all" || a.analysis.sentiment === filterSentiment)
    .filter((a) => !query || a.prompt.toLowerCase().includes(query));

  const sorted = sortByRank
    ? [...filtered].sort((a, b) => {
        const ra = a.analysis.targetRank ?? Infinity;
        const rb = b.analysis.targetRank ?? Infinity;
        return ra - rb;
      })
    : filtered;

  const hasFilters = filterCategory !== "all" || filterSentiment !== "all" || sortByRank || searchQuery !== "";

  const clearFilters = () => {
    setFilterCategory("all");
    setFilterSentiment("all");
    setSortByRank(false);
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

      <div className="mt-4">
        <input
          type="text"
          placeholder="Search prompts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value as PromptCategory | "all")}
          className={selectClass}
        >
          <option value="all">All categories</option>
          {ALL_CATEGORIES.map((c) => (
            <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
          ))}
        </select>

        <select
          value={filterSentiment}
          onChange={(e) => setFilterSentiment(e.target.value as Sentiment | "all")}
          className={selectClass}
        >
          <option value="all">All sentiments</option>
          {ALL_SENTIMENTS.map((s) => (
            <option key={s} value={s}>{s.replace("_", " ")}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setSortByRank((v) => !v)}
          className={`rounded-md border px-3 py-1.5 text-sm font-medium shadow-sm transition ${
            sortByRank
              ? "border-sky-300 bg-sky-50 text-sky-700"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          Sort by rank
        </button>

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
        <span className="col-span-2">Category</span>
        <span className="col-span-1">Appears</span>
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

                <p className="md:col-span-2 text-slate-600">
                  {CATEGORY_LABEL[item.category] ?? item.category}
                </p>

                <p className="md:col-span-1 text-slate-700">
                  {item.analysis.targetMentioned ? "Yes" : "No"}
                </p>

                <p className="md:col-span-1 text-slate-700">
                  {item.analysis.targetRank ?? "-"}
                </p>

                <p className="md:col-span-2 leading-6 text-slate-600">
                  {item.analysis.mentionedCompetitors.join(", ") || "-"}
                </p>

                <span
                  className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold capitalize md:col-span-2 ${SENTIMENT_TONE[item.analysis.sentiment]}`}
                >
                  {item.analysis.sentiment.replace("_", " ")}
                </span>
              </div>

              {item.analysis.explanation && !item.error ? (
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {item.analysis.explanation}
                </p>
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
