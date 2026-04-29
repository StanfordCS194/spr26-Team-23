import { TunnelInputForm } from "@/components/TunnelInputForm";

export default function Home() {
  return (
    <main className="min-h-screen px-4 py-10 md:px-10">
      <div className="mx-auto max-w-6xl space-y-7">
        <header className="rounded-2xl border border-blue-500/30 bg-slate-950/80 p-9 shadow-[0_0_40px_rgba(37,99,235,0.15)] backdrop-blur">
          <h1 className="text-5xl font-bold tracking-tight text-blue-100">Tunnel</h1>
          <p className="mt-2 text-2xl text-blue-200">See how AI sees you</p>
          <p className="mt-4 text-xl text-blue-100/95">
            Simulate user prompts, inspect AI responses, and understand your visibility against competitors.
          </p>
        </header>

        <TunnelInputForm />
      </div>
    </main>
  );
}
