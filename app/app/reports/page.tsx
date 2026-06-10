"use client";

import { useAuth } from "@clerk/nextjs";
import { AnalysisResponse, CompanyInput } from "@/types";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

interface SerializedReport {
  id: string;
  createdAt: string;
  company: CompanyInput;
  analysis: AnalysisResponse;
}

function logoUrlFromDomain(domain: string): string {
  const clean = domain.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return clean ? `https://www.google.com/s2/favicons?domain=${clean}&sz=256` : "";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ReportsPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const [reports, setReports] = useState<SerializedReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    fetch("/api/reports")
      .then((r) => r.json())
      .then((data: { reports?: SerializedReport[] }) => setReports(data.reports ?? []))
      .catch(() => setError("Could not load reports."));
  }, [isLoaded, isSignedIn]);

  function openReport(report: SerializedReport) {
    window.localStorage.setItem(
      "tunnel-latest-report",
      JSON.stringify({ company: report.company, analysis: report.analysis }),
    );
    window.location.href = "/dashboard";
  }

  return (
    <main className="min-h-screen px-5 py-6 text-slate-950 md:px-8">
      <div className="mx-auto max-w-4xl">
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
          <Link
            href="/"
            className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            ← New audit
          </Link>
        </header>

        <div className="mt-8">
          <h1 className="text-2xl font-semibold tracking-tight">My Reports</h1>
          <p className="mt-1 text-sm text-slate-500">Your past AI visibility analyses.</p>
        </div>

        <div className="mt-6">
          {!isLoaded || reports === null ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-lg border border-slate-200 bg-slate-100" />
              ))}
            </div>
          ) : !isSignedIn ? (
            <p className="text-sm text-slate-500">Sign in to view your reports.</p>
          ) : error ? (
            <p className="text-sm text-rose-600">{error}</p>
          ) : reports.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white px-6 py-12 text-center">
              <p className="text-sm font-medium text-slate-700">No reports yet.</p>
              <p className="mt-1 text-sm text-slate-500">
                Run an analysis to see your results here.
              </p>
              <Link
                href="/"
                className="mt-4 inline-flex h-9 items-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
              >
                Start an audit
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {reports.map((report) => {
                const score = report.analysis?.aggregateStats?.visibilityScore ?? null;
                const logoUrl = report.company.logoUrl || logoUrlFromDomain(report.company.website);
                return (
                  <li key={report.id}>
                    <button
                      onClick={() => openReport(report)}
                      className="flex w-full items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-4 text-left shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      {logoUrl && (
                        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50">
                          <Image
                            src={logoUrl}
                            alt=""
                            width={24}
                            height={24}
                            unoptimized
                            className="rounded-sm"
                          />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-slate-950">
                          {report.company.companyName}
                        </p>
                        <p className="truncate text-sm text-slate-500">
                          {report.company.category}
                        </p>
                      </div>
                      {score !== null && (
                        <span className="flex-shrink-0 text-sm font-semibold text-sky-600">
                          {score}% visibility
                        </span>
                      )}
                      <span className="flex-shrink-0 text-sm text-slate-400">
                        {formatDate(report.createdAt)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
