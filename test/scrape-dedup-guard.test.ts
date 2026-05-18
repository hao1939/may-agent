import { describe, it, expect } from "bun:test";
import { createScrapeDedupGuard, SCRAPE_BLOCK_THRESHOLD } from "../src/lib/tools/scrape-dedup-guard.js";
import type { BeforeToolCallContext } from "../src/lib/tools/compose-guards.js";

function makeCtx(name: string, args: Record<string, unknown>): BeforeToolCallContext {
  return {
    toolCall: { id: "test-" + Math.random(), name, arguments: args },
    args,
    context: { messages: [] },
  } as unknown as BeforeToolCallContext;
}

describe("scrape-dedup-guard", () => {
  it("allows first scrape of a URL", async () => {
    const guard = createScrapeDedupGuard();
    const result = await guard(makeCtx("scrape_webpage", { url: "https://arxiv.org/abs/1234" }));
    expect(result).toBeUndefined();
  });

  it("warns on second scrape of same URL", async () => {
    const guard = createScrapeDedupGuard();
    await guard(makeCtx("scrape_webpage", { url: "https://arxiv.org/abs/1234" }));
    const result = await guard(makeCtx("scrape_webpage", { url: "https://arxiv.org/abs/1234" }));
    expect(result).toBeDefined();
    expect(result!.block).toBe(false);
    expect(result!.reason).toContain("SCRAPE_DEDUP");
  });

  it("signals third scrape of same URL", async () => {
    const guard = createScrapeDedupGuard();
    await guard(makeCtx("scrape_webpage", { url: "https://arxiv.org/abs/1234" }));
    await guard(makeCtx("scrape_webpage", { url: "https://arxiv.org/abs/1234" }));
    const result = await guard(makeCtx("scrape_webpage", { url: "https://arxiv.org/abs/1234" }));
    expect(result).toBeDefined();
    expect(result!.block).toBe(false);
    expect(result!.reason).toContain("likely wasteful");
  });

  it("tracks URLs independently", async () => {
    const guard = createScrapeDedupGuard();
    await guard(makeCtx("scrape_webpage", { url: "https://arxiv.org/abs/1111" }));
    await guard(makeCtx("scrape_webpage", { url: "https://arxiv.org/abs/2222" }));
    // First scrape of each URL — both should be allowed
    const r1 = await guard(makeCtx("scrape_webpage", { url: "https://arxiv.org/abs/1111" }));
    const r2 = await guard(makeCtx("scrape_webpage", { url: "https://arxiv.org/abs/2222" }));
    // Second scrape of each — should warn (not block)
    expect(r1).toBeDefined();
    expect(r1!.block).toBe(false);
    expect(r2).toBeDefined();
    expect(r2!.block).toBe(false);
  });

  it("ignores non-scrape tools", async () => {
    const guard = createScrapeDedupGuard();
    const result = await guard(makeCtx("read", { path: "foo.md" }));
    expect(result).toBeUndefined();
  });

  it("ignores scrape calls without URL", async () => {
    const guard = createScrapeDedupGuard();
    const result = await guard(makeCtx("scrape_webpage", {}));
    expect(result).toBeUndefined();
  });

  it("normalizes URLs with trailing slashes and fragments", async () => {
    const guard = createScrapeDedupGuard();
    await guard(makeCtx("scrape_webpage", { url: "https://arxiv.org/abs/1234/" }));
    // Same URL without trailing slash should be treated as same
    const result = await guard(makeCtx("scrape_webpage", { url: "https://arxiv.org/abs/1234" }));
    expect(result).toBeDefined();
    expect(result!.block).toBe(false); // warn, not block
  });

  it("normalizes URLs with fragments", async () => {
    const guard = createScrapeDedupGuard();
    await guard(makeCtx("scrape_webpage", { url: "https://arxiv.org/abs/1234#section1" }));
    const result = await guard(makeCtx("scrape_webpage", { url: "https://arxiv.org/abs/1234#section2" }));
    expect(result).toBeDefined();
    expect(result!.block).toBe(false); // same URL sans fragment
  });

  it("treats different query params as different URLs", async () => {
    const guard = createScrapeDedupGuard();
    await guard(makeCtx("scrape_webpage", { url: "https://example.com/page?a=1" }));
    const result = await guard(makeCtx("scrape_webpage", { url: "https://example.com/page?a=2" }));
    expect(result).toBeUndefined(); // different query = different URL
  });

  it("SCRAPE_BLOCK_THRESHOLD is 2", () => {
    expect(SCRAPE_BLOCK_THRESHOLD).toBe(2);
  });
});
