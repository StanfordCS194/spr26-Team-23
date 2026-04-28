import { PromptCategory } from "@/types";

interface CategoryBreakdownProps {
  visibilityByCategory: Record<PromptCategory, number>;
}

export function CategoryBreakdown({ visibilityByCategory }: CategoryBreakdownProps) {
  return (
    <section className="rounded-xl border border-blue-500/30 bg-slate-950/80 p-9 shadow-[0_0_30px_rgba(37,99,235,0.12)]">
      <h3 className="text-lg font-semibold text-blue-100">Visibility by Category</h3>
      <div className="mt-4 space-y-4">
        {Object.entries(visibilityByCategory).map(([category, score]) => (
          <div key={category}>
            <div className="mb-1 flex items-center justify-between text-lg text-blue-50">
              <span className="capitalize">{category.replace("_", " ")}</span>
              <span>{score}%</span>
            </div>
            <div className="h-2 rounded-full bg-blue-950">
              <div className="h-2 rounded-full bg-blue-400" style={{ width: `${score}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
