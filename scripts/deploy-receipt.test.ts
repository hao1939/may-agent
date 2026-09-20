import { describe, expect, it } from "bun:test";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import { readDeployReceiptForTask, requestReceipt, settleReceipt, validateDeployTaskTarget } from "./deploy-receipt";
import { appTaskTestContext } from "../src/app/core/tasks/app-task-test-support.js";
import { AppTaskResourceStore } from "../src/app/core/state/app-task-resource-store.js";
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
          outcome: "Verify deployment",
          acceptance: ["Return deployment facts"],
        },
      });
      if (id === "answered") {
        const claim = claimObservedAppTask(config, { taskId: id, appAgent: "owner", handler: "agent" });
        if (claim.kind !== "claimed") throw new Error("Expected fixture claim");
        completeAppTask(config, claim, { summary: "Verified", facts: ["fixture:deployment"] });
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

function closeFixtureTask(projectDir: string, appId: string, taskId: string): void {
  const db = new Database(join(projectDir, "may.db"));
  try {
    const resourceStore = AppTaskResourceStore.activeFromDb(db, appId);
    if (!resourceStore) throw new Error(`Expected active fixture store for ${appId}`);
    const task = resourceStore.readTask(taskId)!;
    closeAppTask(
      { appDir: projectDir, projectDir, agent: "owner", maxConcurrent: 1, resourceStore },
      {
        appId,
        taskId,
        reason: "Owner closed fixture work during build",
        expectedGeneration: task.metadata.generation,
        expectedResourceVersion: task.metadata.resourceVersion,
      },
    );
  } finally {
    db.close();
  }
}

describe("restart-aware deploy receipts", () => {
  it("accepts an exact open Task for the explicitly supplied deployment-owner App", () => {
    const f = fixture();
    try {
      const dbPath = taskDatabase(f.projectDir, "may", ["live", "answered", "closed", "cancelled"]);
      expect(() => validateDeployTaskTarget(dbPath, "may", "missing")).toThrow(
        "does not exist; refusing to emit an unresolvable targeted wake",
      );
      expect(() => validateDeployTaskTarget(dbPath, "may", "live")).not.toThrow();
      expect(() => validateDeployTaskTarget(dbPath, "may", "answered")).not.toThrow();
      for (const id of ["closed", "cancelled"])
        expect(() => validateDeployTaskTarget(dbPath, "may", id)).toThrow("is closed");
    } finally {
      rmSync(f.projectDir, { recursive: true, force: true });
    }
  });

  it("rejects a Task owned by another canonical App", () => {
    const f = fixture();
    try {
      const dbPath = taskDatabase(f.projectDir, "may", ["ops/deploy-may-runtime"]);
      taskDatabase(f.projectDir, "may-agent", ["maintenance/other"]);
      expect(() => validateDeployTaskTarget(dbPath, "may-agent", "ops/deploy-may-runtime")).toThrow(
        "Deploy task may-agent/ops/deploy-may-runtime does not exist",
      );
      expect(() => validateDeployTaskTarget(dbPath, "may", "ops/deploy-may-runtime")).not.toThrow();
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

  it("rejects malformed deployment-owner App and Task identifiers at the CLI boundary", async () => {
    const f = fixture();
    try {
      const dbPath = taskDatabase(f.projectDir, "may", ["live"]);
      for (const args of [
        ["bad app", "live"],
        ["may", "bad task"],
      ]) {
        const child = Bun.spawn({
          cmd: [process.execPath, "scripts/deploy-receipt.ts", "validate-target", dbPath, ...args],
          cwd: join(import.meta.dir, ".."),
          stdout: "pipe",
          stderr: "pipe",
          timeout: 5000,
        });
        const [code, stderr] = await Promise.all([
          child.exited,
          new Response(child.stderr).text(),
          new Response(child.stdout).text(),
        ]);
        expect(code).not.toBe(0);
        expect(stderr).toContain("Invalid");
      }
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

  it.each([
    ["verification", undefined],
    ["completedAt", undefined],
    ["completedAt", "invalid"],
    ["loadedArtifactSha", undefined],
    ["health", undefined],
    ["duplicateDeploy", undefined],
    ["sourceCommit", 7],
    ["failure", false],
    ["health", "unknown"],
    ["duplicateDeploy", "false"],
  ])("rejects malformed terminal receipt field %s=%j", (field, value) => {
    const f = fixture();
    try {
      requestReceipt(f.path, "may-agent", "task-1", "correlation-1", "abc123");
      settleReceipt(f.path, "succeeded", "abc123", "healthy");
      const invalid = { ...JSON.parse(readFileSync(f.path, "utf8")), [field as string]: value };
      const saved = JSON.stringify(invalid);
      writeFileSync(f.path, saved);
      expect(() => readDeployReceiptForTask(f.receiptDir, "may-agent", "task-1")).toThrow("Invalid deployment receipt");
      expect(readFileSync(f.path, "utf8")).toBe(saved);
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
    expect(deploy).toContain('project="${MAY_AGENT_DEPLOY_OWNER_APP:-may-agent}"');
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

  it("stops before staging or restart when the portable archive test gate fails", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-agent-deploy-gate-"));
    try {
      const repo = join(root, "repo");
      const bin = join(root, "bin");
      const log = join(root, "commands.log");
      const receiptDir = join(root, "receipts");
      mkdirSync(join(repo, "scripts"), { recursive: true });
      mkdirSync(bin);
      mkdirSync(receiptDir);
      writeFileSync(join(repo, "scripts", "deploy.sh"), readFileSync(new URL("./deploy.sh", import.meta.url)));
      chmodSync(join(repo, "scripts", "deploy.sh"), 0o755);

      const run = async (cmd: string[], env = process.env) => {
        const child = Bun.spawn({ cmd, cwd: repo, env, stdout: "pipe", stderr: "pipe", timeout: 5000 });
        const [code, stdout, stderr] = await Promise.all([
          child.exited,
          new Response(child.stdout).text(),
          new Response(child.stderr).text(),
        ]);
        return { code, stdout, stderr };
      };
      for (const cmd of [
        ["git", "init", "-q"],
        ["git", "add", "scripts/deploy.sh"],
        ["git", "-c", "user.name=Fixture", "-c", "user.email=fixture@example.test", "commit", "-qm", "fixture"],
      ]) {
        expect((await run(cmd)).code).toBe(0);
      }

      const bun = join(bin, "bun");
      writeFileSync(
        bun,
        `#!/bin/sh\nprintf '%s|%s|%s\\n' "\${MAY_TASK_ATTEMPT_CHILD-unset}" "\${KEEP_ME-unset}" "$*" >> "\$COMMAND_LOG"\nif [ "\${1-}" = test ]; then exit 42; fi\nexit 0\n`,
      );
      chmodSync(bun, 0o755);
      for (const command of ["supervisorctl", "docker"]) {
        const path = join(bin, command);
        writeFileSync(path, `#!/bin/sh\necho "RESTART|$*" >> "$COMMAND_LOG"\nexit 99\n`);
        chmodSync(path, 0o755);
      }

      const correlation = "fixture-test-gate-failure";
      const result = await run(["/bin/sh", "scripts/deploy.sh"], {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        COMMAND_LOG: log,
        KEEP_ME: "kept",
        MAY_TASK_ATTEMPT_CHILD: "1",
        MAY_AGENT_DEPLOY_OWNER_APP: "may",
        MAY_AGENT_DEPLOY_TASK_ID: "runtime/fixture",
        MAY_AGENT_DEPLOY_CORRELATION: correlation,
        MAY_AGENT_DEPLOY_ROOT: repo,
        MAY_AGENT_DEPLOY_RECEIPT_DIR: receiptDir,
        MAY_AGENT_DEPLOY_TASK_DB: join(root, "not-opened.db"),
      });

      expect(result.code).toBe(42);
      const calls = readFileSync(log, "utf8").trim().split("\n");
      expect(calls[0]).toBe(
        `1|kept|scripts/deploy-receipt.ts validate-target ${join(root, "not-opened.db")} may runtime/fixture`,
      );
      expect(calls[1]).toBe(
        "1|kept|test packages/control/src/client.test.ts packages/control/src/control-socket.test.ts src/app/modes/emit-mode.test.ts",
      );
      expect(calls.some((call) => call.includes("run bundle"))).toBe(false);
      expect(calls.some((call) => call.includes("deploy-receipt.ts request"))).toBe(false);
      expect(calls.some((call) => call.startsWith("RESTART|"))).toBe(false);
      expect(existsSync(join(receiptDir, `${correlation}.json`))).toBe(false);
      expect(existsSync(join(repo, "bundle"))).toBe(false);
      expect(existsSync(join(repo, `.state/deploy-build-${correlation}`))).toBe(false);

      writeFileSync(log, "");
      const defaultCorrelation = "fixture-default-owner";
      const defaultResult = await run(["/bin/sh", "scripts/deploy.sh"], {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        COMMAND_LOG: log,
        KEEP_ME: "kept",
        MAY_TASK_ATTEMPT_CHILD: "1",
        MAY_AGENT_DEPLOY_TASK_ID: "runtime/fixture",
        MAY_AGENT_DEPLOY_CORRELATION: defaultCorrelation,
        MAY_AGENT_DEPLOY_ROOT: repo,
        MAY_AGENT_DEPLOY_RECEIPT_DIR: receiptDir,
        MAY_AGENT_DEPLOY_TASK_DB: join(root, "not-opened.db"),
      });
      expect(defaultResult.code).toBe(42);
      expect(readFileSync(log, "utf8").split("\n")[0]).toBe(
        `1|kept|scripts/deploy-receipt.ts validate-target ${join(root, "not-opened.db")} may-agent runtime/fixture`,
      );
      expect(existsSync(join(receiptDir, `${defaultCorrelation}.json`))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails invalid App/Task targets before build, receipt, or restart effects", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-agent-deploy-target-gate-"));
    try {
      const repo = join(root, "repo");
      const bin = join(root, "bin");
      const log = join(root, "commands.log");
      mkdirSync(join(repo, "scripts"), { recursive: true });
      mkdirSync(bin);
      writeFileSync(join(repo, "scripts", "deploy.sh"), readFileSync(new URL("./deploy.sh", import.meta.url)));
      writeFileSync(
        join(repo, "scripts", "deploy-receipt.ts"),
        readFileSync(new URL("./deploy-receipt.ts", import.meta.url)),
      );
      chmodSync(join(repo, "scripts", "deploy.sh"), 0o755);

      const appDbRoot = join(root, "app-db");
      mkdirSync(appDbRoot);
      const dbPath = taskDatabase(appDbRoot, "may", ["live", "closed"]);
      taskDatabase(appDbRoot, "may-agent", ["maintenance/other"]);
      const noncanonicalRoot = join(root, "noncanonical-db");
      mkdirSync(noncanonicalRoot);
      const noncanonicalDb = taskDatabase(noncanonicalRoot, "may", ["live"]);
      const db = new Database(noncanonicalDb);
      db.query("DELETE FROM app_task_store_meta WHERE app_id = ? AND key = 'authority'").run("may");
      db.close();

      writeFileSync(
        join(bin, "bun"),
        `#!/bin/sh\nprintf 'bun|%s\\n' "$*" >> "$COMMAND_LOG"\nexec ${JSON.stringify(process.execPath)} "$@"\n`,
      );
      chmodSync(join(bin, "bun"), 0o755);
      for (const command of ["git", "supervisorctl", "docker"]) {
        writeFileSync(join(bin, command), `#!/bin/sh\necho "${command}|$*" >> "$COMMAND_LOG"\nexit 91\n`);
        chmodSync(join(bin, command), 0o755);
      }

      const cases = [
        { name: "wrong-app", database: dbPath, app: "may-agent", task: "live" },
        { name: "missing", database: dbPath, app: "may", task: "missing" },
        { name: "malformed", database: dbPath, app: "bad app", task: "live" },
        { name: "noncanonical", database: noncanonicalDb, app: "may", task: "live" },
        { name: "closed", database: dbPath, app: "may", task: "closed" },
      ];
      for (const target of cases) {
        writeFileSync(log, "");
        const receiptDir = join(root, `receipts-${target.name}`);
        const child = Bun.spawn({
          cmd: ["/bin/sh", "scripts/deploy.sh"],
          cwd: repo,
          env: {
            ...process.env,
            PATH: `${bin}:${process.env.PATH}`,
            COMMAND_LOG: log,
            MAY_AGENT_DEPLOY_OWNER_APP: target.app,
            MAY_AGENT_DEPLOY_TASK_ID: target.task,
            MAY_AGENT_DEPLOY_CORRELATION: target.name,
            MAY_AGENT_DEPLOY_ROOT: repo,
            MAY_AGENT_DEPLOY_RECEIPT_DIR: receiptDir,
            MAY_AGENT_DEPLOY_TASK_DB: target.database,
          },
          stdout: "pipe",
          stderr: "pipe",
          timeout: 5000,
        });
        const [code] = await Promise.all([
          child.exited,
          new Response(child.stdout).text(),
          new Response(child.stderr).text(),
        ]);
        expect(code).not.toBe(0);
        const calls = readFileSync(log, "utf8");
        expect(calls).toContain(`validate-target ${target.database} ${target.app} ${target.task}`);
        expect(calls).not.toContain("git|");
        expect(calls).not.toContain("supervisorctl|");
        expect(calls).not.toContain("docker|");
        expect(existsSync(join(receiptDir, `${target.name}.json`))).toBe(false);
        expect(existsSync(join(repo, "bundle"))).toBe(false);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("revalidates after build and carries an active May owner into the requested receipt", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-agent-deploy-revalidation-"));
    const runs: Array<{ child: ReturnType<typeof Bun.spawn>; result: Promise<unknown> }> = [];
    let buildRelease = "";
    try {
      const repo = join(root, "repo");
      const bin = join(root, "bin");
      const receiptDir = join(root, "receipts");
      const buildReady = join(root, "build-ready");
      buildRelease = join(root, "build-release");
      mkdirSync(join(repo, "scripts"), { recursive: true });
      mkdirSync(bin);
      mkdirSync(receiptDir);
      writeFileSync(join(repo, "scripts", "deploy.sh"), readFileSync(new URL("./deploy.sh", import.meta.url)));
      writeFileSync(
        join(repo, "scripts", "deploy-receipt.ts"),
        readFileSync(new URL("./deploy-receipt.ts", import.meta.url)),
      );
      chmodSync(join(repo, "scripts", "deploy.sh"), 0o755);
      const dbPath = taskDatabase(root, "may", ["close-during-build", "active"]);

      writeFileSync(
        join(bin, "bun"),
        `#!/bin/sh
if [ "\${1-}" = scripts/deploy-receipt.ts ]; then
  ${JSON.stringify(process.execPath)} "$@"
  rc=$?
  if [ "\${2-}" = request ] && [ "$rc" = 0 ] && [ "\${MAY_TEST_STOP_AFTER_REQUEST:-0}" = 1 ]; then exit 88; fi
  exit "$rc"
fi
if [ "\${1-}" = test ]; then exit 0; fi
if [ "\${1-}" = run ] && [ "\${2-}" = bundle ]; then
  mkdir -p bundle/platform-ui packages/terminal/bin packages/sdk container
  printf '#!/bin/sh\\nexit 0\\n' > bundle/may-agent
  printf '#!/bin/sh\\nexit 0\\n' > packages/terminal/bin/may-console.cjs
  printf '#!/bin/sh\\nexit 0\\n' > container/may-agent-supervisor-restart.sh
  printf '{}\\n' > packages/sdk/package.json
  printf 'ui\\n' > bundle/platform-ui/index.html
  chmod +x bundle/may-agent packages/terminal/bin/may-console.cjs container/may-agent-supervisor-restart.sh
  : > "$MAY_TEST_BUILD_READY"
  remaining=500
  while [ ! -e "$MAY_TEST_BUILD_RELEASE" ] && [ "$remaining" -gt 0 ]; do
    sleep 0.01
    remaining=$((remaining - 1))
  done
  [ -e "$MAY_TEST_BUILD_RELEASE" ] || exit 92
  exit 0
fi
exit 90
`,
      );
      chmodSync(join(bin, "bun"), 0o755);
      for (const command of ["supervisorctl", "docker"]) {
        writeFileSync(join(bin, command), `#!/bin/sh\necho unexpected-${command} >&2\nexit 97\n`);
        chmodSync(join(bin, command), 0o755);
      }
      const run = (taskId: string, correlation: string, extra: Record<string, string> = {}) => {
        const child = Bun.spawn({
          cmd: ["/bin/sh", "scripts/deploy.sh"],
          cwd: repo,
          env: {
            ...process.env,
            PATH: `${bin}:${process.env.PATH}`,
            MAY_AGENT_DEPLOY_OWNER_APP: "may",
            MAY_AGENT_DEPLOY_TASK_ID: taskId,
            MAY_AGENT_DEPLOY_CORRELATION: correlation,
            MAY_AGENT_DEPLOY_ROOT: repo,
            MAY_AGENT_DEPLOY_RECEIPT_DIR: receiptDir,
            MAY_AGENT_DEPLOY_TASK_DB: dbPath,
            MAY_TEST_BUILD_READY: buildReady,
            MAY_TEST_BUILD_RELEASE: buildRelease,
            ...extra,
          },
          stdout: "pipe",
          stderr: "pipe",
          timeout: 5000,
        });
        const result = Promise.all([
          child.exited,
          new Response(child.stderr).text(),
          new Response(child.stdout).text(),
        ]);
        const handle = { child, result };
        runs.push(handle);
        return handle;
      };
      for (const cmd of [
        ["git", "init", "-q"],
        ["git", "add", "scripts/deploy.sh", "scripts/deploy-receipt.ts"],
        ["git", "-c", "user.name=Fixture", "-c", "user.email=fixture@example.test", "commit", "-qm", "fixture"],
      ]) {
        const child = Bun.spawn({ cmd, cwd: repo, stdout: "pipe", stderr: "pipe", timeout: 5000 });
        const [code] = await Promise.all([
          child.exited,
          new Response(child.stdout).text(),
          new Response(child.stderr).text(),
        ]);
        expect(code).toBe(0);
      }

      const closing = run("close-during-build", "closed-after-preflight", {
        MAY_TEST_STOP_AFTER_REQUEST: "1",
      });
      for (let i = 0; i < 400 && !existsSync(buildReady); i++) await Bun.sleep(10);
      expect(existsSync(buildReady)).toBe(true);
      closeFixtureTask(root, "may", "close-during-build");
      writeFileSync(buildRelease, "continue\n");
      const [closedCode, closedStderr] = await closing.result;
      expect(closedCode).not.toBe(0);
      expect(closedStderr).toContain("is closed; it cannot accept a deployment wake");
      expect(existsSync(join(receiptDir, "closed-after-preflight.json"))).toBe(false);

      rmSync(buildReady, { force: true });
      writeFileSync(buildRelease, "continue\n");
      const active = run("active", "active-may", { MAY_TEST_STOP_AFTER_REQUEST: "1" });
      const [activeCode] = await active.result;
      expect(activeCode).toBe(88);
      expect(JSON.parse(readFileSync(join(receiptDir, "active-may.json"), "utf8"))).toMatchObject({
        project: "may",
        taskId: "active",
        correlation: "active-may",
        phase: "requested",
      });
    } finally {
      if (buildRelease) writeFileSync(buildRelease, "cleanup\n");
      await Promise.allSettled(runs.map(({ result }) => result));
      for (const { child } of runs) child.kill();
      rmSync(root, { recursive: true, force: true });
    }
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
