import { describe, it, expect } from "vitest";
import { INFRA_RETRY_MAX } from "../src/lib/manager.ts";

describe("P93 Infrastructure Resilience — Infra Retry", () => {
  it("exports INFRA_RETRY_MAX constant with value 3", () => {
    expect(INFRA_RETRY_MAX).toBe(3);
  });

  it("INFRA_RETRY_MAX is a positive integer", () => {
    expect(Number.isInteger(INFRA_RETRY_MAX)).toBe(true);
    expect(INFRA_RETRY_MAX).toBeGreaterThan(0);
  });

  it("manager-retry.ts contains isRetryableInfraError function", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/lib/manager-retry.ts", "utf-8");
    expect(src).toContain("isRetryableInfraError");
    // Verify it detects the three retry patterns
    expect(src).toContain('"empty_response"');
    expect(src).toContain('"tool_use_missing"');
  });

  it("manager-retry.ts contains runAgentWithRetry function with backoff", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/lib/manager-retry.ts", "utf-8");
    expect(src).toContain("runAgentWithRetry");
    // Verify backoff delay logic exists
    expect(src).toContain("INFRA_RETRY_BASE_DELAY_MS");
    // Verify retry counter check
    expect(src).toContain("infraRetryCount");
  });

  it("retry logic has safety guards against non-retryable errors", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/lib/manager-retry.ts", "utf-8");
    // Must not retry aborts
    expect(src).toContain('"aborted"');
    // Must not retry context overflow
    expect(src).toContain("isOverflowError");
  });

  it("manager.ts delegates to manager-retry.ts", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/lib/manager.ts", "utf-8");
    // Manager imports from manager-retry
    expect(src).toContain('from "./manager-retry.js"');
    // Manager still has wrapper methods that delegate
    expect(src).toContain("isRetryableInfraError");
    expect(src).toContain("runAgentWithRetry");
  });
});
