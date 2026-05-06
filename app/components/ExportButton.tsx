"use client";

export function ExportButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex cursor-pointer items-center rounded-md border border-slate-200 bg-white/80 px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm backdrop-blur transition hover:border-slate-300 hover:bg-white hover:text-slate-950"
    >
      Export PDF
    </button>
  );
}
