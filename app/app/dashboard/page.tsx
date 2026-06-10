"use client";

import { useUser } from "@clerk/nextjs";
import { TunnelDashboard } from "@/components/TunnelDashboard";
import { DEMO_COMPANY, getDemoAnalysisResponse } from "@/lib/demo-data";
import {
  ActiveReport,
  readActiveReport,
  resolveDashboardReport,
} from "@/lib/report-session";
import { SerializedReport } from "@/lib/reports";
import Link from "next/link";
import posthog from "posthog-js";
import { useEffect, useState } from "react";

function toActiveReport(report: SerializedReport): ActiveReport {
  return {
    id: report.id,
    createdAt: report.createdAt,
    company: report.company,
    analysis: report.analysis,
  };
}

export default function DashboardPage() {
  const { isLoaded, isSignedIn } = useUser();
  const [hydrated, setHydrated] = useState(false);
  const [payload, setPayload] = useState<ActiveReport | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    let active = true;

    async function loadReport() {
      const stored = readActiveReport();
      let dbLatest: ActiveReport | null = null;

      if (isSignedIn && !stored) {
        try {
          const response = await fetch("/api/reports/latest");
          if (response.ok) {
            const data = (await response.json()) as { report?: SerializedReport | null };
            if (data.report) {
              dbLatest = toActiveReport(data.report);
            }
          }
        } catch {
          // Fall back when the database is unavailable.
        }
      }

      const { payload: nextPayload, source } = resolveDashboardReport({
        stored,
        dbLatest,
      });

      if (active) {
        setPayload(nextPayload);
        setHydrated(true);
        posthog.capture("dashboard_viewed", {
          source: source ?? "demo",
          company_name: nextPayload?.company.companyName ?? "Wine Find",
        });
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

  return (
    <TunnelDashboard
      company={payload.company}
      data={payload.analysis}
      auditedAt={payload.createdAt}
    />
  );
}
