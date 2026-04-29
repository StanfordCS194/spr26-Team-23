import { AggregateStats } from "@/types";

interface PossibleInaccuraciesProps {
  stats: AggregateStats;
}

export function PossibleInaccuracies({ stats }: PossibleInaccuraciesProps) {
  if (stats.possibleInaccuracies.length === 0) return null;

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-sm md:p-6">
      <h3 className="text-xl font-semibold tracking-tight text-amber-950">
        Possible Inaccuracies
      </h3>
      <p className="mt-1 text-sm leading-6 text-amber-800">
        Statements in AI responses that may be incorrect or unverifiable. Worth fact-checking
        and addressing on your public-facing copy.
      </p>
      <ul className="mt-4 space-y-3">
        {stats.possibleInaccuracies.map((entry) => (
          <li
            key={entry.promptId}
            className="rounded-md border border-amber-200 bg-white p-4"
          >
            <p className="text-sm font-medium leading-6 text-slate-950">{entry.prompt}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-amber-800">
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
