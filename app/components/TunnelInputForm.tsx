"use client";

import { DEMO_COMPANY, getDemoAnalysisResponse } from "@/lib/demo-data";
import { CompanyInput, GeneratedPrompt } from "@/types";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { PromptGenerationPreview } from "./PromptGenerationPreview";

function logoUrlFromDomain(domain: string): string {
  const clean = domain.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return clean ? `https://www.google.com/s2/favicons?domain=${clean}&sz=256` : "";
}

const defaultState: CompanyInput = {
  companyName: "Wine Find",
  website: "winefind.ai",
  description:
    "Helps users compare restaurant and liquor store wine prices with market prices and choose better-value wines.",
  category: "wine apps / restaurant wine decision tools",
  competitors: ["Vivino", "CellarTracker", "Delectable"],
  numberOfPrompts: 10,
  logoUrl: logoUrlFromDomain("winefind.ai"),
};

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

const inputClass =
  "h-16 w-full rounded-xl border border-blue-500/35 bg-slate-900/80 px-4 py-3 text-lg text-blue-50 placeholder:text-blue-100/60 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500/45";

const labelClass = "mb-2 block text-base font-medium tracking-[0.01em] text-blue-100/80";

export function TunnelInputForm() {
  const router = useRouter();
  const [form, setForm] = useState<CompanyInput>(defaultState);
  const [prompts, setPrompts] = useState<GeneratedPrompt[]>([]);
  const [loadingStep, setLoadingStep] = useState<"idle" | "generating" | "analyzing">("idle");
  const [error, setError] = useState<string | null>(null);

  const loading = loadingStep !== "idle";

  const update = (key: keyof CompanyInput, value: string | number | string[]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onGeneratePrompts = async (event: FormEvent) => {
    event.preventDefault();
    setLoadingStep("generating");
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
      setLoadingStep("idle");
    }
  };

  const onRunAnalysis = async () => {
    setLoadingStep("analyzing");
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
      setLoadingStep("idle");
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
            <div className="flex items-center gap-3">
              <input
                id="website"
                className={inputClass}
                placeholder="e.g. winefind.ai"
                value={form.website}
                onChange={(e) => {
                  const val = e.target.value;
                  setForm((prev) => ({ ...prev, website: val, logoUrl: logoUrlFromDomain(val) }));
                }}
                required
              />
              {form.logoUrl && (
                <img
                  src={form.logoUrl}
                  alt=""
                  width={40}
                  height={40}
                  className="rounded-lg flex-shrink-0"
                />
              )}
            </div>
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
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-4 text-lg font-semibold text-blue-50 hover:bg-blue-500 disabled:opacity-60"
            disabled={loading}
          >
            {loadingStep === "generating" && <Spinner />}
            {loadingStep === "generating" ? "Generating..." : "Generate Prompts"}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-blue-400/45 bg-slate-900/70 px-6 py-4 text-lg font-semibold text-blue-100 hover:bg-slate-800 disabled:opacity-60"
            disabled={!prompts.length || loading}
            onClick={onRunAnalysis}
          >
            {loadingStep === "analyzing" && <Spinner />}
            {loadingStep === "analyzing" ? "Analyzing..." : "Run Analysis"}
          </button>
          <button
            type="button"
            className="rounded-xl border border-cyan-300/40 bg-cyan-500/12 px-6 py-4 text-lg font-semibold text-cyan-50 hover:bg-cyan-500/20"
            onClick={onUseDemoData}
          >
            Use Demo Data
          </button>
        </div>

        {loadingStep === "analyzing" && (
          <p className="mt-4 animate-pulse text-base text-blue-300">
            Asking AI {form.numberOfPrompts} questions about {form.companyName || "your company"}... this usually takes 15–30 seconds.
          </p>
        )}
        {loadingStep === "generating" && (
          <p className="mt-4 animate-pulse text-base text-blue-300">
            Generating {form.numberOfPrompts} prompts...
          </p>
        )}
        {error ? <p className="mt-4 text-lg text-rose-200">{error}</p> : null}
      </form>

      <PromptGenerationPreview prompts={prompts} />
    </div>
  );
}
