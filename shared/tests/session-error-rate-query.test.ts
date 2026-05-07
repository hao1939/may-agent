import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("session.error-rate-6h metric query", () => {
  it("counts only terminal sessions in the denominator", () => {
    const source = readFileSync(resolve(__dirname, "../../may/handlers/metrics-snapshot.ts"), "utf8");

    expect(source).toContain(
      "SELECT COUNT(*) as c FROM sessions WHERE startedAt > ? AND status IN ('done','error','interrupted')",
    );
    expect(source).not.toContain(
      'const total = count("SELECT COUNT(*) as c FROM sessions WHERE startedAt > ?", sixH);',
    );
  });

  it("excludes Clean start (fresh) interruptions from the numerator", () => {
    const source = readFileSync(resolve(__dirname, "../../may/handlers/metrics-snapshot.ts"), "utf8");

    expect(source).toContain("status = 'error'");
    expect(source).toContain("status = 'interrupted' AND COALESCE(error, '') != 'Clean start (fresh)'");
    expect(source).not.toContain(
      "SELECT COUNT(*) as c FROM sessions WHERE startedAt > ? AND status IN ('error','interrupted')",
    );
  });
});
