/**
 * Tests for guards/finish-guard.ts — imported directly for coverage.
 * Tests: validateFinishDeliverables, enforceFinishDeliverables,
 *        validateVerificationEvidence, enforceVerificationEvidence.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("fs", async () => {
  const actual = await vi.importActual<typeof import("fs")>("fs");
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(true),
  };
});

import * as fs from "fs";
import {
  validateFinishDeliverables,
  enforceFinishDeliverables,
  validateVerificationEvidence,
  enforceVerificationEvidence,
} from "../guards/finish-guard.ts";

describe("validateFinishDeliverables", () => {
  it("returns valid for null deliverables", () => {
    const result = validateFinishDeliverables(null, "success", "/app");
    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("returns valid for empty deliverables", () => {
    const result = validateFinishDeliverables([], "success", "/app");
    expect(result.valid).toBe(true);
  });

  it("returns valid when all files exist", () => {
    (fs.existsSync as any).mockReturnValue(true);
    const result = validateFinishDeliverables(
      [{ path: "src/app.ts", description: "main app" }],
      "success",
      "/app",
    );
    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("returns invalid when files are missing", () => {
    (fs.existsSync as any).mockReturnValue(false);
    const result = validateFinishDeliverables(
      [
        { path: "src/app.ts", description: "main app" },
        { path: "src/utils.ts", description: "utils" },
      ],
      "success",
      "/app",
    );
    expect(result.valid).toBe(false);
    expect(result.missing).toEqual(["src/app.ts", "src/utils.ts"]);
  });

  it("handles absolute paths", () => {
    (fs.existsSync as any).mockReturnValue(true);
    const result = validateFinishDeliverables(
      [{ path: "/absolute/path.ts", description: "abs" }],
      "success",
      "/app",
    );
    expect(result.valid).toBe(true);
    expect(fs.existsSync).toHaveBeenCalledWith("/absolute/path.ts");
  });

  it("accepts agents-repo-relative deliverable paths when the agents-prefixed file exists", () => {
    (fs.existsSync as any).mockImplementation((p: string) =>
      p === "/app/agents/shared" || p === "/app/agents/shared/projects/demo/project.md",
    );

    const result = validateFinishDeliverables(
      [{ path: "shared/projects/demo/project.md", description: "project" }],
      "success",
      "/app",
    );

    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
    expect(fs.existsSync).toHaveBeenCalledWith("/app/shared/projects/demo/project.md");
    expect(fs.existsSync).toHaveBeenCalledWith("/app/agents/shared/projects/demo/project.md");
  });
});

describe("enforceFinishDeliverables", () => {
  it("does not throw for non-success status", () => {
    (fs.existsSync as any).mockReturnValue(false);
    expect(() =>
      enforceFinishDeliverables(
        [{ path: "missing.ts", description: "gone" }],
        "failure",
        "/app",
      ),
    ).not.toThrow();
  });

  it("throws for missing files on success", () => {
    (fs.existsSync as any).mockReturnValue(false);
    expect(() =>
      enforceFinishDeliverables(
        [{ path: "missing.ts", description: "gone" }],
        "success",
        "/app",
      ),
    ).toThrow("Ghost deliverables");
  });

  it("does not throw when all files exist on success", () => {
    (fs.existsSync as any).mockReturnValue(true);
    expect(() =>
      enforceFinishDeliverables(
        [{ path: "exists.ts", description: "here" }],
        "success",
        "/app",
      ),
    ).not.toThrow();
  });
});

describe("validateVerificationEvidence", () => {
  it("returns valid for non-success status", () => {
    const result = validateVerificationEvidence({
      status: "failure",
    });
    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it("warns when success has no evidence", () => {
    const result = validateVerificationEvidence({
      status: "success",
    });
    expect(result.valid).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("warns when success has empty evidence array", () => {
    const result = validateVerificationEvidence({
      status: "success",
      verification_evidence: [],
    });
    expect(result.valid).toBe(false);
  });

  it("valid when success has evidence", () => {
    const result = validateVerificationEvidence({
      status: "success",
      verification_evidence: ["Step 1: bash showed exit 0"],
    });
    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual([]);
  });
});

describe("enforceVerificationEvidence", () => {
  it("returns warnings for success without evidence", () => {
    const warnings = enforceVerificationEvidence({ status: "success" });
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("returns empty for non-success", () => {
    const warnings = enforceVerificationEvidence({ status: "partial" });
    expect(warnings).toEqual([]);
  });

  it("returns empty for success with evidence", () => {
    const warnings = enforceVerificationEvidence({
      status: "success",
      verification_evidence: ["verified"],
    });
    expect(warnings).toEqual([]);
  });
});
