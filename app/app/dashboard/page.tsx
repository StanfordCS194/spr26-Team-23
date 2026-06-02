"use client";

import { useUser } from "@clerk/nextjs";
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
  const { isLoaded, isSignedIn } = useUser();
  const [hydrated, setHydrated] = useState(false);
  const [payload, setPayload] = useState<StoredTunnelData | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    let active = true;

    async function loadReport() {
      let nextPayload = readStoredPayload();

      if (isSignedIn) {
        try {
          const response = await fetch("/api/reports/latest");
          if (response.ok) {
            const data = (await response.json()) as { report?: StoredTunnelData | null };
            if (data.report) {
              nextPayload = {
                company: data.report.company,
                analysis: data.report.analysis,
              };
            }
          }
        } catch {
          // Fall back to the local copy when the database is unavailable.
        }
      }

      if (active) {
        setPayload(nextPayload);
        setHydrated(true);
      }
    }

    void loadReport();

    return () => {
      active = false;
    };
  }, [isLoaded, isSignedIn]);

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
