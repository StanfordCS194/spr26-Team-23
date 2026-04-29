interface VisibilityScoreCardProps {
  score: number;
  mentioned: number;
  total: number;
}

export function VisibilityScoreCard({ score, mentioned, total }: VisibilityScoreCardProps) {
  const tone = score >= 70 ? "text-emerald-600" : score >= 40 ? "text-sky-700" : "text-rose-600";
  const barTone = score >= 70 ? "bg-emerald-500" : score >= 40 ? "bg-sky-500" : "bg-rose-500";

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        Visibility Score
      </p>
      <p className={`mt-3 text-4xl font-semibold tracking-tight ${tone}`}>{score}%</p>
      <div className="mt-4 h-2 rounded-full bg-slate-100">
        <div
          className={`h-2 rounded-full ${barTone}`}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-500">
        Appeared in {mentioned} / {total} prompts.
      </p>
    </div>
  );
}
