import { GeneratedPrompt } from "@/types";

interface PromptGenerationPreviewProps {
  prompts: GeneratedPrompt[];
}

export function PromptGenerationPreview({ prompts }: PromptGenerationPreviewProps) {
  if (!prompts.length) return null;

  return (
    <section className="rounded-xl border border-blue-500/30 bg-slate-950/80 p-9 shadow-[0_0_30px_rgba(37,99,235,0.12)]">
      <h3 className="text-lg font-semibold text-blue-100">Generated Prompt Preview</h3>
      <p className="mt-1 text-lg text-blue-100/95">Sample prompts Tunnel will analyze.</p>
      <div className="mt-4 space-y-2">
        {prompts.slice(0, 8).map((prompt) => (
          <div key={prompt.id} className="rounded-lg bg-blue-500/10 p-4 text-lg">
            <p className="font-medium text-blue-100">{prompt.prompt}</p>
            <p className="mt-1 text-lg capitalize text-blue-100/95">
              {prompt.category.replace("_", " ")} - {prompt.rationale}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
