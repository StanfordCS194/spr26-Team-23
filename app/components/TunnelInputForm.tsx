"use client";

import { SignInButton, SignUpButton, useAuth } from "@clerk/nextjs";
import { DEMO_COMPANY, getDemoAnalysisResponse } from "@/lib/demo-data";
import { saveReport } from "@/lib/report-storage";
import { CompanyInput, GeneratedPrompt, PromptGenerationResponse } from "@/types";
import Image from "next/image";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { FormEvent, useEffect, useRef, useState } from "react";
import { PromptGenerationPreview } from "./PromptGenerationPreview";

interface ClearbitSuggestion {
  name: string;
  domain: string;
  logo: string;
}

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
    <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

const inputClass =
  "h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100";

const textareaClass =
  "min-h-24 w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm leading-6 text-slate-950 shadow-sm placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100";

const labelClass = "mb-2 block text-sm font-medium text-slate-700";

export function TunnelInputForm() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const [form, setForm] = useState<CompanyInput>(defaultState);
  const [prompts, setPrompts] = useState<GeneratedPrompt[]>([]);
  const [loadingStep, setLoadingStep] = useState<"idle" | "generating" | "analyzing">("idle");
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<ClearbitSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const suppressFetchRef = useRef(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);

  const loading = loadingStep !== "idle";
  const authPending = !isLoaded;
  const requiresSignIn = isLoaded && !isSignedIn;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (suppressFetchRef.current) {
      suppressFetchRef.current = false;
      return;
    }
    const query = form.companyName.trim();
    if (query.length < 2) {
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(query)}`,
        );
        if (res.ok) {
          const data = (await res.json()) as ClearbitSuggestion[];
          setSuggestions(data);
          setShowSuggestions(data.length > 0);
          setActiveSuggestionIndex(-1);
        }
      } catch {
        // autocomplete is non-critical, fail silently
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [form.companyName]);

  const onSelectSuggestion = (suggestion: ClearbitSuggestion) => {
    suppressFetchRef.current = true;
    setForm((prev) => ({
      ...prev,
      companyName: suggestion.name,
      website: suggestion.domain,
      logoUrl: logoUrlFromDomain(suggestion.domain),
    }));
    setSuggestions([]);
    setShowSuggestions(false);
    setActiveSuggestionIndex(-1);
  };

  const update = (key: keyof CompanyInput, value: string | number | string[]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onGeneratePrompts = async (event: FormEvent) => {
    event.preventDefault();
    setLoadingStep("generating");
    setError(null);
    posthog.capture("form_submitted", {
      company_name: form.companyName,
      category: form.category,
      num_competitors: form.competitors?.length ?? 0,
      num_prompts_requested: form.numberOfPrompts,
    });
    try {
      const response = await fetch("/api/generate-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!response.ok) throw new Error("Could not generate prompts.");

      const payload = (await response.json()) as GeneratedPrompt[] | PromptGenerationResponse;
      const data = Array.isArray(payload) ? payload : payload.prompts;
      setPrompts((prev) => [...prev, ...data]);
      posthog.capture("prompts_generated", {
        success: true,
        num_prompts: data.length,
        company_name: form.companyName,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Prompt generation failed. Try Demo Mode.";
      posthog.capture("prompts_generated", { success: false, company_name: form.companyName });
      setError(message);
    } finally {
      setLoadingStep("idle");
    }
  };

  const onRunAnalysis = async () => {
    setLoadingStep("analyzing");
    setError(null);
    posthog.capture("analysis_started", {
      company_name: form.companyName,
      num_prompts: prompts.length,
    });
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
      posthog.capture("analysis_completed", {
        success: true,
        company_name: form.companyName,
        num_models: analysis.models?.length ?? 1,
        visibility_score: analysis.aggregateStats?.visibilityScore,
      });
      const report = saveReport(form, analysis);
      posthog.capture("report_saved", {
        report_id: report.id,
        company_name: form.companyName,
        visibility_score: analysis.aggregateStats?.visibilityScore,
      });
      router.push(`/dashboard?reportId=${encodeURIComponent(report.id)}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Analysis failed. Try demo mode.";
      posthog.capture("analysis_completed", { success: false, company_name: form.companyName });
      setError(message);
    } finally {
      setLoadingStep("idle");
    }
  };

  const onUseDemoData = () => {
    posthog.capture("demo_mode_used");
    const analysis = getDemoAnalysisResponse();
    const report = saveReport(DEMO_COMPANY, analysis);
    router.push(`/dashboard?reportId=${encodeURIComponent(report.id)}`);
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={onGeneratePrompts}
        className="tunnel-form-card rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:p-6"
      >
        <div className="mb-6 flex items-start gap-3 border-b border-slate-200 pb-5">
          <span className="tunnel-card-mark flex-shrink-0" aria-hidden="true" />
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-950">
              Audit setup
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Use your live category language and closest competitors.
            </p>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label htmlFor="companyName" className={labelClass}>
              Company name
            </label>
            <div className="relative" ref={dropdownRef}>
              <input
                id="companyName"
                className={inputClass}
                placeholder="e.g. Wine Find"
                value={form.companyName}
                onChange={(e) => {
                  const value = e.target.value;
                  update("companyName", value);
                  if (value.trim().length < 2) {
                    setSuggestions([]);
                    setShowSuggestions(false);
                    setActiveSuggestionIndex(-1);
                  }
                }}
                onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                onKeyDown={(e) => {
                  if (!showSuggestions) return;
                  if (e.key === "Escape") {
                    setShowSuggestions(false);
                  } else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActiveSuggestionIndex((i) => Math.min(i + 1, suggestions.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActiveSuggestionIndex((i) => Math.max(i - 1, 0));
                  } else if (e.key === "Enter" && activeSuggestionIndex >= 0) {
                    e.preventDefault();
                    onSelectSuggestion(suggestions[activeSuggestionIndex]);
                  }
                }}
                autoComplete="off"
                required
              />
              {showSuggestions && (
                <ul className="absolute left-0 right-0 top-full z-10 mt-1 max-h-60 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
                  {suggestions.map((s, i) => (
                    <li key={s.domain}>
                      <button
                        type="button"
                        className={`flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 ${i === activeSuggestionIndex ? "bg-slate-50" : ""}`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          onSelectSuggestion(s);
                        }}
                      >
                        <Image
                          src={logoUrlFromDomain(s.domain)}
                          alt=""
                          width={20}
                          height={20}
                          unoptimized
                          className="rounded-sm"
                        />
                        <span className="font-medium">{s.name}</span>
                        <span className="ml-auto text-slate-400">{s.domain}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
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
                  setSuggestions([]);
                  setShowSuggestions(false);
                  setForm((prev) => ({ ...prev, website: val, logoUrl: logoUrlFromDomain(val) }));
                }}
                required
              />
              {form.logoUrl && (
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50">
                  <Image
                    src={form.logoUrl}
                    alt=""
                    width={28}
                    height={28}
                    unoptimized
                    className="rounded-sm"
                  />
                </span>
              )}
            </div>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="description" className={labelClass}>
              One-sentence product description
            </label>
            <textarea
              id="description"
              className={textareaClass}
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
              Prompts to generate
            </label>
            <div className="flex items-center gap-3">
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
              <span className="whitespace-nowrap text-sm text-slate-500">5 to 50</span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-200 pt-5">
          <button
            type="submit"
            className="inline-flex h-11 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading || authPending || requiresSignIn}
          >
            {loadingStep === "generating" && <Spinner />}
            {loadingStep === "generating" ? "Generating..." : "Generate Prompts"}
          </button>
          <button
            type="button"
            className="inline-flex h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!prompts.length || loading || authPending || requiresSignIn}
            onClick={onRunAnalysis}
          >
            {loadingStep === "analyzing" && <Spinner />}
            {loadingStep === "analyzing" ? "Analyzing..." : "Run Analysis"}
          </button>
          <button
            type="button"
            className="inline-flex h-11 items-center rounded-md border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={authPending || requiresSignIn}
            onClick={onUseDemoData}
          >
            Use Demo Data
          </button>
        </div>

        {requiresSignIn && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-md border border-sky-200 bg-sky-50 px-3 py-3 text-sm text-sky-800">
            <span className="font-medium">Sign in to generate prompts and view reports.</span>
            <SignInButton mode="modal">
              <button className="inline-flex h-9 items-center rounded-md bg-slate-950 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="inline-flex h-9 items-center rounded-md border border-sky-300 bg-white px-3 text-sm font-semibold text-sky-800 shadow-sm transition hover:bg-sky-100">
                Create account
              </button>
            </SignUpButton>
          </div>
        )}

        {loadingStep === "analyzing" && (
          <p className="mt-4 animate-pulse text-sm text-sky-700">
            Asking AI {form.numberOfPrompts} questions about {form.companyName || "your company"}... this usually takes 15-30 seconds.
          </p>
        )}
        {loadingStep === "generating" && (
          <p className="mt-4 animate-pulse text-sm text-sky-700">
            Generating {form.numberOfPrompts} prompts...
          </p>
        )}
        {error ? (
          <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
      </form>

      <PromptGenerationPreview prompts={prompts} onPromptsChange={setPrompts} />
    </div>
  );
}
