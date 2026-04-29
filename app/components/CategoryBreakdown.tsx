import { CategoryVisibility, PromptCategory } from "@/types";

interface CategoryBreakdownProps {
  visibilityByCategory: Record<PromptCategory, CategoryVisibility>;
}

const CATEGORY_LABEL: Record<PromptCategory, string> = {
  discovery: "Discovery",
  comparison: "Comparison",
  use_case: "Use Case",
  niche: "Niche",
  purchase: "Purchase Intent",
};

export function CategoryBreakdown({ visibilityByCategory }: CategoryBreakdownProps) {
  return (
    <section className="rounded-xl border border-blue-500/30 bg-slate-950/80 p-9 shadow-[0_0_30px_rgba(37,99,235,0.12)]">
      <h3 className="text-2xl font-semibold text-blue-100">Visibility by Category</h3>
      <p className="mt-1 text-lg text-blue-100/85">
        Percent of prompts in each category where your company appeared.
      </p>
      <div className="mt-5 space-y-4">
        {(Object.entries(visibilityByCategory) as [PromptCategory, CategoryVisibility][]).map(
          ([category, value]) => (
            <div key={category}>
              <div className="mb-1 flex items-center justify-between text-lg text-blue-50">
                <span>{CATEGORY_LABEL[category]}</span>
                <span className="text-blue-100/90">
                  {value.mentioned}/{value.total} · {value.percent}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-blue-950">
                <div
                  className="h-2 rounded-full bg-blue-400"
                  style={{ width: `${value.percent}%` }}
                />
              </div>
            </div>
          ),
        )}
      </div>
    </section>
  );
}
