interface MetricCardProps {
  label: string;
  value: string | number;
  helper?: string;
}

export function MetricCard({ label, value, helper }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-blue-500/30 bg-slate-950/80 p-9 shadow-[0_0_30px_rgba(37,99,235,0.12)]">
      <p className="text-lg text-blue-50">{label}</p>
      <p className="mt-2 text-5xl font-semibold text-blue-100">{value}</p>
      {helper ? <p className="mt-2 text-lg text-blue-100/95">{helper}</p> : null}
    </div>
  );
}
