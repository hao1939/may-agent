import { describe, expect, it } from "bun:test";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
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
      expect(requestReceipt(f.path, "may-agent", "task-1", "correlation-1", "abc123", "deadbeef")).toBe(true);
      const receipt = JSON.parse(readFileSync(f.path, "utf8"));
      expect(receipt).toEqual({
        version: 1,
        correlation: "correlation-1",
        project: "may-agent",
        taskId: "task-1",
        artifactSha: "abc123",
        sourceCommit: "deadbeef",
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

  it("preserves receipt ownership and mode when a privileged restarter settles it", () => {
    const f = fixture();
    try {
      requestReceipt(f.path, "may-agent", "task-1", "correlation-1", "abc123");
      chmodSync(f.path, 0o640);
      const before = statSync(f.path);

      settleReceipt(f.path, "succeeded", "abc123", "healthy", true);

      const after = statSync(f.path);
      expect(after.uid).toBe(before.uid);
      expect(after.gid).toBe(before.gid);
      expect(after.mode & 0o777).toBe(0o640);
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
    expect(restarter).toContain("if emit_wake rolled_back; then rollback_wake=true; fi");
    expect(restarter).toContain(
      'settle rolled_back "$loaded" "$rollback_health" "$rollback_wake"',
    );
    expect(restarter).toContain('settle failed "$loaded" unhealthy false "restarter-exit-$rc"');
  });

  it("uses the same startup-sized health wait for deployment and rollback", () => {
    const restarter = readFileSync(new URL("../container/may-agent-supervisor-restart.sh", import.meta.url), "utf8");
    expect(restarter).toContain('health_attempts="${MAY_AGENT_HEALTH_ATTEMPTS:-90}"');
    expect(restarter.match(/if wait_for_health; then/g)).toHaveLength(2);
  });

  it("builds deployable artifacts from one immutable tested commit", () => {
    const deploy = readFileSync(new URL("./deploy.sh", import.meta.url), "utf8");
    expect(deploy).toContain('source_commit="$(git rev-parse --verify HEAD)"');
    expect(deploy).toContain('git archive "$source_commit" | tar -x -C "$build_dir"');
    expect(deploy).toContain(
      "bun test packages/control/src/client.test.ts packages/control/src/control-socket.test.ts src/app/modes/emit-mode.test.ts",
    );
    expect(deploy).toContain('$bundle_dir/may-agent.provenance.json');
    expect(deploy).toContain('"$artifact_sha" "$source_commit"');
    expect(deploy).toContain('sdk_release_name="sdk-$source_commit"');
    expect(deploy).toContain('cp -R "$build_dir/packages/sdk/." "$sdk_stage/"');
  });

  it("can stage an immutable source-worktree build into the canonical deploy root", () => {
    const deploy = readFileSync(new URL("./deploy.sh", import.meta.url), "utf8");
    expect(deploy).toContain('deploy_root="${MAY_AGENT_DEPLOY_ROOT:-$PWD}"');
    expect(deploy).toContain('receipt_dir="${MAY_AGENT_DEPLOY_RECEIPT_DIR:-$deploy_root/.state/deploy-receipts}"');
    expect(deploy).toContain('bundle_dir="$deploy_root/bundle"');
    expect(deploy).toContain('install -m 755 "$build_dir/bundle/may-agent" "$bundle_dir/may-agent.next"');
    expect(deploy).toContain(
      'install -m 755 "$build_dir/container/may-agent-supervisor-restart.sh" "$bundle_dir/may-agent-supervisor-restart.next"',
    );
    expect(deploy).toContain(
      'install -m 644 "$build_dir/scripts/deploy-receipt.ts" "$bundle_dir/deploy-receipt.ts.next"',
    );
    expect(deploy).not.toContain(
      "install -m 755 container/may-agent-supervisor-restart.sh /usr/local/bin/may-agent-supervisor-restart",
    );
    expect(deploy).toContain(
      "install -m 755 /app/projects/may-agent/bundle/may-agent-supervisor-restart /usr/local/bin/may-agent-supervisor-restart",
    );
    expect(deploy).toContain('mv -f "$bundle_dir/deploy-requested.next" "$bundle_dir/deploy-requested"');
    expect(deploy).toContain('mv -f "$bundle_dir/sdk-requested.next" "$bundle_dir/sdk-requested"');
    const restarter = readFileSync(new URL("../container/may-agent-supervisor-restart.sh", import.meta.url), "utf8");
    expect(restarter).toContain(
      'receipt_tool="${MAY_AGENT_DEPLOY_RECEIPT_TOOL:-/app/projects/may-agent/bundle/deploy-receipt.ts}"',
    );
    expect(restarter).toContain('switch_sdk "$sdk_release"');
    expect(restarter).toContain('switch_sdk "$previous_sdk_release"');
  });
});
