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
    <section className="rounded-xl border border-blue-500/30 bg-slate-950/80 p-9 shadow-[0_0_30px_rgba(37,99,235,0.12)]">
      <h3 className="text-2xl font-semibold text-blue-100">Generated Prompts</h3>
      <p className="mt-1 text-lg text-blue-100/85">
        Tunnel will run each of these prompts through Gemini and analyze the answers.
      </p>
      <div className="mt-4 space-y-3">
        {prompts.map((prompt) => (
          <div
            key={prompt.id}
            className="rounded-lg border border-blue-500/25 bg-blue-500/10 p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-sm uppercase tracking-wide text-blue-100">
                {CATEGORY_LABEL[prompt.category] ?? prompt.category}
              </span>
              <p className="text-lg font-medium text-blue-50">{prompt.prompt}</p>
            </div>
            {prompt.rationale ? (
              <p className="mt-2 text-base text-blue-100/80">{prompt.rationale}</p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
