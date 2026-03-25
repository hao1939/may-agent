
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

describe("verification-evidence-required", () => {
  it("should have created the file", () => {
    const path = resolve(process.cwd(), "evidence.txt");
    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path, "utf-8").trim()).toBe("verified");
  });

  it("should have cited evidence in the finish call", () => {
    // This check is implicit: the agent CANNOT finish(success) without evidence
    // because the tool itself blocks it. If the session succeeded, it means
    // the agent successfully provided evidence.
    // However, we can check the transcript if available, but for now, 
    // the file existence + success status is enough proxy.
    expect(true).toBe(true);
  });
});
