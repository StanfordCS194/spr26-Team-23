"use client";

import { PromptAnalysis } from "@/types";
import { useState } from "react";
import { RawResponseViewer } from "./RawResponseViewer";

interface PromptResultTableProps {
  analyses: PromptAnalysis[];
}

export function PromptResultTable({ analyses }: PromptResultTableProps) {
  const [openPromptId, setOpenPromptId] = useState<string | null>(null);

  return (
    <section className="rounded-xl border border-blue-500/30 bg-slate-950/80 p-9 shadow-[0_0_30px_rgba(37,99,235,0.12)]">
      <h3 className="text-3xl font-semibold text-blue-100">Prompt Results</h3>
      <div className="mt-4 space-y-4">
        {analyses.map((item) => {
          const isOpen = openPromptId === item.promptId;
          return (
            <div key={item.promptId} className="rounded-lg border border-blue-500/30 p-4">
              <div className="grid gap-3 text-lg md:grid-cols-6 md:items-center">
                <p className="md:col-span-2 text-blue-100">{item.prompt}</p>
                <p className="capitalize text-blue-100/95">{item.category.replace("_", " ")}</p>
                <p>{item.analysis.targetMentioned ? "✓" : "✗"}</p>
                <p>{item.analysis.targetRank ?? "-"}</p>
                <p className="text-blue-100/90">{item.analysis.mentionedCompetitors.join(", ") || "-"}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpenPromptId(isOpen ? null : item.promptId)}
                className="mt-2 text-base font-medium text-blue-100/90 hover:text-blue-100"
              >
                {isOpen ? "Hide raw response" : "Show raw response"}
              </button>
              {isOpen ? <RawResponseViewer response={item.response} /> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
