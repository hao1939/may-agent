// Register the `@may-agent/sdk` bare-specifier resolver as the very first
// thing the dev-mode process does. The same plugin is registered in
// binary-entry.ts for compiled builds. Putting it before any other import
// guarantees dynamically-loaded handler and workflow files — which use
// `import { ... } from "@may-agent/sdk"` — resolve identically in dev and
// production binary.
import "./sdk-resolver-plugin.js";

import { execSync } from "node:child_process";
import { createIdentityWriter } from "./daemon.js";
import { runEmitMode } from "./modes/emit.js";
import { parseWebPort, runWebOnlyMode } from "./modes/web.js";
import { createModelRegistry } from "./model-registry.js";
import { parseAppArgs } from "./app-args.js";
import { runAppRuntime } from "./app-runtime.js";
import { resolveRuntimeRoots } from "./path-roots.js";
import { runMaintenanceMode } from "./modes/maintenance.js";
import { runRequestedControlExitMode } from "./runtime-exit-modes.js";
import { parseTaskAttemptProcessRequest, runTaskAttemptWorker, runTaskRecoveryWorker } from "./task-attempt-process.js";
import { runTaskAdmissionWorker } from "./task-admission-process.js";

declare const __MAY_AGENT_BUILD_COMMIT__: string | undefined;
declare const __MAY_AGENT_PACKAGE_NAME__: string | undefined;
declare const __MAY_AGENT_PACKAGE_VERSION__: string | undefined;

// Compiled artifacts receive these values from build-runtime-binary.ts. Keep
// literal fallbacks so the source entrypoint and even an ad-hoc standalone
// compile remain self-contained; may-help.test.ts checks them against the
// package manifest.
const PACKAGE_NAME = typeof __MAY_AGENT_PACKAGE_NAME__ === "string" ? __MAY_AGENT_PACKAGE_NAME__ : "may-agent";
const PACKAGE_VERSION = typeof __MAY_AGENT_PACKAGE_VERSION__ === "string" ? __MAY_AGENT_PACKAGE_VERSION__ : "0.1.0";

// Keep informational CLI modes and their syntax validation ahead of runtime-root
// resolution, identity creation, and app startup. Runtime startup performs stale
// handler/workflow recovery and may mutate persisted state.
const operatorArgs = process.argv
  .slice(1)
  .filter(
    (arg) =>
      arg !== process.argv[0] &&
      arg !== "binary-entry.ts" &&
      !arg.endsWith("/binary-entry.ts") &&
      !arg.endsWith("/may.ts"),
  );
if (operatorArgs[0] === "status") {
  console.error('Unsupported positional command "status". Use "may-agent --status".');
  process.exit(2);
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`Usage: may-agent [options]

Options:
  -h, --help                 Show this help and exit
  -v, --version              Show version and git SHA
  --agent <name>             Select the interface agent
  --task <text>              Run an initial task
  --task-file <path>         Read the initial task from a file
  --oneshot                  Run one task and exit
  --console, --chat          Enable the console interface
  --telegram                 Enable the Telegram interface
  --cron                     Enable scheduled jobs
  --socket                   Enable the daemon socket
  --web                      Enable the web interface (alone: web-only mode)
  --status                   Print runtime status
  --send                     Send a message
  --emit <event-type>        Emit an event through the running daemon
  --maintenance-once         Run one maintenance pass and exit`);
  process.exit(0);
}

// ── --version / -v: print version + git SHA and exit immediately ────────
if (process.argv.includes("--version") || process.argv.includes("-v")) {
  let gitSha =
    typeof __MAY_AGENT_BUILD_COMMIT__ === "string" && /^[0-9a-f]{40}$/.test(__MAY_AGENT_BUILD_COMMIT__)
      ? __MAY_AGENT_BUILD_COMMIT__.slice(0, 8)
      : "unknown";
  if (gitSha === "unknown") {
    try {
      gitSha = execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim();
    } catch {
      // Development outside a Git checkout has no source identity.
    }
  }
  console.log(`${PACKAGE_NAME} v${PACKAGE_VERSION} (${gitSha})`);
  process.exit(0);
}

const ROOTS = resolveRuntimeRoots(import.meta.url);
const PROJECT_ROOT = ROOTS.projectRoot;
const AGENTS_ROOT = ROOTS.agentsRoot;
const PERSIST_DIR = ROOTS.persistDir;

if (process.argv.includes("--maintenance") || process.argv.includes("--maintenance-once")) {
  await runMaintenanceMode({ persistDir: PERSIST_DIR });
  process.exit(0);
}

// ── Instance identity ───────────────────────────────────────────────────

const INSTANCE = process.env.INSTANCE || "";
const INSTANCE_LABEL = INSTANCE || "default";

let appArgs: ReturnType<typeof parseAppArgs>;
try {
  appArgs = parseAppArgs();
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}

const { emitMode: EMIT_MODE, interfaceAgent, webOnlyMode: WEB_ONLY_MODE } = appArgs;

const controlExitCode = await runRequestedControlExitMode({
  appArgs,
  agentsRoot: AGENTS_ROOT,
  persistDir: PERSIST_DIR,
});
if (controlExitCode !== null) process.exit(controlExitCode);

if (EMIT_MODE) {
  // ── Operator emit mode: send one event to the running daemon and exit ─
  // Keep this before agent/model startup so operators have a small, reliable
  // control command that does not boot another runtime-shaped process.
  try {
    await runEmitMode({
      mode: EMIT_MODE,
      persistDir: PERSIST_DIR,
      instanceLabel: INSTANCE_LABEL,
      interfaceAgent,
      daemonInstance: process.env.DAEMON_INSTANCE,
      daemonAgent: process.env.DAEMON_AGENT,
    });
    process.exit(0);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

if (WEB_ONLY_MODE) {
  await runWebOnlyMode({
    stateDir: PERSIST_DIR,
    port: parseWebPort(process.env.WEB_PORT),
  });
}

// ── Models ──────────────────────────────────────────────────────────────

const models = createModelRegistry();

if (appArgs.taskWorkerRequest || appArgs.taskRecoveryWorker || appArgs.taskAdmissionWorker) {
  try {
    const workerInput = {
      roots: {
        projectRoot: PROJECT_ROOT,
        sharedRoot: ROOTS.sharedRoot,
        projectsRoot: ROOTS.projectsRoot,
        persistDir: PERSIST_DIR,
      },
      models,
    };
    if (appArgs.taskAdmissionWorker) {
      await runTaskAdmissionWorker({
        projectRoot: PROJECT_ROOT,
        projectsRoot: ROOTS.projectsRoot,
        persistDir: PERSIST_DIR,
      });
    } else if (appArgs.taskWorkerRequest) {
      await runTaskAttemptWorker({
        ...workerInput,
        request: parseTaskAttemptProcessRequest(appArgs.taskWorkerRequest),
      });
    } else {
      await runTaskRecoveryWorker(workerInput);
    }
    process.exit(0);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

const PROCESS_START_TIME = Date.now();
const writeIdentity = createIdentityWriter({ persistDir: PERSIST_DIR, instanceLabel: INSTANCE_LABEL });

await runAppRuntime({
  appArgs,
  models,
  projectRoot: PROJECT_ROOT,
  agentsRoot: AGENTS_ROOT,
  sharedRoot: ROOTS.sharedRoot,
  projectsRoot: ROOTS.projectsRoot,
  persistDir: PERSIST_DIR,
  instance: INSTANCE,
  instanceLabel: INSTANCE_LABEL,
  processStartTime: PROCESS_START_TIME,
  writeIdentity,
});
