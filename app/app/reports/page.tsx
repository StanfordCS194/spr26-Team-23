"use client";

import { deleteSavedReport, getSavedReports } from "@/lib/report-storage";
import { SavedReport } from "@/types";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import posthog from "posthog-js";
import { useEffect, useState } from "react";

function formatReportDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function reportPromptCount(report: SavedReport): number {
  return report.analysis.promptAnalyses?.length ?? 0;
}

function reportTopCompetitor(report: SavedReport): string {
  return report.analysis.aggregateStats.topCompetitor?.name ?? "None detected";
}

export default function ReportsPage() {
  const [hydrated, setHydrated] = useState(false);
  const [reports, setReports] = useState<SavedReport[]>([]);

  useEffect(() => {
    const savedReports = getSavedReports();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReports(savedReports);
    setHydrated(true);
    posthog.capture("report_history_viewed", {
      report_count: savedReports.length,
    });
  }, []);

  const onDelete = (report: SavedReport) => {
    const remaining = deleteSavedReport(report.id);
    setReports(remaining);
    posthog.capture("report_deleted", {
      report_id: report.id,
      company_name: report.company.companyName,
    });
  };

  if (!hydrated) {
    return <main className="min-h-screen" />;
  }

  return (
    <main className="min-h-screen px-5 py-6 text-slate-950 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/"
              className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
            >
              &lt;- New Analysis
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
            >
              Latest Dashboard
            </Link>
            <div className="ml-auto">
              <UserButton />
            </div>
          </div>

          <div className="mt-6">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Tunnel reports
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl">
              Report history
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              Reopen recent AI visibility audits saved in this browser.
            </p>
          </div>
        </header>

        {reports.length === 0 ? (
          <section className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h2 className="text-xl font-semibold tracking-tight text-slate-950">
              No saved reports yet
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
              Run an analysis or use demo data and Tunnel will automatically save it here.
            </p>
            <Link
              href="/"
              className="mt-5 inline-flex h-11 items-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              Start an analysis
            </Link>
          </section>
        ) : (
          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="grid grid-cols-[1.4fr_0.9fr_0.6fr_0.8fr_auto] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 max-lg:hidden">
              <span>Company</span>
              <span>Created</span>
              <span>Visibility</span>
              <span>Top competitor</span>
              <span className="text-right">Actions</span>
            </div>
            <div className="divide-y divide-slate-200">
              {reports.map((report) => (
                <article
                  key={report.id}
                  className="grid gap-4 px-5 py-4 lg:grid-cols-[1.4fr_0.9fr_0.6fr_0.8fr_auto] lg:items-center"
                >
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">
                      {report.company.companyName}
                    </h2>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                      {report.company.category}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {reportPromptCount(report)} prompt{reportPromptCount(report) === 1 ? "" : "s"} analyzed
                    </p>
                  </div>

                  <p className="text-sm text-slate-600">{formatReportDate(report.createdAt)}</p>

                  <div>
                    <p className="text-2xl font-semibold text-slate-950">
                      {report.analysis.aggregateStats.visibilityScore}%
                    </p>
                    <p className="text-xs text-slate-500">
                      {report.analysis.aggregateStats.visibilityCount.mentioned}/
                      {report.analysis.aggregateStats.visibilityCount.total} mentions
                    </p>
                  </div>

                  <p className="text-sm text-slate-600">{reportTopCompetitor(report)}</p>

                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <Link
                      href={`/dashboard?reportId=${encodeURIComponent(report.id)}`}
                      className="inline-flex h-9 items-center rounded-md bg-slate-950 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                      onClick={() =>
                        posthog.capture("saved_report_opened", {
                          report_id: report.id,
                          company_name: report.company.companyName,
                        })
                      }
                    >
                      Open
                    </Link>
                    <button
                      type="button"
                      className="inline-flex h-9 items-center rounded-md border border-rose-200 bg-white px-3 text-sm font-semibold text-rose-700 shadow-sm transition hover:bg-rose-50"
                      onClick={() => onDelete(report)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
