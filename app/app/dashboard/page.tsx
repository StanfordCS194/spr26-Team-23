"use client";

import { TunnelDashboard } from "@/components/TunnelDashboard";
import { DEMO_COMPANY, getDemoAnalysisResponse } from "@/lib/demo-data";
import { AnalysisResponse, CompanyInput } from "@/types";
import Link from "next/link";
import { useEffect, useState } from "react";

interface StoredTunnelData {
  company: CompanyInput;
  analysis: AnalysisResponse;
}

const STORAGE_KEY = "tunnel-latest-report";

function readStoredPayload(): StoredTunnelData | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredTunnelData;
  } catch {
    return null;
  }
}

export default function DashboardPage() {
  const [hydrated, setHydrated] = useState(false);
  const [payload, setPayload] = useState<StoredTunnelData | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPayload(readStoredPayload());
    setHydrated(true);
  }, []);

  if (!hydrated) {
    return <main className="min-h-screen" />;
  }

  if (!payload) {
    const demo = getDemoAnalysisResponse();
    return (
      <>
        <TunnelDashboard company={DEMO_COMPANY} data={demo} />
        <div className="fixed bottom-4 right-4 rounded-lg border border-blue-500/40 bg-slate-950/90 px-4 py-3 text-2xl text-blue-100 shadow-[0_0_24px_rgba(59,130,246,0.22)] backdrop-blur">
          Showing demo report.{" "}
          <Link href="/" className="font-medium text-cyan-200 underline">
            Run your own analysis
          </Link>
        </div>
      </>
    );
  }

  return <TunnelDashboard company={payload.company} data={payload.analysis} />;
}
