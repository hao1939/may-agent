import { afterAll, beforeAll, describe, expect, it, spyOn } from "bun:test";
import { createScrapeTool } from "./scrape.js";

describe("scrape_webpage", () => {
  const html =
    "<html><body><script>hiddenScript()</script><style>hiddenStyle</style><p>Hello <b>world</b> &amp; friends</p></body></html>";
  let server: ReturnType<typeof Bun.serve>;
  beforeAll(() => {
    server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch(request) {
        switch (new URL(request.url).pathname) {
          case "/redirect":
            return Response.redirect(new URL("/html", request.url), 302);
          case "/error":
            return new Response("Fixture unavailable", { status: 503 });
          case "/text":
            return new Response("0123456789".repeat(20), { headers: { "Content-Type": "text/plain" } });
          default:
            return new Response(html, { headers: { "Content-Type": "text/html" } });
        }
      },
    });
  });
  afterAll(() => server?.stop(true));
  const tool = createScrapeTool({ timeoutMs: 2000, defaultMaxLength: 5000 });
  async function scrape(path: string, options: { raw?: boolean; maxLength?: number } = {}) {
    const result = await tool.execute("scrape", { url: new URL(path, server.url).href, ...options });
    const part = result.content[0];
    if (part.type !== "text") throw new Error("Expected a text result");
    return part.text;
  }
  it.each([
    ["not-a-url", "Invalid URL"],
    ["ftp://example.com/file", "Only http:// and https://"],
  ])("rejects unsupported URL %s", async (url, error) => {
    const result = await tool.execute("invalid", { url });
    expect(result.content[0]).toMatchObject({ type: "text", text: expect.stringContaining(error) });
  });
  it("fetches and cleans real HTML, including redirects", async () => {
    const text = await scrape("/redirect");
    expect(text).toContain("Status: 200");
    expect(text).toContain("Redirected: yes");
    expect(text.split("--- Content ---\n\n")[1]).toBe("Hello world & friends");
  });
  it("returns the exact HTML when raw is requested", async () => {
    const text = await scrape("/html", { raw: true });
    expect(text).toContain("Status: 200");
    expect(text.split("--- Content ---\n\n")[1]).toBe(html);
  });
  it("preserves plain text and truncates at the requested length", async () => {
    expect((await scrape("/text")).split("--- Content ---\n\n")[1]).toBe("0123456789".repeat(20));
    const truncated = await scrape("/text", { maxLength: 15 });
    expect(truncated).toContain("Status: 200");
    expect(truncated.split("--- Content ---\n\n")[1].split("\n\n")[0]).toBe("012345678901234");
    expect(truncated).toContain("Truncated at 15 chars");
  });
  it("reports a real HTTP failure with its response body", async () => {
    const text = await scrape("/error");
    expect(text).toContain("Status: 503");
    expect(text).toContain("--- Response Body (error) ---\nFixture unavailable");
    expect(text).not.toContain("--- Content ---");
  });
  it("reports DNS failure separately from successful content", async () => {
    const fetch = spyOn(globalThis, "fetch").mockRejectedValue(new Error("ENOTFOUND"));
    try {
      expect(await scrape("/html")).toContain("Error: DNS resolution failed");
      expect(fetch).toHaveBeenCalledTimes(1);
    } finally {
      fetch.mockRestore();
    }
  });
});
