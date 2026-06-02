import { describe, expect, it } from "vitest";
import { assertPublicHttpUrl, stripScriptsAndStyles } from "@/lib/fetch-public-page-text";

describe("assertPublicHttpUrl", () => {
  it("accepts public https URLs", () => {
    const url = assertPublicHttpUrl("https://example.com/about");
    expect(url.hostname).toBe("example.com");
  });

  it("rejects localhost", () => {
    expect(() => assertPublicHttpUrl("http://localhost:3000")).toThrow(/not allowed/i);
  });

  it("rejects private IPv4 ranges", () => {
    expect(() => assertPublicHttpUrl("http://192.168.1.1")).toThrow(/not allowed/i);
  });
});

describe("stripScriptsAndStyles", () => {
  it("removes script and style blocks", () => {
    const html = "<p>Hi</p><script>alert(1)</script><style>.x{}</style>";
    expect(stripScriptsAndStyles(html)).toBe("<p>Hi</p>");
  });
});
