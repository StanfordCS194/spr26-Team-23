"use client";

import { DEMO_COMPANY, getDemoAnalysisResponse } from "@/lib/demo-data";
import { CompanyInput, GeneratedPrompt } from "@/types";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { PromptGenerationPreview } from "./PromptGenerationPreview";

const defaultState: CompanyInput = {
  companyName: "Wine Find",
  website: "winefind.ai",
  description:
    "Helps users compare restaurant and liquor store wine prices with market prices and choose better-value wines.",
  category: "wine apps / restaurant wine decision tools",
  competitors: ["Vivino", "CellarTracker", "Delectable"],
  numberOfPrompts: 10,
};

const inputClass =
  "h-16 w-full rounded-xl border border-blue-500/35 bg-slate-900/80 px-4 py-3 text-lg text-blue-50 placeholder:text-blue-100/60 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500/45";

const labelClass = "mb-2 block text-base font-medium tracking-[0.01em] text-blue-100/80";

export function TunnelInputForm() {
  const router = useRouter();
  const [form, setForm] = useState<CompanyInput>(defaultState);
  const [prompts, setPrompts] = useState<GeneratedPrompt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (key: keyof CompanyInput, value: string | number | string[]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onGeneratePrompts = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/generate-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!response.ok) throw new Error("Could not generate prompts.");

      const data = (await response.json()) as GeneratedPrompt[];
      setPrompts(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Prompt generation failed. Try Demo Mode.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const onRunAnalysis = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/analyze-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: form, prompts }),
      });

      if (!response.ok) {
        let apiError = "Could not analyze prompts.";
        try {
          const payload = (await response.json()) as { error?: string };
          if (payload?.error) apiError = payload.error;
        } catch {
          // fall back to default message
        }
        throw new Error(apiError);
      }

      const analysis = await response.json();
      window.localStorage.setItem(
        "tunnel-latest-report",
        JSON.stringify({ company: form, analysis }),
      );
      router.push("/dashboard");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Analysis failed. Try demo mode.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const onUseDemoData = () => {
    const analysis = getDemoAnalysisResponse();
    window.localStorage.setItem(
      "tunnel-latest-report",
      JSON.stringify({ company: DEMO_COMPANY, analysis }),
    );
    router.push("/dashboard");
  };

  return (
    <div className="space-y-7">
      <form
        onSubmit={onGeneratePrompts}
        className="rounded-2xl border border-blue-500/30 bg-slate-950/85 p-9 shadow-[0_0_45px_rgba(59,130,246,0.14)] backdrop-blur"
      >
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label htmlFor="companyName" className={labelClass}>
              Company name
            </label>
            <input
              id="companyName"
              className={inputClass}
              placeholder="e.g. Wine Find"
              value={form.companyName}
              onChange={(e) => update("companyName", e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="website" className={labelClass}>
              Website / domain
            </label>
            <input
              id="website"
              className={inputClass}
              placeholder="e.g. winefind.ai"
              value={form.website}
              onChange={(e) => update("website", e.target.value)}
              required
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="description" className={labelClass}>
              One-sentence product description
            </label>
            <input
              id="description"
              className={inputClass}
              placeholder="What does your product do?"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="category" className={labelClass}>
              Category / industry
            </label>
            <input
              id="category"
              className={inputClass}
              placeholder="e.g. wine apps"
              value={form.category}
              onChange={(e) => update("category", e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="competitors" className={labelClass}>
              Competitors (comma-separated)
            </label>
            <input
              id="competitors"
              className={inputClass}
              placeholder="e.g. Vivino, CellarTracker, Delectable"
              value={(form.competitors || []).join(", ")}
              onChange={(e) =>
                update(
                  "competitors",
                  e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                )
              }
            />
          </div>

          <div>
            <label htmlFor="numberOfPrompts" className={labelClass}>
              Number of prompts
            </label>
            <input
              id="numberOfPrompts"
              className={inputClass}
              type="number"
              min={5}
              max={50}
              placeholder="10"
              value={form.numberOfPrompts}
              onChange={(e) => update("numberOfPrompts", Number(e.target.value || 20))}
            />
          </div>
        </div>

        <div className="mt-7 flex flex-wrap gap-5">
          <button
            type="submit"
            className="rounded-xl bg-blue-600 px-6 py-4 text-lg font-semibold text-blue-50 hover:bg-blue-500 disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "Generating..." : "Generate Prompts"}
          </button>
          <button
            type="button"
            className="rounded-xl border border-blue-400/45 bg-slate-900/70 px-6 py-4 text-lg font-semibold text-blue-100 hover:bg-slate-800 disabled:opacity-60"
            disabled={!prompts.length || loading}
            onClick={onRunAnalysis}
          >
            {loading ? "Running..." : "Run Analysis"}
          </button>
          <button
            type="button"
            className="rounded-xl border border-cyan-300/40 bg-cyan-500/12 px-6 py-4 text-lg font-semibold text-cyan-50 hover:bg-cyan-500/20"
            onClick={onUseDemoData}
          >
            Use Demo Data
          </button>
        </div>

        {error ? <p className="mt-4 text-lg text-rose-200">{error}</p> : null}
      </form>

      <PromptGenerationPreview prompts={prompts} />
    </div>
  );
}
