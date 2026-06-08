import { Prisma, type Report } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { AnalysisResponse, CompanyInput, GeneratedPrompt } from "@/types";

export interface StoredReportPayload {
  company: CompanyInput;
  prompts?: GeneratedPrompt[];
  analysis: AnalysisResponse;
}

export function isReportPayload(value: unknown): value is StoredReportPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<StoredReportPayload>;
  const company = payload.company as Partial<CompanyInput> | undefined;
  return Boolean(
    company &&
      typeof company.companyName === "string" &&
      typeof company.website === "string" &&
      typeof company.description === "string" &&
      typeof company.category === "string" &&
      payload.analysis &&
      typeof payload.analysis === "object",
  );
}

export async function createReport(userId: string, payload: StoredReportPayload) {
  return prisma.report.create({
    data: {
      userId,
      companyName: payload.company.companyName,
      website: payload.company.website,
      description: payload.company.description,
      category: payload.company.category,
      logoUrl: payload.company.logoUrl ?? null,
      competitors: (payload.company.competitors ?? []) as unknown as Prisma.InputJsonValue,
      prompts: (payload.prompts ?? []) as unknown as Prisma.InputJsonValue,
      analysis: payload.analysis as unknown as Prisma.InputJsonValue,
    },
  });
}

export function serializeReport(report: Report) {
  return {
    id: report.id,
    createdAt: report.createdAt.toISOString(),
    company: {
      companyName: report.companyName,
      website: report.website,
      description: report.description,
      category: report.category,
      competitors: Array.isArray(report.competitors)
        ? (report.competitors as string[])
        : [],
      numberOfPrompts: Array.isArray(report.prompts) ? report.prompts.length : 0,
      logoUrl: report.logoUrl ?? undefined,
    },
    prompts: Array.isArray(report.prompts)
      ? (report.prompts as unknown as GeneratedPrompt[])
      : [],
    analysis: report.analysis as unknown as AnalysisResponse,
  };
}
