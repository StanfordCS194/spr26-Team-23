import { PromptAnalysis } from "@/types";

interface RankDistributionProps {
  analyses: PromptAnalysis[];
}

export function RankDistribution({ analyses }: RankDistributionProps) {
  const mentioned = analyses.filter((a) => a.analysis.targetRank !== null);

  const counts: Record<number, number> = {};
  for (const a of mentioned) {
    const rank = a.analysis.targetRank!;
    counts[rank] = (counts[rank] ?? 0) + 1;
  }

  const maxRank = Math.max(...Object.keys(counts).map(Number), 0);
  const rows = Array.from({ length: maxRank }, (_, i) => ({
    rank: i + 1,
    count: counts[i + 1] ?? 0,
  }));

  const peak = Math.max(...rows.map((r) => r.count), 1);

  if (mentioned.length === 0) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <h3 className="text-xl font-semibold tracking-tight text-slate-950">
          Rank Distribution
        </h3>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          How often your company appeared at each position.
        </p>
        <p className="mt-5 text-sm text-slate-400">
          No ranked mentions found in this report.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <h3 className="text-xl font-semibold tracking-tight text-slate-950">
        Rank Distribution
      </h3>
      <p className="mt-1 text-sm leading-6 text-slate-500">
        How often your company appeared at each position across {mentioned.length} ranked mention{mentioned.length === 1 ? "" : "s"}.
      </p>
      <div className="mt-5 space-y-3">
        {rows.map(({ rank, count }) => (
          <div key={rank}>
            <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-slate-700">#{rank}</span>
              <span className="text-slate-500">{count} prompt{count === 1 ? "" : "s"}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full bg-violet-400"
                style={{ width: `${(count / peak) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
