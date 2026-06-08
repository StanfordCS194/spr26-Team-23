import { afterEach, vi } from "vitest";

const ORIGINAL_ENV = {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();

  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  delete (globalThis as typeof globalThis & { __tunnelCache?: unknown }).__tunnelCache;
});
