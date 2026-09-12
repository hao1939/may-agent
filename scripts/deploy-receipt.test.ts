import { describe, expect, it } from "bun:test";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import { readDeployReceiptForTask, requestReceipt, settleReceipt, validateDeployTaskTarget } from "./deploy-receipt";
import { appTaskTestContext } from "../src/app/core/tasks/app-task-test-support.js";
import {
  cancelAppTask,
  claimObservedAppTask,
  closeAppTask,
  completeAppTask,
  observeAppTaskIntent,
} from "../src/app/core/tasks/app-task-reconciler.js";

function fixture() {
  const projectDir = mkdtempSync(join(tmpdir(), "deploy-receipt-"));
  const receiptDir = join(projectDir, ".state", "deploy-receipts");
  mkdirSync(receiptDir, { recursive: true });
  return { projectDir, receiptDir, path: join(receiptDir, "correlation-1.json") };
}

function taskDatabase(projectDir: string, appId: string, taskIds: string[]): string {
  const path = join(projectDir, "may.db");
  const config = appTaskTestContext({
    appDir: projectDir,
    appId,
    maxConcurrent: 1,
    agent: "owner",
    databasePath: path,
    tree: { root_task_id: "root", groups: { root: { id: "root", parent_id: null } } },
  });
  try {
    for (const id of taskIds) {
      observeAppTaskIntent(config, {
        appAgent: "owner",
        intent: {
          id,
          parentId: "root",
          mode: "achieve",
          outcome: "Verify deployment",
          acceptance: ["Return deployment evidence"],
        },
      });
      if (id === "answered") {
        const claim = claimObservedAppTask(config, { taskId: id, appAgent: "owner", handler: "agent" });
        if (claim.kind !== "claimed") throw new Error("Expected fixture claim");
        completeAppTask(config, claim, { summary: "Verified", evidence: ["fixture:deployment"] });
      }
      if (id === "closed" || id === "cancelled") {
        const task = config.resourceStore.readTask(id)!;
        const control = {
          appId,
          taskId: id,
          reason: "Owner closed fixture work",
          expectedGeneration: task.metadata.generation,
          expectedResourceVersion: task.metadata.resourceVersion,
        };
        if (id === "closed") closeAppTask(config, control);
        else cancelAppTask(config, control);
      }
    }
  } finally {
    config.resourceStore.close();
  }
  return path;
}

describe("restart-aware deploy receipts", () => {
  it("rejects a stale exact-task wake before deployment", () => {
    const f = fixture();
    try {
      const dbPath = taskDatabase(f.projectDir, "may-agent", ["live", "answered", "closed", "cancelled"]);
      expect(() => validateDeployTaskTarget(dbPath, "may-agent", "missing")).toThrow(
        "does not exist; refusing to emit an unresolvable targeted wake",
      );
      expect(() => validateDeployTaskTarget(dbPath, "other", "live")).toThrow(
        "May runtime deployment belongs to may-agent, not other",
      );
      expect(() => validateDeployTaskTarget(dbPath, "may-agent", "live")).not.toThrow();
      expect(() => validateDeployTaskTarget(dbPath, "may-agent", "answered")).not.toThrow();
      for (const id of ["closed", "cancelled"])
        expect(() => validateDeployTaskTarget(dbPath, "may-agent", id)).toThrow("is closed");
    } finally {
      rmSync(f.projectDir, { recursive: true, force: true });
    }
  });

  it("rejects a task owned by another App even when that task exists", () => {
    const f = fixture();
    try {
      const dbPath = taskDatabase(f.projectDir, "alpha-project", ["ops/deploy-may-runtime"]);
      expect(() => validateDeployTaskTarget(dbPath, "alpha-project", "ops/deploy-may-runtime")).toThrow(
        "May runtime deployment belongs to may-agent, not alpha-project",
      );
    } finally {
      rmSync(f.projectDir, { recursive: true, force: true });
    }
  });

  it("rejects a database without canonical resource authority", () => {
    const f = fixture();
    try {
      const dbPath = taskDatabase(f.projectDir, "may-agent", ["live"]);
      const db = new Database(dbPath);
      db.query("DELETE FROM app_task_store_meta WHERE app_id = ? AND key = 'authority'").run("may-agent");
      db.close();

      expect(() => validateDeployTaskTarget(dbPath, "may-agent", "live")).toThrow(
        "Task resources for may-agent are not canonical",
      );
    } finally {
      rmSync(f.projectDir, { recursive: true, force: true });
    }
  });

  it("does not accept retained legacy JSON as deployment authority", () => {
    const f = fixture();
    try {
      const path = join(f.projectDir, "state.json");
      const retained = '{"project":"may-agent","resources":{"live":{}}}\n';
      writeFileSync(path, retained);
      expect(() => validateDeployTaskTarget(path, "may-agent", "live")).toThrow("Cannot read deploy task database");
      expect(readFileSync(path, "utf8")).toBe(retained);
    } finally {
      rmSync(f.projectDir, { recursive: true, force: true });
    }
  });

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
        verification: expect.stringContaining("report the result to the owning Task without redeploying"),
      });
      expect(readDeployReceiptForTask(f.receiptDir, "may-agent", "task-1")).toEqual(receipt);
    } finally {
      rmSync(f.projectDir, { recursive: true, force: true });
    }
  });

  it("exposes succeeded verification of SHA, health, and idempotency", () => {
    const f = fixture();
    try {
      requestReceipt(f.path, "may-agent", "task-1", "correlation-1", "abc123");
      settleReceipt(f.path, "succeeded", "abc123", "healthy");
      const receipt = readDeployReceiptForTask(f.receiptDir, "may-agent", "task-1");
      expect(receipt).toMatchObject({
        phase: "succeeded",
        loadedArtifactSha: "abc123",
        health: "healthy",
        duplicateDeploy: false,
      });
      expect(receipt?.verification).toContain("loadedArtifactSha equals artifactSha");
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

      settleReceipt(f.path, "succeeded", "abc123", "healthy");

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
          "health-check-failed",
        );
        expect(readDeployReceiptForTask(f.receiptDir, "may-agent", "task-1")).toMatchObject({
          phase, loadedArtifactSha: "oldsha", failure: "health-check-failed", duplicateDeploy: false,
        });
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

  it("reports absence without treating it as permission to deploy", () => {
    const f = fixture();
    try {
      expect(readDeployReceiptForTask(f.receiptDir, "may-agent", "legacy-task")).toBeNull();
    } finally {
      rmSync(f.projectDir, { recursive: true, force: true });
    }
  });

  it("reopens exact App/Task evidence through the read-only CLI after a lost wake", async () => {
    const f = fixture();
    try {
      requestReceipt(f.path, "may-agent", "task-1", "correlation-1", "abc123");
      settleReceipt(f.path, "succeeded", "abc123", "healthy");
      const before = readFileSync(f.path, "utf8");
      requestReceipt(join(f.projectDir, ".state/deploy-receipts/foreign.json"), "another-app", "task-1", "foreign", "wrong");
      requestReceipt(join(f.projectDir, ".state/deploy-receipts/another-task.json"), "may-agent", "task-2", "other", "wrong");
      const child = Bun.spawn({
        cmd: [process.execPath, "scripts/deploy-receipt.ts", "read-task", f.receiptDir, "may-agent", "task-1"],
        cwd: join(import.meta.dir, ".."), stdout: "pipe", stderr: "pipe", timeout: 5000,
      });
      const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
      expect({ code, stderr }).toEqual({ code: 0, stderr: "" });
      expect(JSON.parse(stdout)).toEqual(JSON.parse(before));
      expect(readFileSync(f.path, "utf8")).toBe(before);
      expect(requestReceipt(f.path, "may-agent", "task-1", "correlation-1", "abc123")).toBe(false);
      // Corruption is uncertainty, never an empty result that permits a retry.
      writeFileSync(f.path, JSON.stringify({ ...JSON.parse(before), requestedAt: "invalid" }));
      expect(() => readDeployReceiptForTask(f.receiptDir, "may-agent", "task-1")).toThrow("Invalid deployment receipt");
    } finally {
      rmSync(f.projectDir, { recursive: true, force: true });
    }
  });

  it("settles terminal receipt state before emitting its best-effort task wake", () => {
    const restarter = readFileSync(new URL("../container/may-agent-supervisor-restart.sh", import.meta.url), "utf8");
    expect(restarter.indexOf('settle succeeded "$loaded" healthy')).toBeLessThan(
      restarter.indexOf("emit_wake succeeded"),
    );
    expect(restarter).toContain(
      'emit_wake succeeded || echo "[may-agent-restarter] terminal task wake failed; periodic recovery will observe the settled receipt"',
    );
    expect(restarter.indexOf('settle rolled_back "$loaded" "$rollback_health" health-check-failed')).toBeLessThan(
      restarter.indexOf("emit_wake rolled_back"),
    );
    expect(restarter).toContain('settle failed "$loaded" unhealthy "restarter-exit-$rc"');
  });

  it("uses the same startup-sized health wait for deployment and rollback", () => {
    const restarter = readFileSync(new URL("../container/may-agent-supervisor-restart.sh", import.meta.url), "utf8");
    expect(restarter).toContain('health_attempts="${MAY_AGENT_HEALTH_ATTEMPTS:-90}"');
    expect(restarter.match(/if wait_for_health; then/g)).toHaveLength(2);
  });

  it("builds deployable artifacts from one immutable tested commit", () => {
    const deploy = readFileSync(new URL("./deploy.sh", import.meta.url), "utf8");
    expect(deploy).toContain('project="may-agent"');
    expect(deploy).not.toContain("MAY_AGENT_DEPLOY_PROJECT:-");
    expect(deploy).toContain('task_db="${MAY_AGENT_DEPLOY_TASK_DB:-${STATE_DIR:-/app/.state}/may.db}"');
    expect(deploy).toContain('deploy-receipt.ts validate-target "$task_db" "$project" "$task_id"');
    const validation = 'deploy-receipt.ts validate-target "$task_db" "$project" "$task_id"';
    expect(deploy.split(validation)).toHaveLength(3);
    expect(deploy.indexOf(validation)).toBeLessThan(deploy.indexOf("bun run bundle"));
    expect(deploy.lastIndexOf(validation)).toBeGreaterThan(deploy.indexOf("bun run bundle"));
    expect(deploy.lastIndexOf(validation)).toBeLessThan(deploy.indexOf("deploy-receipt.ts request"));
    expect(deploy).not.toContain("state.json");
    expect(deploy).toContain('source_commit="$(git rev-parse --verify HEAD)"');
    expect(deploy).toContain('canonical_commit="$(git -C "$deploy_root" rev-parse --verify HEAD)"');
    expect(deploy).toContain('git merge-base --is-ancestor "$canonical_commit" "$source_commit"');
    expect(deploy).toContain('git archive "$source_commit" | tar -x -C "$build_dir"');
    expect(deploy).toContain(
      "bun test packages/control/src/client.test.ts packages/control/src/control-socket.test.ts src/app/modes/emit-mode.test.ts",
    );
    expect(deploy).toContain('MAY_AGENT_BUILD_COMMIT="$source_commit" bun run bundle');
    expect(deploy).toContain('MAY_AGENT_UI_OUTPUT_DIR="$build_dir/bundle/platform-ui"');
    expect(deploy).toContain("$bundle_dir/may-agent.provenance.json");
    expect(deploy).toContain('"$artifact_sha" "$source_commit"');
    expect(deploy).toContain('sdk_release_name="sdk-$source_commit"');
    expect(deploy).toContain('cp -R "$build_dir/packages/sdk/." "$sdk_stage/"');
    expect(deploy).toContain('ui_release_name="ui-$source_commit"');
    expect(deploy).toContain('cp -R "$build_dir/bundle/platform-ui/." "$ui_stage/"');
  });

  it("can stage an immutable source-worktree build into the canonical deploy root", () => {
    const deploy = readFileSync(new URL("./deploy.sh", import.meta.url), "utf8");
    expect(deploy).toContain('deploy_root="${MAY_AGENT_DEPLOY_ROOT:-$PWD}"');
    expect(deploy).toContain('receipt_dir="${MAY_AGENT_DEPLOY_RECEIPT_DIR:-$deploy_root/.state/deploy-receipts}"');
    expect(deploy).toContain('bundle_dir="$deploy_root/bundle"');
    expect(deploy).toContain('install -m 755 "$build_dir/bundle/may-agent" "$bundle_dir/may-agent.next"');
    expect(deploy).toContain(
      'install -m 755 "$build_dir/packages/terminal/bin/may-console.cjs" "$bundle_dir/may-console.next"',
    );
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
    expect(deploy).toContain('mv -f "$bundle_dir/ui-requested.next" "$bundle_dir/ui-requested"');
    expect(deploy).toContain("docker exec -u root");
    expect(deploy).toContain('cmp -s "$staged_restarter" "$installed_restarter"');
    expect(deploy).toContain("fail_restarter_launch restarter-update-requires-root");
    expect(deploy).toContain("fail_restarter_launch docker-launch-failed");
    expect(deploy).toContain("fail_restarter_launch supervisor-launch-failed");
    expect(deploy).toContain(
      'rm -f "$bundle_dir/deploy-requested" "$bundle_dir/sdk-requested" "$bundle_dir/ui-requested"',
    );
    expect(deploy).toContain('deploy-receipt.ts settle "$receipt" failed "$artifact_sha" unhealthy "$failure"');
    const restarter = readFileSync(new URL("../container/may-agent-supervisor-restart.sh", import.meta.url), "utf8");
    expect(restarter).toContain(
      'receipt_tool="${MAY_AGENT_DEPLOY_RECEIPT_TOOL:-/app/projects/may-agent/bundle/deploy-receipt.ts}"',
    );
    expect(restarter).toContain(
      'receipt_dir="${MAY_AGENT_DEPLOY_RECEIPT_DIR:-/app/projects/may-agent/.state/deploy-receipts}"',
    );
    expect(restarter).toContain('sdk_root="${MAY_AGENT_DEPLOY_SDK_ROOT:-/app/projects/may-agent/bundle}"');
    expect(restarter).not.toContain('sdk_root="${MAY_AGENT_SDK_ROOT:-');
    expect(restarter).toContain('switch_sdk "$sdk_release"');
    expect(restarter).toContain('switch_sdk "$previous_sdk_release"');
    expect(restarter).toContain(
      'console_bundle="${MAY_CONSOLE_BUNDLE_PATH:-/app/projects/may-agent/bundle/may-console}"',
    );
    expect(restarter).toContain('install -m 755 "$console_bundle" "$console_install_tmp"');
    expect(restarter).toContain('install -m 755 "$console_backup" "$console_target"');
    expect(restarter).toContain(
      'ui_marker="${MAY_AGENT_UI_DEPLOY_MARKER:-/app/projects/may-agent/bundle/ui-requested}"',
    );
    expect(restarter).toContain('ui_target="${MAY_AGENT_UI_PATH:-/app/projects/platform/ui}"');
    expect(restarter).toContain('ui_release="$(cat "$ui_marker" 2>/dev/null || true)"');
    expect(restarter).toContain('ln -s "$ui_root/$ui_release" "$ui_link_tmp"');
    expect(restarter).toContain('mv "$ui_backup" "$ui_target"');
  });
});
