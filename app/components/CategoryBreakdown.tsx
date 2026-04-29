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
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <h3 className="text-xl font-semibold tracking-tight text-slate-950">
        Visibility by Category
      </h3>
      <p className="mt-1 text-sm leading-6 text-slate-500">
        Percent of prompts in each category where your company appeared.
      </p>
      <div className="mt-5 space-y-4">
        {(Object.entries(visibilityByCategory) as [PromptCategory, CategoryVisibility][]).map(
          ([category, value]) => (
            <div key={category}>
              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-slate-700">{CATEGORY_LABEL[category]}</span>
                <span className="text-slate-500">
                  {value.mentioned}/{value.total} - {value.percent}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-sky-500"
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
