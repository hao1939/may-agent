import { describe, expect, test } from "bun:test";
import {
  name,
  reconciliationOptions,
  workspace,
} from "./master-validation-route-verification.js";
import { exactPassNeedsOwnerProblem } from "./spec-live-reconciliation.js";

describe("master-validation route verification workflow", () => {
  test("binds the shared spec reconciliation implementation to a main workspace", () => {
    expect(name).toBe("master-validation-route-verification");
    expect(workspace).toEqual({ kind: "task", baseBranch: "main" });
    expect(reconciliationOptions).toEqual({
      targetBranch: "main",
      allowTerminalDisposition: false,
    });
  });

  test("keeps exact external capability gaps open without terminal source bookkeeping", () => {
    expect(
      exactPassNeedsOwnerProblem(
        {
          decision: "needs-owner",
          summary: "RP-proxy kubeconfig is unavailable to live execution.",
          evidence: [
            "external-capability:rp-proxy-kubeconfig",
            "external-producer:staging-hcp-environment-owner",
            "resume-condition:RP-proxy kubeconfig is mounted for ADO live execution",
            "artifact:/tmp/exact-run-result.json",
          ],
        },
        reconciliationOptions.allowTerminalDisposition,
      ),
    ).toBeNull();

    expect(
      exactPassNeedsOwnerProblem(
        {
          decision: "needs-owner",
          summary: "The carrier still needs implementation.",
          evidence: ["source-gap:execute-mode-not-implemented"],
        },
        reconciliationOptions.allowTerminalDisposition,
      ),
    ).toContain("keep internal source gaps in this workflow");
  });
});
