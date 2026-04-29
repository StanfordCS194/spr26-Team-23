import { AggregateStats } from "@/types";

interface PositioningSummaryProps {
  stats: AggregateStats;
}

export function PositioningSummary({ stats }: PositioningSummaryProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <h3 className="text-xl font-semibold tracking-tight text-slate-950">
        AI Positioning Summary
      </h3>
      <p className="mt-3 text-base leading-7 text-slate-700">
        {stats.aiPositioningSummary}
      </p>

      {stats.extractedDescriptions.length ? (
        <div className="mt-5 space-y-3 border-t border-slate-200 pt-5">
          <p className="text-sm font-medium text-slate-500">
            How AI tends to describe you when it does mention you:
          </p>
          <ul className="space-y-2">
            {stats.extractedDescriptions.map((desc) => (
              <li
                key={desc}
                className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm italic leading-6 text-slate-700"
              >
                &ldquo;{desc}&rdquo;
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
