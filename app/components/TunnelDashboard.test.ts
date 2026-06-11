import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TunnelDashboard } from "@/components/TunnelDashboard";
import { DEMO_COMPANY, getDemoAnalysisResponse } from "@/lib/demo-data";

vi.mock("@clerk/nextjs", () => ({
  UserButton: () => null,
}));

vi.mock("next/image", () => ({
  default: () => null,
}));

vi.mock("next/link", () => ({
  default: ({ children }: { children: unknown }) => children,
}));

vi.mock("posthog-js", () => ({
  default: {
    capture: vi.fn(),
  },
}));

describe("TunnelDashboard demo report", () => {
  it("server-renders the demo report without throwing", () => {
    const html = renderToStaticMarkup(
      createElement(TunnelDashboard, {
        company: DEMO_COMPANY,
        data: getDemoAnalysisResponse(),
      }),
    );

    expect(html).toContain("Tunnel report");
    expect(html).toContain("Wine Find");
    expect(html).toContain("Visibility Score");
    expect(html).toContain("Prompt-by-Prompt Results");
    expect(html).toContain("Recommendations");
  });
});
