"use client";

import { TunnelDashboard } from "@/components/TunnelDashboard";
import { DEMO_COMPANY, getDemoAnalysisResponse } from "@/lib/demo-data";
import { getLatestReportPayload, getSavedReport } from "@/lib/report-storage";
import { AnalysisResponse, CompanyInput } from "@/types";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { Suspense, useEffect, useState } from "react";

interface StoredTunnelData {
  company: CompanyInput;
  analysis: AnalysisResponse;
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const reportId = searchParams.get("reportId");
  const [hydrated, setHydrated] = useState(false);
  const [payload, setPayload] = useState<StoredTunnelData | null>(null);
  const [missingReportId, setMissingReportId] = useState<string | null>(null);

  useEffect(() => {
    const report = reportId ? getSavedReport(reportId) : null;
    const stored = report
      ? { company: report.company, analysis: report.analysis }
      : getLatestReportPayload();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPayload(stored);
    setMissingReportId(reportId && !report ? reportId : null);
    setHydrated(true);
    posthog.capture("dashboard_viewed", {
      source: report ? "history" : stored ? "latest" : "demo",
      company_name: stored?.company?.companyName ?? "Wine Find",
      report_id: report?.id,
    });
  }, [reportId]);

  if (!hydrated) {
    return <main className="min-h-screen" />;
  }

  if (!payload) {
    const demo = getDemoAnalysisResponse();
    return (
      <>
        <TunnelDashboard company={DEMO_COMPANY} data={demo} />
        <div className="fixed bottom-4 left-4 right-4 z-10 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-lg shadow-slate-900/10 sm:left-auto sm:max-w-sm">
          {missingReportId ? "That saved report could not be found. Showing demo report. " : "Showing demo report. "}
          <Link href="/" className="font-semibold text-slate-950 underline underline-offset-4">
            Run your own analysis
          </Link>
        </div>
      </>
    );
  }

  return <TunnelDashboard company={payload.company} data={payload.analysis} />;
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<main className="min-h-screen" />}>
      <DashboardContent />
    </Suspense>
  );
}
