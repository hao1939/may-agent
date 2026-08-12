import { describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deployReceiptPrompt, readDeployReceiptForTask } from "../src/app/loader/project-app-loader";
import { requestReceipt, settleReceipt } from "./deploy-receipt";

function fixture() {
  const projectDir = mkdtempSync(join(tmpdir(), "deploy-receipt-"));
  const receiptDir = join(projectDir, ".state", "deploy-receipts");
  mkdirSync(receiptDir, { recursive: true });
  return { projectDir, path: join(receiptDir, "correlation-1.json") };
}

describe("restart-aware deploy receipts", () => {
  it("persists requested metadata before interruption and tells recovery to wait", () => {
    const f = fixture();
    try {
      expect(requestReceipt(f.path, "may-agent", "task-1", "correlation-1", "abc123")).toBe(true);
      const receipt = JSON.parse(readFileSync(f.path, "utf8"));
      expect(receipt).toEqual({
        version: 1,
        correlation: "correlation-1",
        project: "may-agent",
        taskId: "task-1",
        artifactSha: "abc123",
        phase: "requested",
        requestedAt: expect.any(String),
        verification: expect.stringContaining("complete the owner task without redeploying"),
      });
      expect(deployReceiptPrompt(f.projectDir, "task-1").join("\n")).toContain("Do not deploy again");
    } finally {
      rmSync(f.projectDir, { recursive: true, force: true });
    }
  });

  it("injects succeeded verification of SHA, health, wake, and idempotency", () => {
    const f = fixture();
    try {
      requestReceipt(f.path, "may-agent", "task-1", "correlation-1", "abc123");
      settleReceipt(f.path, "succeeded", "abc123", "healthy", true);
      const receipt = readDeployReceiptForTask(f.projectDir, "task-1");
      expect(receipt).toMatchObject({
        phase: "succeeded",
        loadedArtifactSha: "abc123",
        health: "healthy",
        targetedWake: true,
        duplicateDeploy: false,
      });
      expect(deployReceiptPrompt(f.projectDir, "task-1").join("\n")).toContain("loadedArtifactSha equals artifactSha");
    } finally {
      rmSync(f.projectDir, { recursive: true, force: true });
    }
  });

  it("surfaces rollback and failure as terminal no-redeploy phases", () => {
    for (const phase of ["rolled_back", "failed"] as const) {
      const f = fixture();
      try {
        requestReceipt(f.path, "may-agent", "task-1", "correlation-1", "abc123");
        settleReceipt(
          f.path,
          phase,
          "oldsha",
          phase === "rolled_back" ? "healthy" : "unhealthy",
          true,
          "health-check-failed",
        );
        const prompt = deployReceiptPrompt(f.projectDir, "task-1").join("\n");
        expect(prompt).toContain(`terminal phase ${phase}`);
        expect(prompt).toContain("Do not redeploy this correlation");
      } finally {
        rmSync(f.projectDir, { recursive: true, force: true });
      }
    }
  });

  it("refuses a duplicate correlation without mutating its receipt", () => {
    const f = fixture();
    try {
      expect(requestReceipt(f.path, "may-agent", "task-1", "correlation-1", "abc123")).toBe(true);
      const before = readFileSync(f.path, "utf8");
      expect(requestReceipt(f.path, "may-agent", "task-1", "correlation-1", "different")).toBe(false);
      expect(readFileSync(f.path, "utf8")).toBe(before);
    } finally {
      rmSync(f.projectDir, { recursive: true, force: true });
    }
  });

  it("uses an explicit conservative no-redeploy branch for legacy absence", () => {
    const f = fixture();
    try {
      expect(readDeployReceiptForTask(f.projectDir, "legacy-task")).toBeNull();
      expect(deployReceiptPrompt(f.projectDir, "legacy-task").join("\n")).toContain("Do not blindly redeploy");
    } finally {
      rmSync(f.projectDir, { recursive: true, force: true });
    }
  });

  it("records a targeted wake only after the restarter emits it successfully", () => {
    const restarter = readFileSync(new URL("../container/may-agent-supervisor-restart.sh", import.meta.url), "utf8");
    expect(restarter.indexOf("emit_wake succeeded")).toBeLessThan(
      restarter.indexOf('settle succeeded "$loaded" healthy true'),
    );
    expect(restarter.indexOf("emit_wake rolled_back")).toBeLessThan(
      restarter.indexOf('settle rolled_back "$loaded" "$rollback_health" true'),
    );
    expect(restarter).toContain('settle failed "$loaded" unhealthy false "restarter-exit-$rc"');
  });
});
