"use client";

import { AnalysisResponse, CompanyInput, SavedReport } from "@/types";

const LATEST_REPORT_KEY = "tunnel-latest-report";
const REPORT_HISTORY_KEY = "tunnel-report-history";
const MAX_REPORTS = 25;
const LEGACY_REPORT_ID = "legacy-latest";

interface StoredTunnelData {
  reportId?: string;
  company: CompanyInput;
  analysis: AnalysisResponse;
}

function canUseStorage(): boolean {
  try {
    return typeof window !== "undefined" && Boolean(window.localStorage);
  } catch {
    return false;
  }
}

function readJson<T>(key: string): T | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): boolean {
  if (!canUseStorage()) return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function removeItem(key: string) {
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage may be unavailable in privacy-restricted browser contexts.
  }
}

function writeHistory(reports: SavedReport[]): SavedReport[] {
  let nextReports = reports.slice(0, MAX_REPORTS);
  while (nextReports.length > 0) {
    if (writeJson(REPORT_HISTORY_KEY, nextReports)) return nextReports;
    nextReports = nextReports.slice(0, -1);
  }
  writeJson(REPORT_HISTORY_KEY, []);
  return [];
}

function createReportId(): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `report-${Date.now()}-${random}`;
}

function readHistory(): SavedReport[] {
  const reports = readJson<SavedReport[]>(REPORT_HISTORY_KEY);
  if (!Array.isArray(reports)) return [];
  return reports.filter(
    (report): report is SavedReport =>
      typeof report?.id === "string" &&
      typeof report?.createdAt === "string" &&
      Boolean(report.company) &&
      Boolean(report.analysis),
  );
}

function readLatestPayload(): StoredTunnelData | null {
  return readJson<StoredTunnelData>(LATEST_REPORT_KEY);
}

function isSameReportPayload(report: SavedReport, payload: StoredTunnelData): boolean {
  if (payload.reportId) return report.id === payload.reportId;
  return (
    report.company.companyName === payload.company.companyName &&
    report.company.website === payload.company.website &&
    report.analysis.aggregateStats?.visibilityScore ===
      payload.analysis.aggregateStats?.visibilityScore &&
    report.analysis.promptAnalyses?.length === payload.analysis.promptAnalyses?.length
  );
}

function migrateLatestReportIntoHistory(reports: SavedReport[]): SavedReport[] {
  const latest = readLatestPayload();
  if (!latest || reports.some((report) => isSameReportPayload(report, latest))) {
    return reports;
  }

  const legacyReport: SavedReport = {
    id: latest.reportId ?? LEGACY_REPORT_ID,
    createdAt: new Date().toISOString(),
    company: latest.company,
    analysis: latest.analysis,
  };
  return writeHistory([legacyReport, ...reports]);
}

export function getSavedReports(): SavedReport[] {
  return migrateLatestReportIntoHistory(readHistory()).sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
}

export function getSavedReport(id: string): SavedReport | null {
  return getSavedReports().find((report) => report.id === id) ?? null;
}

export function getLatestReportPayload(): StoredTunnelData | null {
  return readLatestPayload();
}

export function saveReport(company: CompanyInput, analysis: AnalysisResponse): SavedReport {
  const report: SavedReport = {
    id: createReportId(),
    createdAt: new Date().toISOString(),
    company,
    analysis,
  };
  writeJson(LATEST_REPORT_KEY, { reportId: report.id, company, analysis });
  writeHistory([report, ...readHistory().filter((item) => item.id !== LEGACY_REPORT_ID)]);
  return report;
}

export function deleteSavedReport(id: string): SavedReport[] {
  const remaining = getSavedReports().filter((report) => report.id !== id);
  const storedRemaining = writeHistory(remaining);

  const latest = readLatestPayload();
  const deletedLatest =
    latest && !storedRemaining.some((report) => isSameReportPayload(report, latest));
  if (deletedLatest) {
    const replacement = storedRemaining[0];
    if (replacement) {
      writeJson(LATEST_REPORT_KEY, {
        reportId: replacement.id,
        company: replacement.company,
        analysis: replacement.analysis,
      });
    } else {
      removeItem(LATEST_REPORT_KEY);
    }
  }

  return storedRemaining;
}
