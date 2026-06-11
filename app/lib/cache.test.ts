import { describe, expect, it } from "vitest";
import { createAnalysisCacheKey } from "@/lib/cache";
import { minimalCompanyFixture } from "@/lib/llms-txt-fixtures";
import { GeneratedPrompt } from "@/types";

const prompts: GeneratedPrompt[] = [
  {
    id: "p1",
    category: "discovery",
    prompt: "best tools for widgets",
    rationale: "Broad discovery",
  },
];

describe("createAnalysisCacheKey", () => {
  it("separates standard and web analysis fingerprints", () => {
    const company = minimalCompanyFixture();

    expect(createAnalysisCacheKey(company, prompts, "mode:standard|answers:gemini")).not.toBe(
      createAnalysisCacheKey(company, prompts, "mode:web|answers:gemini"),
    );
  });
});
