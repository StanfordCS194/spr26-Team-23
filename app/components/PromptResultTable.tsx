"use client";

import { PromptAnalysis, Sentiment } from "@/types";
import { useState } from "react";
import { RawResponseViewer } from "./RawResponseViewer";

interface PromptResultTableProps {
  analyses: PromptAnalysis[];
}

const SENTIMENT_TONE: Record<Sentiment, string> = {
  positive: "bg-emerald-500/15 text-emerald-100",
  neutral: "bg-blue-500/15 text-blue-100",
  negative: "bg-rose-500/15 text-rose-100",
  not_mentioned: "bg-slate-500/20 text-slate-200",
};

const CATEGORY_LABEL: Record<string, string> = {
  discovery: "Discovery",
  comparison: "Comparison",
  use_case: "Use Case",
  niche: "Niche",
  purchase: "Purchase",
};

export function PromptResultTable({ analyses }: PromptResultTableProps) {
  const [openPromptId, setOpenPromptId] = useState<string | null>(null);

  return (
    <section className="rounded-xl border border-blue-500/30 bg-slate-950/80 p-9 shadow-[0_0_30px_rgba(37,99,235,0.12)]">
      <h3 className="text-3xl font-semibold text-blue-100">Prompt-by-Prompt Results</h3>
      <p className="mt-1 text-lg text-blue-100/85">
        How AI answered each prompt and how your company showed up.
      </p>

      <div className="mt-5 hidden grid-cols-12 gap-3 px-3 text-sm uppercase tracking-wide text-blue-100/70 md:grid">
        <span className="col-span-4">Prompt</span>
        <span className="col-span-2">Category</span>
        <span className="col-span-1">Appears</span>
        <span className="col-span-1">Rank</span>
        <span className="col-span-2">Competitors</span>
        <span className="col-span-2">Sentiment</span>
      </div>

      <div className="mt-3 space-y-3">
        {analyses.map((item) => {
          const isOpen = openPromptId === item.promptId;
          return (
            <div
              key={item.promptId}
              className={`rounded-lg border p-4 ${
                item.error
                  ? "border-rose-400/40 bg-rose-500/10"
                  : "border-blue-500/30 bg-slate-900/40"
              }`}
            >
              <div className="grid gap-3 text-base md:grid-cols-12 md:items-center">
                <div className="md:col-span-4">
                  <p className="text-lg text-blue-50">{item.prompt}</p>
                  {item.rationale ? (
                    <p className="mt-1 text-sm text-blue-100/70">{item.rationale}</p>
                  ) : null}
                </div>

                <p className="md:col-span-2 text-blue-100/95">
                  {CATEGORY_LABEL[item.category] ?? item.category}
                </p>

                <p className="md:col-span-1 text-blue-100">
                  {item.analysis.targetMentioned ? "✓" : "—"}
                </p>

                <p className="md:col-span-1 text-blue-100">
                  {item.analysis.targetRank ?? "—"}
                </p>

                <p className="md:col-span-2 text-blue-100/90">
                  {item.analysis.mentionedCompetitors.join(", ") || "—"}
                </p>

                <span
                  className={`md:col-span-2 inline-flex w-fit rounded-full px-3 py-1 text-sm font-medium capitalize ${SENTIMENT_TONE[item.analysis.sentiment]}`}
                >
                  {item.analysis.sentiment.replace("_", " ")}
                </span>
              </div>

              {item.analysis.explanation && !item.error ? (
                <p className="mt-3 text-base text-blue-100/85">
                  {item.analysis.explanation}
                </p>
              ) : null}

              {item.error ? (
                <p className="mt-3 text-base text-rose-100">
                  Error: {item.error}
                </p>
              ) : null}

              <button
                type="button"
                onClick={() => setOpenPromptId(isOpen ? null : item.promptId)}
                className="mt-3 text-sm font-medium text-blue-200 hover:text-blue-100"
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
