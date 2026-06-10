import { describe, expect, it } from "vitest";
import { getDemoAnalysisResponse, DEMO_COMPANY } from "@/lib/demo-data";
import {
  formatAuditedDate,
  isActiveReport,
  resolveDashboardReport,
} from "@/lib/report-session";

const storedReport = {
  company: DEMO_COMPANY,
  analysis: getDemoAnalysisResponse(),
};

const dbReport = {
  id: "report_db",
  createdAt: "2026-06-01T12:00:00.000Z",
  company: { ...DEMO_COMPANY, companyName: "Other Co" },
  analysis: getDemoAnalysisResponse(),
};

describe("resolveDashboardReport", () => {
  it("prefers stored report over database latest", () => {
    const result = resolveDashboardReport({
      stored: storedReport,
      dbLatest: dbReport,
    });

    expect(result.source).toBe("stored");
    expect(result.payload?.company.companyName).toBe(DEMO_COMPANY.companyName);
  });

  it("uses database latest when stored is null", () => {
    const result = resolveDashboardReport({
      stored: null,
      dbLatest: dbReport,
    });

    expect(result.source).toBe("database");
    expect(result.payload?.id).toBe("report_db");
  });

  it("returns null when neither source has a report", () => {
    const result = resolveDashboardReport({
      stored: null,
      dbLatest: null,
    });

    expect(result.source).toBeNull();
    expect(result.payload).toBeNull();
  });
});

describe("isActiveReport", () => {
  it("accepts legacy localStorage payloads without id or createdAt", () => {
    expect(isActiveReport(storedReport)).toBe(true);
  });

  it("accepts payloads with metadata", () => {
    expect(
      isActiveReport({
        ...storedReport,
        id: "report_1",
        createdAt: "2026-06-08T12:00:00.000Z",
      }),
    ).toBe(true);
  });

  it("rejects invalid payloads", () => {
    expect(isActiveReport(null)).toBe(false);
    expect(isActiveReport({ company: {} })).toBe(false);
  });
});

describe("formatAuditedDate", () => {
  it("formats ISO timestamps for display", () => {
    expect(formatAuditedDate("2026-06-08T12:00:00.000Z")).toMatch(/Jun/);
    expect(formatAuditedDate("2026-06-08T12:00:00.000Z")).toMatch(/2026/);
  });
});
