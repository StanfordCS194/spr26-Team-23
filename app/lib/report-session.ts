import { AnalysisResponse, CompanyInput } from "@/types";

export const STORAGE_KEY = "tunnel-latest-report";

export interface ActiveReport {
  id?: string;
  createdAt?: string;
  company: CompanyInput;
  analysis: AnalysisResponse;
}

export type DashboardReportSource = "stored" | "database" | "demo";

export function isActiveReport(value: unknown): value is ActiveReport {
  if (!value || typeof value !== "object") return false;
  const report = value as Partial<ActiveReport>;
  const company = report.company as Partial<CompanyInput> | undefined;
  return Boolean(
    company &&
      typeof company.companyName === "string" &&
      typeof company.website === "string" &&
      typeof company.description === "string" &&
      typeof company.category === "string" &&
      report.analysis &&
      typeof report.analysis === "object",
  );
}

export function readActiveReport(): ActiveReport | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isActiveReport(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeActiveReport(report: ActiveReport): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(report));
}

export function resolveDashboardReport({
  stored,
  dbLatest,
}: {
  stored: ActiveReport | null;
  dbLatest: ActiveReport | null;
}): { payload: ActiveReport | null; source: DashboardReportSource | null } {
  if (stored) {
    return { payload: stored, source: "stored" };
  }

  if (dbLatest) {
    return { payload: dbLatest, source: "database" };
  }

  return { payload: null, source: null };
}

export function formatAuditedDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
