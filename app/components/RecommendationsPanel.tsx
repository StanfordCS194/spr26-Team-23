"use client";

import {
  AggregateStats,
  Recommendation,
  RecommendationPriority,
} from "@/types";
import { useState } from "react";

interface RecommendationsPanelProps {
  stats: AggregateStats;
}

const PRIORITY_TONE: Record<RecommendationPriority, string> = {
  critical: "border-rose-200 bg-rose-50 text-rose-700",
  high: "border-amber-200 bg-amber-50 text-amber-700",
  medium: "border-sky-200 bg-sky-50 text-sky-700",
  low: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

function promptAnchor(promptId: string): string {
  return `prompt-${promptId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function isRecommendation(value: unknown): value is Recommendation {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as Recommendation).title === "string" &&
      typeof (value as Recommendation).action === "string" &&
      Array.isArray((value as Recommendation).contentIdeas) &&
      Array.isArray((value as Recommendation).supportingPrompts),
  );
}

function normalizeRecommendation(value: unknown, index: number): Recommendation {
  if (isRecommendation(value)) return value;
  const text = typeof value === "string" ? value : "Review the prompt results for next steps.";
  return {
    id: `legacy-${index}`,
    title: text,
    priority: "medium",
    action: text,
    contentIdeas: [],
    supportingPrompts: [],
  };
}

function copyTextForRecommendation(rec: Recommendation): string {
  const ideas = rec.contentIdeas.length
    ? `\nContent ideas:\n${rec.contentIdeas.map((idea) => `- ${idea}`).join("\n")}`
    : "";
  const evidence = rec.supportingPrompts.length
    ? `\nEvidence:\n${rec.supportingPrompts
        .map((p) => `- ${p.prompt}: ${p.resultSummary}`)
        .join("\n")}`
    : "";

  return `[${rec.priority.toUpperCase()}] ${rec.title}\n${rec.action}${ideas}${evidence}`;
}

export function RecommendationsPanel({ stats }: RecommendationsPanelProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const recommendations = (stats.recommendations as unknown[]).map(normalizeRecommendation);

  const copyRec = (rec: Recommendation, index: number) => {
    navigator.clipboard.writeText(copyTextForRecommendation(rec)).then(() => {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1500);
    });
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <h3 className="text-xl font-semibold tracking-tight text-slate-950">
        Recommendations
      </h3>
      <ul className="mt-4 grid gap-3 md:grid-cols-2">
        {recommendations.map((rec, i) => (
          <li
            key={`${rec.id}-${i}`}
            className="group relative rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700"
          >
            <div className="flex flex-wrap items-center gap-2 pr-14">
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${PRIORITY_TONE[rec.priority]}`}
              >
                {rec.priority}
              </span>
              {rec.supportingPrompts.length > 0 ? (
                <span className="text-xs font-medium text-slate-500">
                  {rec.supportingPrompts.length} supporting prompt
                  {rec.supportingPrompts.length === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>
            <h4 className="mt-3 text-base font-semibold leading-6 text-slate-950">
              {rec.title}
            </h4>
            <p className="mt-1 leading-6 text-slate-700">{rec.action}</p>

            {rec.contentIdeas.length > 0 ? (
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Content ideas
                </p>
                <ul className="mt-1 space-y-1">
                  {rec.contentIdeas.slice(0, 3).map((idea) => (
                    <li key={idea} className="font-medium text-slate-800">
                      {idea}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {rec.supportingPrompts.length > 0 ? (
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Evidence
                </p>
                <div className="mt-2 space-y-2">
                  {rec.supportingPrompts.slice(0, 3).map((prompt) => (
                    <div key={prompt.promptId}>
                      <a
                        href={`#${promptAnchor(prompt.promptId)}`}
                        className="text-sm font-semibold text-slate-700 underline-offset-4 hover:text-slate-950 hover:underline"
                      >
                        {prompt.prompt}
                      </a>
                      <p className="mt-0.5 text-xs leading-5 text-slate-500">
                        Result: {prompt.resultSummary}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => copyRec(rec, i)}
              className="absolute right-3 top-3 rounded px-1.5 py-0.5 text-xs font-medium text-slate-400 opacity-0 transition hover:bg-slate-200 hover:text-slate-700 group-hover:opacity-100"
            >
              {copiedIndex === i ? "Copied!" : "Copy"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
