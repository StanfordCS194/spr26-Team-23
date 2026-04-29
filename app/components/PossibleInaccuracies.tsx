import { AggregateStats } from "@/types";

interface PossibleInaccuraciesProps {
  stats: AggregateStats;
}

export function PossibleInaccuracies({ stats }: PossibleInaccuraciesProps) {
  if (stats.possibleInaccuracies.length === 0) return null;

  return (
    <section className="rounded-xl border border-amber-300/40 bg-amber-500/10 p-9 shadow-[0_0_30px_rgba(245,158,11,0.15)]">
      <h3 className="text-2xl font-semibold text-amber-100">Possible Inaccuracies</h3>
      <p className="mt-1 text-base text-amber-100/85">
        Statements in AI responses that may be incorrect or unverifiable. Worth fact-checking
        and addressing on your public-facing copy.
      </p>
      <ul className="mt-4 space-y-3">
        {stats.possibleInaccuracies.map((entry) => (
          <li
            key={entry.promptId}
            className="rounded-lg border border-amber-300/20 bg-amber-500/15 p-4"
          >
            <p className="text-base font-medium text-amber-50">{entry.prompt}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-100/95">
              {entry.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
