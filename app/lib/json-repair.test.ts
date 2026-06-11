import { describe, expect, it } from "vitest";
import { repairJsonString, safeParseJson } from "@/lib/json-repair";

describe("repairJsonString", () => {
  it("strips markdown code fences around JSON", () => {
    expect(repairJsonString("```json\n{\"ok\":true}\n```")).toBe("{\"ok\":true}");
  });

  it("extracts the first JSON object from surrounding commentary", () => {
    expect(repairJsonString("Here is the result: {\"ok\":true,\"items\":[1,2]} Thanks.")).toBe(
      "{\"ok\":true,\"items\":[1,2]}",
    );
  });

  it("extracts JSON arrays when an array appears before an object", () => {
    expect(repairJsonString("prefix [{\"id\":\"p1\"},{\"id\":\"p2\"}] suffix")).toBe(
      "[{\"id\":\"p1\"},{\"id\":\"p2\"}]",
    );
  });
});

describe("safeParseJson", () => {
  it("parses repaired fenced and suffixed JSON", () => {
    expect(safeParseJson<{ ok: boolean }>("```json\n{\"ok\":true}\n```\nDone")).toEqual({
      ok: true,
    });
  });

  it("returns null when there is no recoverable JSON payload", () => {
    expect(safeParseJson("No JSON here")).toBeNull();
  });
});
