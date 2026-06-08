import { PromptAnalysis, Sentiment } from "@/types";

interface SentimentChartProps {
  analyses: PromptAnalysis[];
}

const SENTIMENT_CONFIG: Record<Sentiment, { bar: string; label: string; text: string }> = {
  positive: { bar: "bg-emerald-500", label: "Positive", text: "text-emerald-700" },
  neutral: { bar: "bg-sky-400", label: "Neutral", text: "text-sky-700" },
  negative: { bar: "bg-rose-500", label: "Negative", text: "text-rose-700" },
  not_mentioned: { bar: "bg-slate-300", label: "Not Mentioned", text: "text-slate-500" },
};

const ORDER: Sentiment[] = ["positive", "neutral", "negative", "not_mentioned"];

export function SentimentChart({ analyses }: SentimentChartProps) {
  const counts: Record<Sentiment, number> = {
    positive: 0,
    neutral: 0,
    negative: 0,
    not_mentioned: 0,
  };

  for (const a of analyses) {
    counts[a.analysis.sentiment]++;
  }

  const total = analyses.length;

  const rows = ORDER.map((sentiment) => ({
    sentiment,
    count: counts[sentiment],
    percent: total > 0 ? Math.round((counts[sentiment] / total) * 100) : 0,
  }));

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <h3 className="text-xl font-semibold tracking-tight text-slate-950">
        Sentiment Breakdown
      </h3>
      <p className="mt-1 text-sm leading-6 text-slate-500">
        How AI responses felt about your company across all prompts.
      </p>
      <div className="mt-5 space-y-4">
        {rows.map(({ sentiment, count, percent }) => {
          const { bar, label, text } = SENTIMENT_CONFIG[sentiment];
          return (
            <div key={sentiment}>
              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                <span className={`font-medium ${text}`}>{label}</span>
                <span className="text-slate-500">
                  {count}/{total} &mdash; {percent}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div
                  className={`h-2 rounded-full transition-all ${bar}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
