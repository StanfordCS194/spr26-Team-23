import { GeneratedPrompt } from "@/types";

interface PromptGenerationPreviewProps {
  prompts: GeneratedPrompt[];
}

const CATEGORY_LABEL: Record<string, string> = {
  discovery: "Discovery",
  comparison: "Comparison",
  use_case: "Use Case",
  niche: "Niche",
  purchase: "Purchase Intent",
};

export function PromptGenerationPreview({ prompts }: PromptGenerationPreviewProps) {
  if (!prompts.length) return null;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold tracking-tight text-slate-950">
            Generated Prompts
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Tunnel will run each of these prompts through Gemini and analyze the
            answers.
          </p>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-600">
          {prompts.length}
        </span>
      </div>
      <div className="mt-4 divide-y divide-slate-200 border-t border-slate-200">
        {prompts.map((prompt) => (
          <div key={prompt.id} className="py-4">
            <div className="flex flex-wrap items-start gap-3">
              <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-sky-700">
                {CATEGORY_LABEL[prompt.category] ?? prompt.category}
              </span>
              <p className="min-w-0 flex-1 text-sm font-medium leading-6 text-slate-900">
                {prompt.prompt}
              </p>
            </div>
            {prompt.rationale ? (
              <p className="mt-2 text-sm leading-6 text-slate-500">{prompt.rationale}</p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
