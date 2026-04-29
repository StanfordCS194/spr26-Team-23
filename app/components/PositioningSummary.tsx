import { AggregateStats } from "@/types";

interface PositioningSummaryProps {
  stats: AggregateStats;
}

export function PositioningSummary({ stats }: PositioningSummaryProps) {
  return (
    <section className="rounded-xl border border-blue-500/30 bg-slate-950/80 p-9 shadow-[0_0_30px_rgba(37,99,235,0.12)]">
      <h3 className="text-2xl font-semibold text-blue-100">AI Positioning Summary</h3>
      <p className="mt-3 text-lg leading-relaxed text-blue-50">
        {stats.aiPositioningSummary}
      </p>

      {stats.extractedDescriptions.length ? (
        <div className="mt-5 space-y-2">
          <p className="text-base text-blue-100/80">
            How AI tends to describe you when it does mention you:
          </p>
          <ul className="space-y-2">
            {stats.extractedDescriptions.map((desc) => (
              <li
                key={desc}
                className="rounded-lg border border-blue-500/25 bg-blue-500/10 p-3 text-base italic text-blue-50"
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
