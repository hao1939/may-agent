import { afterEach, describe, expect, it } from "bun:test";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { createServer } from "node:net";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { readDeployReceiptForTask } from "./deploy-receipt.js";

const roots: string[] = [];
const sourceCommit = "a".repeat(40);

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function executable(path: string, body = "#!/bin/sh\nexit 0\n"): void {
  writeFileSync(path, body);
  chmodSync(path, 0o755);
}

async function fixture(
  healthy: boolean,
  options: { failUiSwitch?: boolean; previousSdk?: boolean; socketHealthy?: boolean; failWake?: boolean } = {},
) {
  const root = mkdtempSync(join(tmpdir(), "may-agent-restarter-ui-"));
  roots.push(root);
  const binDir = join(root, "bin");
  const bundleRoot = join(root, "bundle");
  const receiptDir = join(root, ".state", "deploy-receipts");
  const wakePath = join(root, "task-wake.json");
  const uiParent = join(root, "platform");
  const uiTarget = join(uiParent, "ui");
  const sdkRelease = `sdk-${sourceCommit}`;
  const uiRelease = `ui-${sourceCommit}`;
  mkdirSync(binDir, { recursive: true });
  mkdirSync(receiptDir, { recursive: true });
  mkdirSync(join(bundleRoot, sdkRelease), { recursive: true });
  mkdirSync(join(bundleRoot, uiRelease), { recursive: true });
  mkdirSync(uiTarget, { recursive: true });
  writeFileSync(join(uiTarget, "old.txt"), "old-ui");
  writeFileSync(join(bundleRoot, sdkRelease, "package.json"), "{}\n");
  writeFileSync(join(bundleRoot, uiRelease, "index.html"), "new-ui\n");

  executable(
    join(binDir, "supervisorctl"),
    "#!/bin/sh\nif [ \"${1:-}\" = status ]; then\n  printf 'may-agent RUNNING\\nmay-agent-web RUNNING\\nmay-agent-maintenance RUNNING\\n'\nfi\nexit 0\n",
  );
  executable(join(binDir, "curl"), `#!/bin/sh\nexit ${healthy ? 0 : 1}\n`);
  if (options.failUiSwitch) {
    executable(
      join(binDir, "mv"),
      '#!/bin/sh\nlast=""\nfor arg in "$@"; do last="$arg"; done\nif [ "${1:-}" = "-Tf" ] && [ "$last" = "${MAY_TEST_UI_TARGET:-}" ]; then exit 42; fi\nexec /bin/mv "$@"\n',
    );
  }

  const target = join(root, "may-agent");
  const consoleTarget = join(root, "may-console");
  const bundle = join(bundleRoot, "may-agent");
  const consoleBundle = join(bundleRoot, "may-console");
  const hostScript = '#!/bin/sh\nif [ "${1:-}" = --emit ]; then\n  [ "${MAY_TEST_FAIL_WAKE:-}" != 1 ] || exit 1\n  printf "%s\\n" "$3" > "$MAY_TEST_WAKE_PATH"\nfi\nexit 0\n';
  executable(target, hostScript);
  executable(consoleTarget);
  executable(bundle, `${hostScript}# new-runtime\n`);
  executable(consoleBundle, "#!/bin/sh\nexit 0\n# new-console\n");

  const sdkLink = join(bundleRoot, "sdk-current");
  if (options.previousSdk !== false) {
    mkdirSync(join(bundleRoot, "sdk-old"));
    symlinkSync("sdk-old", sdkLink);
  }
  const receipt = join(receiptDir, "deploy-test.json");
  writeFileSync(
    receipt,
    `${JSON.stringify({
      version: 1,
      correlation: "deploy-test",
      project: "may-agent",
      taskId: "app-request/test",
      artifactSha: createHash("sha256").update(readFileSync(bundle)).digest("hex"),
      sourceCommit,
      phase: "requested",
      requestedAt: new Date().toISOString(),
    })}\n`,
  );
  const deployMarker = join(bundleRoot, "deploy-requested");
  const sdkMarker = join(bundleRoot, "sdk-requested");
  const uiMarker = join(bundleRoot, "ui-requested");
  writeFileSync(deployMarker, `${receipt}\n`);
  writeFileSync(sdkMarker, `${sdkRelease}\n`);
  writeFileSync(uiMarker, `${uiRelease}\n`);

  const healthSocket = join(root, "health.sock");
  const server = createServer((socket) => {
    socket.once("data", () =>
      socket.end(
        JSON.stringify({
          type: options.socketHealthy === false ? "error" : "ok",
          command: "apps.list",
          apps: [],
        }) + "\n",
      ),
    );
  });
  await new Promise<void>((resolveReady, reject) => {
    server.once("error", reject);
    server.listen(healthSocket, resolveReady);
  });
  let result: { exitCode: number; stderr: string };
  try {
    const child = Bun.spawn({
      cmd: ["sh", "container/may-agent-supervisor-restart.sh"],
      cwd: resolve(import.meta.dir, ".."),
      env: {
        ...process.env,
        PATH: `${binDir}:${process.env.PATH}`,
        MAY_AGENT_BUNDLE_PATH: bundle,
        MAY_AGENT_BIN_PATH: target,
        MAY_CONSOLE_BUNDLE_PATH: consoleBundle,
        MAY_CONSOLE_BIN_PATH: consoleTarget,
        MAY_AGENT_DEPLOY_MARKER: deployMarker,
        MAY_AGENT_SDK_DEPLOY_MARKER: sdkMarker,
        MAY_AGENT_DEPLOY_SDK_ROOT: bundleRoot,
        MAY_AGENT_SDK_LINK: sdkLink,
        MAY_AGENT_UI_DEPLOY_MARKER: uiMarker,
        MAY_AGENT_DEPLOY_UI_ROOT: bundleRoot,
        MAY_AGENT_UI_PATH: uiTarget,
        MAY_AGENT_DEPLOY_RECEIPT_TOOL: resolve(import.meta.dir, "deploy-receipt.ts"),
        MAY_AGENT_DEPLOY_RECEIPT_DIR: receiptDir,
        MAY_AGENT_RUNTIME_USER: String(process.getuid?.() ?? 0),
        MAY_AGENT_RUNTIME_GROUP: String(process.getgid?.() ?? 0),
        MAY_AGENT_RESTART_DELAY: "0",
        MAY_AGENT_HEALTH_ATTEMPTS: "1",
        MAY_AGENT_HEALTH_DELAY: "0",
        MAY_AGENT_HEALTH_SOCKET: healthSocket,
        MAY_TEST_UI_TARGET: uiTarget,
        MAY_TEST_WAKE_PATH: wakePath,
        MAY_TEST_FAIL_WAKE: options.failWake ? "1" : "0",
      },
      stdout: "pipe",
      stderr: "pipe",
      timeout: 10_000,
    });
    const [exitCode, stderr] = await Promise.all([
      child.exited,
      new Response(child.stderr).text(),
      new Response(child.stdout).text(),
    ]);
    result = { exitCode, stderr };
  } finally {
    await new Promise<void>((resolveClosed) => server.close(() => resolveClosed()));
  }

  return {
    root,
    result,
    receipt,
    receiptDir,
    wakePath,
    uiTarget,
    uiRelease,
    bundleRoot,
    sdkLink,
    target,
    deployMarker,
    sdkMarker,
    uiMarker,
  };
}

describe("supervisor UI release", () => {
  it("activates the versioned UI with the healthy binary and SDK", async () => {
    const f = await fixture(true);
    expect(f.result.stderr).toBe("");
    expect(f.result.exitCode).toBe(0);
    expect(lstatSync(f.uiTarget).isSymbolicLink()).toBeTrue();
    expect(readlinkSync(f.uiTarget)).toBe(join(f.bundleRoot, f.uiRelease));
    expect(readFileSync(join(f.uiTarget, "index.html"), "utf8")).toBe("new-ui\n");
    expect(readlinkSync(f.sdkLink)).toBe(`sdk-${sourceCommit}`);
    const receipt = JSON.parse(readFileSync(f.receipt, "utf8"));
    expect(receipt).toMatchObject({ phase: "succeeded", health: "healthy", loadedArtifactSha: receipt.artifactSha });
    expect(JSON.parse(readFileSync(f.wakePath, "utf8"))).toEqual({
      project: "may-agent", taskId: "app-request/test", task_id: "app-request/test",
      reason: "restart-aware-deploy-receipt", deploymentCorrelation: "deploy-test", deploymentPhase: "succeeded",
      deploymentReceipt: receipt,
    });
  });

  it("keeps exact settled evidence readable when the best-effort Task wake is lost", async () => {
    const f = await fixture(true, { failWake: true });
    expect(f.result.exitCode).toBe(0);
    expect(existsSync(f.wakePath)).toBe(false);
    expect(readDeployReceiptForTask(f.receiptDir, "may-agent", "app-request/test"))
      .toEqual(JSON.parse(readFileSync(f.receipt, "utf8")));
    expect(readDeployReceiptForTask(f.receiptDir, "may-agent", "app-request/test"))
      .toMatchObject({ phase: "succeeded", health: "healthy", duplicateDeploy: false });
    expect(existsSync(f.deployMarker)).toBe(false);
  });

  it("restores the prior UI and SDK when readiness fails", async () => {
    const f = await fixture(false);
    expect(f.result.exitCode).not.toBe(0);
    expect(lstatSync(f.uiTarget).isDirectory()).toBeTrue();
    expect(readFileSync(join(f.uiTarget, "old.txt"), "utf8")).toBe("old-ui");
    expect(readlinkSync(f.sdkLink)).toBe("sdk-old");
    expect(JSON.parse(readFileSync(f.receipt, "utf8"))).toMatchObject({ phase: "rolled_back" });
  });

  it("restores all prior artifacts when activation fails partway through", async () => {
    const f = await fixture(true, { failUiSwitch: true });
    expect(f.result.exitCode).toBe(42);
    expect(lstatSync(f.uiTarget).isDirectory()).toBeTrue();
    expect(readFileSync(join(f.uiTarget, "old.txt"), "utf8")).toBe("old-ui");
    expect(readlinkSync(f.sdkLink)).toBe("sdk-old");
    expect(readFileSync(f.target, "utf8")).not.toContain("new-runtime");
    expect(JSON.parse(readFileSync(f.receipt, "utf8"))).toMatchObject({ phase: "failed" });
    expect(existsSync(f.deployMarker)).toBeFalse();
    expect(existsSync(f.sdkMarker)).toBeFalse();
    expect(existsSync(f.uiMarker)).toBeFalse();
  });

  it("restores an absent SDK link when the first activation fails readiness", async () => {
    const f = await fixture(false, { previousSdk: false });
    expect(f.result.exitCode).not.toBe(0);
    expect(existsSync(f.sdkLink)).toBeFalse();
    expect(lstatSync(f.uiTarget).isDirectory()).toBeTrue();
    expect(readFileSync(join(f.uiTarget, "old.txt"), "utf8")).toBe("old-ui");
  });

  it("rolls back when HTTP is healthy but the control socket rejects the probe", async () => {
    const f = await fixture(true, { socketHealthy: false });
    expect(f.result.exitCode).not.toBe(0);
    expect(JSON.parse(readFileSync(f.receipt, "utf8"))).toMatchObject({ phase: "rolled_back" });
    expect(readlinkSync(f.sdkLink)).toBe("sdk-old");
  });
});
