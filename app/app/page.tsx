"use client";

import { FormEvent, useMemo, useState } from "react";

type ProviderResult = {
  prompt: string;
  response: string;
  companyMentioned: boolean;
  competitorMentions: string[];
  position: number | null;
  source: "live" | "mock";
  providerError?: string;
};

type ProviderDiagnostics = {
  provider: "openai" | "anthropic" | "together";
  liveResponses: number;
  mockResponses: number;
  errors: string[];
};

type AnalyzeResponse = {
  company: string;
  prompts: string[];
  providers: Record<string, ProviderResult[]>;
  providerDiagnostics: ProviderDiagnostics[];
  insightSummary: {
    visibilityRate: number;
    avgPosition: number | null;
    topCompetitors: { name: string; count: number }[];
    strengths: string[];
    gaps: string[];
    recommendations: string[];
  };
};

const defaultPromptSeeds = [
  "Best AI coding assistants",
  "Top AI tools for developers",
  "Which tools are best alternatives to GitHub Copilot?",
];

export default function Home() {
  const [company, setCompany] = useState("Cursor");
  const [category, setCategory] = useState("AI coding assistant");
  const [competitors, setCompetitors] = useState("GitHub Copilot, Claude Code, Codeium");
  const [customPrompts, setCustomPrompts] = useState(defaultPromptSeeds.join("\n"));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalyzeResponse | null>(null);
  const [includeOpenAI, setIncludeOpenAI] = useState(true);
  const [includeAnthropic, setIncludeAnthropic] = useState(true);
  const [includeTogether, setIncludeTogether] = useState(true);

  const providers = useMemo(() => {
    const list: string[] = [];
    if (includeOpenAI) list.push("openai");
    if (includeAnthropic) list.push("anthropic");
    if (includeTogether) list.push("together");
    return list;
  }, [includeOpenAI, includeAnthropic, includeTogether]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!providers.length) {
      setError("Select at least one model provider.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const promptList = customPrompts
        .split("\n")
        .map((p) => p.trim())
        .filter(Boolean);

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company,
          category,
          competitors: competitors
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean),
          customPrompts: promptList,
          providers,
        }),
      });

      if (!res.ok) {
        throw new Error(`Request failed with ${res.status}`);
      }
      const json = (await res.json()) as AnalyzeResponse;
      setData(json);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to run analysis.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:px-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold">AI Presence Intelligence Prototype</h1>
          <p className="text-sm opacity-80">
            Enter a company and measure how LLMs mention it across discovery, comparison,
            and niche prompts.
          </p>
        </header>

        <form className="grid gap-4 rounded-lg border border-white/20 p-4" onSubmit={onSubmit}>
          <label className="grid gap-1 text-sm">
            Company name
            <input
              className="rounded border border-white/25 bg-transparent px-3 py-2"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              required
            />
          </label>

          <label className="grid gap-1 text-sm">
            Product category
            <input
              className="rounded border border-white/25 bg-transparent px-3 py-2"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
            />
          </label>

          <label className="grid gap-1 text-sm">
            Competitors (comma-separated)
            <input
              className="rounded border border-white/25 bg-transparent px-3 py-2"
              value={competitors}
              onChange={(e) => setCompetitors(e.target.value)}
            />
          </label>

          <label className="grid gap-1 text-sm">
            Custom prompts (one per line)
            <textarea
              className="min-h-36 rounded border border-white/25 bg-transparent px-3 py-2"
              value={customPrompts}
              onChange={(e) => setCustomPrompts(e.target.value)}
            />
          </label>

          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={includeOpenAI}
                onChange={() => setIncludeOpenAI((v) => !v)}
              />
              OpenAI
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={includeAnthropic}
                onChange={() => setIncludeAnthropic((v) => !v)}
              />
              Anthropic
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={includeTogether}
                onChange={() => setIncludeTogether((v) => !v)}
              />
              Together (OS models)
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-fit rounded bg-foreground px-4 py-2 text-background disabled:opacity-50"
          >
            {loading ? "Running analysis..." : "Run analysis"}
          </button>
        </form>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        {data ? (
          <section className="space-y-4 rounded-lg border border-white/20 p-4">
            <h2 className="text-xl font-medium">Insights for {data.company}</h2>
            <div className="grid gap-3 md:grid-cols-3">
              <article className="rounded border border-white/20 p-3">
                <p className="text-xs uppercase opacity-70">Visibility Rate</p>
                <p className="text-2xl font-semibold">{data.insightSummary.visibilityRate}%</p>
              </article>
              <article className="rounded border border-white/20 p-3">
                <p className="text-xs uppercase opacity-70">Average Rank</p>
                <p className="text-2xl font-semibold">
                  {data.insightSummary.avgPosition ?? "N/A"}
                </p>
              </article>
              <article className="rounded border border-white/20 p-3">
                <p className="text-xs uppercase opacity-70">Top Competitor</p>
                <p className="text-2xl font-semibold">
                  {data.insightSummary.topCompetitors[0]?.name ?? "N/A"}
                </p>
              </article>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <article>
                <h3 className="font-medium">Strengths</h3>
                <ul className="mt-1 space-y-1 text-sm opacity-90">
                  {data.insightSummary.strengths.map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              </article>
              <article>
                <h3 className="font-medium">Gaps</h3>
                <ul className="mt-1 space-y-1 text-sm opacity-90">
                  {data.insightSummary.gaps.map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              </article>
              <article>
                <h3 className="font-medium">Recommendations</h3>
                <ul className="mt-1 space-y-1 text-sm opacity-90">
                  {data.insightSummary.recommendations.map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              </article>
            </div>

            <div className="space-y-3">
              <h3 className="font-medium">Raw Prompt Results</h3>
              {Object.entries(data.providers).map(([provider, rows]) => (
                <article key={provider} className="rounded border border-white/20 p-3">
                  <p className="mb-2 text-sm font-semibold uppercase">{provider}</p>
                  <div className="space-y-2">
                    {rows.map((row) => (
                      <div key={`${provider}-${row.prompt}`} className="rounded bg-white/5 p-2 text-sm">
                        <p>
                          <span className="font-medium">Prompt:</span> {row.prompt}
                        </p>
                        <p>
                          <span className="font-medium">Mentioned:</span>{" "}
                          {row.companyMentioned ? "Yes" : "No"}
                          {row.position ? ` (rank ${row.position})` : ""}
                        </p>
                        <p>
                          <span className="font-medium">Source:</span> {row.source}
                        </p>
                        <p className="opacity-90">{row.response}</p>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
