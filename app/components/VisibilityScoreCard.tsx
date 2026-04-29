interface VisibilityScoreCardProps {
  score: number;
  mentioned: number;
  total: number;
}

export function VisibilityScoreCard({ score, mentioned, total }: VisibilityScoreCardProps) {
  const tone = score >= 70 ? "text-cyan-300" : score >= 40 ? "text-blue-300" : "text-rose-300";

  return (
    <div className="rounded-xl border border-blue-500/30 bg-slate-950/80 p-9 shadow-[0_0_30px_rgba(37,99,235,0.12)]">
      <p className="text-lg text-blue-50">Visibility Score</p>
      <p className={`mt-2 text-5xl font-bold ${tone}`}>{score}%</p>
      <p className="mt-2 text-lg text-blue-100/95">
        Appeared in {mentioned} / {total} prompts.
      </p>
    </div>
  );
}
