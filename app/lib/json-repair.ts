/**
 * Best-effort recovery of JSON from a model response that may include
 * markdown fences, prefixes/suffixes, or trailing commentary.
 */
export function repairJsonString(raw: string): string {
  if (!raw) return raw;
  let cleaned = raw.trim();

  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```$/i, "")
      .trim();
  }

  const firstObj = cleaned.indexOf("{");
  const firstArr = cleaned.indexOf("[");

  let firstIdx = -1;
  let closingChar = "}";

  if (firstObj === -1 && firstArr === -1) return cleaned;
  if (firstObj === -1) {
    firstIdx = firstArr;
    closingChar = "]";
  } else if (firstArr === -1) {
    firstIdx = firstObj;
    closingChar = "}";
  } else if (firstObj < firstArr) {
    firstIdx = firstObj;
    closingChar = "}";
  } else {
    firstIdx = firstArr;
    closingChar = "]";
  }

  const lastIdx = cleaned.lastIndexOf(closingChar);
  if (lastIdx > firstIdx) {
    cleaned = cleaned.slice(firstIdx, lastIdx + 1);
  }

  return cleaned;
}

export function safeParseJson<T>(raw: string): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    try {
      return JSON.parse(repairJsonString(raw)) as T;
    } catch {
      return null;
    }
  }
}
