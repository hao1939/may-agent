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
import {
  readDeployReceipt,
  readDeployReceiptForTask,
  requestReceipt,
  settleReceipt,
  validateCorrelation,
  validateNotificationTarget,
} from "./deploy-receipt";

function fixture() {
  const projectDir = mkdtempSync(join(tmpdir(), "deploy-receipt-"));
  const receiptDir = join(projectDir, ".state", "deploy-receipts");
  mkdirSync(receiptDir, { recursive: true });
  return { projectDir, receiptDir, path: join(receiptDir, "correlation-1.json") };
}


describe("restart-aware deploy receipts", () => {
  it("persists and reads the first exact standalone receipt in a fresh directory", () => {
    const projectDir = mkdtempSync(join(tmpdir(), "deploy-receipt-fresh-"));
    const path = join(projectDir, "receipts", "correlation-1.json");
    try {
      expect(existsSync(join(projectDir, "receipts"))).toBe(false);
      expect(requestReceipt(path, undefined, undefined, "correlation-1", "abc123", "deadbeef")).toBe(true);
      expect(existsSync(join(projectDir, "receipts"))).toBe(true);
      settleReceipt(path, "succeeded", "abc123", "healthy");
      writeFileSync(join(projectDir, "receipts", "unrelated.json"), "not-json\n");
      expect(readDeployReceipt(path)).toMatchObject({
        correlation: "correlation-1",
        sourceCommit: "deadbeef",
        phase: "succeeded",
        loadedArtifactSha: "abc123",
        health: "healthy",
      });
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  it("validates optional notification pairs and path-safe correlations without Task state", () => {
    expect(() => validateNotificationTarget(undefined, undefined)).not.toThrow();
    expect(() => validateNotificationTarget("may", "task/1")).not.toThrow();
    expect(() => validateNotificationTarget("may", undefined)).toThrow("requires both");
    expect(() => validateNotificationTarget("bad app", "task/1")).toThrow("Invalid App ID");
    expect(() => validateCorrelation("deploy-20260920.1")).not.toThrow();
    expect(() => validateCorrelation("../escape")).toThrow("Invalid deployment correlation");
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
        verification: expect.stringContaining("read this exact receipt without redeploying"),
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
    expect(deploy).toContain('project="${MAY_AGENT_DEPLOY_OWNER_APP:-}"');
    expect(deploy).not.toContain("MAY_AGENT_DEPLOY_TASK_DB");
    expect(deploy).not.toContain("validate-target");
    expect(deploy).not.toContain("may.db");
    expect(deploy).toContain('deploy-receipt.ts validate-notification "$project" "$task_id" "$correlation"');
    expect(deploy.indexOf("validate-notification")).toBeLessThan(deploy.indexOf('if [ -e "$receipt" ]'));
    expect(deploy.indexOf('if [ -e "$receipt" ]')).toBeLessThan(deploy.indexOf("git rev-parse"));
    expect(deploy).toContain('deploy-receipt.ts read "$receipt"');
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
      writeFileSync(
        join(repo, "scripts", "deploy-receipt.ts"),
        readFileSync(new URL("./deploy-receipt.ts", import.meta.url)),
      );
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
        ["git", "add", "scripts/deploy.sh", "scripts/deploy-receipt.ts"],
        ["git", "-c", "user.name=Fixture", "-c", "user.email=fixture@example.test", "commit", "-qm", "fixture"],
      ]) {
        expect((await run(cmd)).code).toBe(0);
      }

      const bun = join(bin, "bun");
      writeFileSync(
        bun,
        `#!/bin/sh
printf '%s|%s|%s\\n' "\${MAY_TASK_ATTEMPT_CHILD-unset}" "\${KEEP_ME-unset}" "$*" >> "\$COMMAND_LOG"
if [ "\${1-}" = scripts/deploy-receipt.ts ]; then exec ${JSON.stringify(process.execPath)} "$@"; fi
if [ "\${1-}" = test ]; then exit "\${MAY_TEST_TEST_EXIT:-42}"; fi
if [ "\${1-}" = run ] && [ "\${2-}" = bundle ]; then
  mkdir -p bundle/platform-ui packages/terminal/bin packages/sdk container
  printf '#!/bin/sh\\nexit 0\\n' > bundle/may-agent
  printf '#!/bin/sh\\nexit 0\\n' > packages/terminal/bin/may-console.cjs
  printf '#!/bin/sh\\nexit 0\\n' > container/may-agent-supervisor-restart.sh
  printf '{}\\n' > packages/sdk/package.json
  printf 'ui\\n' > bundle/platform-ui/index.html
  chmod +x bundle/may-agent packages/terminal/bin/may-console.cjs container/may-agent-supervisor-restart.sh
  exit 0
fi
exit 90
`,
      );
      chmodSync(bun, 0o755);
      for (const command of ["supervisorctl", "docker"]) {
        const path = join(bin, command);
        writeFileSync(
          path,
          `#!/bin/sh\necho "FIXTURE_${command.toUpperCase()}|$*" >> "$COMMAND_LOG"\nexit "\${MAY_TEST_RESTART_EXIT:-99}"\n`,
        );
        chmodSync(path, 0o755);
      }
      // Confinement is unconditional: whichever production launch branch the
      // host selects, this fixture cannot write the installed restarter or
      // invoke the host's supervisor/docker (including as root with a socket).
      writeFileSync(
        join(bin, "install"),
        `#!/bin/sh
last=""
for arg in "$@"; do last="$arg"; done
case "$last" in
  "$MAY_TEST_INSTALL_ROOT"/*) exec /usr/bin/install "$@" ;;
  /usr/local/bin/may-agent-supervisor-restart)
    echo "CONFINED_INSTALL|$*" >> "$COMMAND_LOG"
    exit 0
    ;;
  *) echo "UNSAFE_INSTALL|$*" >> "$COMMAND_LOG"; exit 86 ;;
esac
`,
      );
      writeFileSync(
        join(bin, "cmp"),
        '#!/bin/sh\ncase "$*" in *"/usr/local/bin/may-agent-supervisor-restart"*) echo "CONFINED_CMP|$*" >> "$COMMAND_LOG"; exit 0;; esac\nexec /usr/bin/cmp "$@"\n',
      );
      chmodSync(join(bin, "install"), 0o755);
      chmodSync(join(bin, "cmp"), 0o755);

      const correlation = "fixture-test-gate-failure";
      const result = await run(["/bin/sh", "scripts/deploy.sh"], {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        COMMAND_LOG: log,
        KEEP_ME: "kept",
        MAY_TASK_ATTEMPT_CHILD: "1",
        MAY_TEST_INSTALL_ROOT: repo,
        MAY_AGENT_DEPLOY_OWNER_APP: "",
        MAY_AGENT_DEPLOY_TASK_ID: "",
        MAY_AGENT_DEPLOY_CORRELATION: correlation,
        MAY_AGENT_DEPLOY_ROOT: repo,
        MAY_AGENT_DEPLOY_RECEIPT_DIR: receiptDir,
      });

      expect(result.code).toBe(42);
      const calls = readFileSync(log, "utf8").trim().split("\n");
      expect(calls[0]).toContain("1|kept|scripts/deploy-receipt.ts validate-notification");
      expect(calls[0]).toContain(correlation);
      expect(calls[1]).toBe(
        "1|kept|test packages/control/src/client.test.ts packages/control/src/control-socket.test.ts src/app/modes/emit-mode.test.ts",
      );
      expect(calls.some((call) => call.includes("run bundle"))).toBe(false);
      expect(calls.some((call) => call.includes("deploy-receipt.ts request"))).toBe(false);
      expect(
        calls.some((call) => call.startsWith("FIXTURE_SUPERVISORCTL|") || call.startsWith("FIXTURE_DOCKER|")),
      ).toBe(false);
      expect(existsSync(join(receiptDir, `${correlation}.json`))).toBe(false);
      expect(existsSync(join(repo, "bundle"))).toBe(false);
      expect(existsSync(join(repo, `.state/deploy-build-${correlation}`))).toBe(false);

      writeFileSync(log, "");
      const standaloneCorrelation = "fixture-standalone-success";
      const standaloneReceipt = join(receiptDir, `${standaloneCorrelation}.json`);
      const standalone = await run(["/bin/sh", "scripts/deploy.sh"], {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        COMMAND_LOG: log,
        KEEP_ME: "kept",
        MAY_TASK_ATTEMPT_CHILD: "1",
        MAY_TEST_TEST_EXIT: "0",
        MAY_TEST_RESTART_EXIT: "0",
        MAY_TEST_INSTALL_ROOT: repo,
        // Override any operator shell metadata: this is deliberately standalone.
        MAY_AGENT_DEPLOY_OWNER_APP: "",
        MAY_AGENT_DEPLOY_TASK_ID: "",
        MAY_AGENT_DEPLOY_CORRELATION: standaloneCorrelation,
        MAY_AGENT_DEPLOY_ROOT: repo,
        MAY_AGENT_DEPLOY_RECEIPT_DIR: receiptDir,
      });
      expect(standalone.code).toBe(0);
      expect(standalone.stdout).toContain(`Deployment receipt requested: ${standaloneReceipt}`);
      const standaloneResult = readDeployReceipt(standaloneReceipt);
      expect(standaloneResult).toMatchObject({ correlation: standaloneCorrelation, phase: "requested" });
      expect(standaloneResult).not.toHaveProperty("project");
      expect(standaloneResult).not.toHaveProperty("taskId");
      const standaloneCalls = readFileSync(log, "utf8");
      expect(standaloneCalls).not.toContain("may.db");
      expect(standaloneCalls).not.toContain("UNSAFE_INSTALL|");
      expect(
        standaloneCalls.includes("FIXTURE_SUPERVISORCTL|") || standaloneCalls.includes("FIXTURE_DOCKER|"),
      ).toBe(true);

      writeFileSync(log, "");
      const retryCorrelation = "fixture-existing-receipt";
      const retryReceipt = join(receiptDir, `${retryCorrelation}.json`);
      requestReceipt(retryReceipt, undefined, undefined, retryCorrelation, "abc123", "deadbeef");
      settleReceipt(retryReceipt, "succeeded", "abc123", "healthy");
      const receiptBefore = readFileSync(retryReceipt, "utf8");
      const stagedArtifact = join(repo, "bundle", "may-agent");
      const stagedResult = join(repo, "bundle", "may-agent.provenance.json");
      mkdirSync(join(repo, "bundle"), { recursive: true });
      writeFileSync(stagedArtifact, "previous artifact\n");
      writeFileSync(stagedResult, '{"result":"previous"}\n');
      const artifactBefore = readFileSync(stagedArtifact, "utf8");
      const resultBefore = readFileSync(stagedResult, "utf8");
      const retryResult = await run(["/bin/sh", "scripts/deploy.sh"], {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        COMMAND_LOG: log,
        KEEP_ME: "kept",
        MAY_TASK_ATTEMPT_CHILD: "1",
        MAY_AGENT_DEPLOY_OWNER_APP: "",
        MAY_AGENT_DEPLOY_TASK_ID: "",
        MAY_AGENT_DEPLOY_CORRELATION: retryCorrelation,
        MAY_AGENT_DEPLOY_ROOT: repo,
        MAY_AGENT_DEPLOY_RECEIPT_DIR: receiptDir,
      });
      expect(retryResult.code).toBe(0);
      expect(readFileSync(retryReceipt, "utf8")).toBe(receiptBefore);
      expect(readFileSync(stagedArtifact, "utf8")).toBe(artifactBefore);
      expect(readFileSync(stagedResult, "utf8")).toBe(resultBefore);
      expect(existsSync(join(repo, `.state/deploy-build-${retryCorrelation}`))).toBe(false);
      const retryCalls = readFileSync(log, "utf8");
      expect(retryCalls).toContain("validate-notification");
      expect(retryCalls).toContain(`read ${retryReceipt}`);
      expect(retryCalls).not.toContain("|test ");
      expect(retryCalls).not.toContain("run bundle");
      expect(retryCalls).not.toContain("FIXTURE_SUPERVISORCTL|");
      expect(retryCalls).not.toContain("FIXTURE_DOCKER|");
    } finally {
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
