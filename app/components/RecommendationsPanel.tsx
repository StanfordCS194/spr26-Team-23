"use client";

import { AggregateStats } from "@/types";
import { useState } from "react";

interface RecommendationsPanelProps {
  stats: AggregateStats;
}

export function RecommendationsPanel({ stats }: RecommendationsPanelProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyRec = (text: string, index: number) => {
    navigator.clipboard.writeText(text).then(() => {
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
        {stats.recommendations.map((rec, i) => (
          <li
            key={rec}
            className="group relative rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700"
          >
            {rec}
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
