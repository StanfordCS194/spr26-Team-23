import { AuthStatusButtons } from "@/components/AuthStatusButtons";
import { TunnelInputForm } from "@/components/TunnelInputForm";

export default function Home() {
  return (
    <main className="min-h-screen px-5 py-6 text-slate-950 md:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-7xl flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 pb-5">
          <div className="flex items-center gap-3">
            <span className="tunnel-mark" aria-hidden="true" />
            <div>
              <p className="text-lg font-semibold leading-tight">Tunnel</p>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                AI visibility intelligence
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AuthStatusButtons />
          </div>
        </header>

        <section className="grid flex-1 gap-6 py-6 lg:grid-cols-[minmax(0,0.75fr)_minmax(520px,1fr)] lg:items-start lg:gap-8 lg:py-12">
          <div className="tunnel-hero max-w-xl lg:sticky lg:top-8">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              New audit
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 md:mt-4 md:text-5xl">
              Measure how AI assistants position your company.
            </h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-slate-600 md:mt-5 md:text-lg md:leading-8">
              Build a prompt set around your category, run the analysis, and leave with a clear view of visibility, ranking, competitors, and missed demand.
            </p>
            <div className="tunnel-vista mt-7 hidden h-32 max-w-lg rounded-lg border border-slate-200 bg-white shadow-sm sm:block" />
            <div className="tunnel-stat-strip mt-8 hidden max-w-lg grid-cols-3 overflow-hidden rounded-lg border border-slate-200 bg-white/90 shadow-sm backdrop-blur sm:grid">
              <div className="border-r border-slate-200 p-4">
                <p className="text-2xl font-semibold text-slate-950">5</p>
                <p className="mt-1 text-sm text-slate-500">Prompt types</p>
              </div>
              <div className="border-r border-slate-200 p-4">
                <p className="text-2xl font-semibold text-slate-950">50</p>
                <p className="mt-1 text-sm text-slate-500">Max prompts</p>
              </div>
              <div className="p-4">
                <p className="text-2xl font-semibold text-slate-950">1</p>
                <p className="mt-1 text-sm text-slate-500">Report</p>
              </div>
            </div>
          </div>

          <TunnelInputForm />
        </section>
      </div>
    </main>
  );
}
