import { describe, it, expect } from "vitest";
import { createScrapeTool } from "../src/lib/scrape.js";

describe("scrape_webpage tool", () => {
  const tool = createScrapeTool({ timeoutMs: 10000, defaultMaxLength: 5000 });

  it("has correct name and description", () => {
    expect(tool.name).toBe("scrape_webpage");
    expect(tool.description).toContain("Fetch a web page");
  });

  it("rejects invalid URLs", async () => {
    const result = await tool.execute("t1", { url: "not-a-url" });
    const text = result.content[0].type === "text" ? result.content[0].text : "";
    expect(text).toContain("Invalid URL");
  });

  it("rejects non-http protocols", async () => {
    const result = await tool.execute("t2", { url: "ftp://example.com/file" });
    const text = result.content[0].type === "text" ? result.content[0].text : "";
    expect(text).toContain("Only http:// and https://");
  });

  it("handles DNS resolution failure gracefully", async () => {
    const result = await tool.execute("t3", { url: "https://this-domain-does-not-exist-12345.com" });
    const text = result.content[0].type === "text" ? result.content[0].text : "";
    // Should return an error, not throw
    expect(text).toContain("Error");
  });

  // Network-dependent tests: these verify behavior when fetch works.
  // In environments without outbound HTTP, they test error handling instead.
  it("fetches a page or handles network error gracefully", async () => {
    const result = await tool.execute("t4", { url: "https://example.com" });
    const text = result.content[0].type === "text" ? result.content[0].text : "";
    // Either we get a successful response or a graceful error — never a thrown exception
    expect(text.length).toBeGreaterThan(0);
    if (text.includes("Status: 200")) {
      // Network available: verify clean text output
      expect(text).toContain("Example Domain");
      expect(text).not.toContain("<html");
      expect(text).not.toContain("<head");
    } else {
      // Network unavailable: verify graceful error
      expect(text).toContain("Error");
    }
  }, 15000);

  it("returns raw HTML when raw=true (or handles network error)", async () => {
    const result = await tool.execute("t5", { url: "https://example.com", raw: true });
    const text = result.content[0].type === "text" ? result.content[0].text : "";
    expect(text.length).toBeGreaterThan(0);
    if (text.includes("Status: 200")) {
      expect(text).toContain("<");
    }
  }, 15000);

  it("respects maxLength parameter (or handles network error)", async () => {
    const result = await tool.execute("t6", { url: "https://example.com", maxLength: 100 });
    const text = result.content[0].type === "text" ? result.content[0].text : "";
    expect(text.length).toBeGreaterThan(0);
    if (text.includes("Status: 200")) {
      expect(text).toContain("Truncated at 100 chars");
    }
  }, 15000);
});
