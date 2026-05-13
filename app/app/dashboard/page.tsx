"use client";

import { TunnelDashboard } from "@/components/TunnelDashboard";
import { DEMO_COMPANY, getDemoAnalysisResponse } from "@/lib/demo-data";
import { AnalysisResponse, CompanyInput } from "@/types";
import Link from "next/link";
import posthog from "posthog-js";
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
    const stored = readStoredPayload();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPayload(stored);
    setHydrated(true);
    posthog.capture("dashboard_viewed", {
      source: stored ? "stored" : "demo",
      company_name: stored?.company?.companyName ?? "Wine Find",
    });
  }, []);

  if (!hydrated) {
    return <main className="min-h-screen" />;
  }

  if (!payload) {
    const demo = getDemoAnalysisResponse();
    return (
      <>
        <TunnelDashboard company={DEMO_COMPANY} data={demo} />
        <div className="fixed bottom-4 left-4 right-4 z-10 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-lg shadow-slate-900/10 sm:left-auto sm:max-w-sm">
          Showing demo report.{" "}
          <Link href="/" className="font-semibold text-slate-950 underline underline-offset-4">
            Run your own analysis
          </Link>
        </div>
      </>
    );
  }

  return <TunnelDashboard company={payload.company} data={payload.analysis} />;
}
