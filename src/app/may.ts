// Register the `@may-agent/sdk` bare-specifier resolver as the very first
// thing the dev-mode process does. The same plugin is registered in
// binary-entry.ts for compiled builds. Putting it before any other import
// guarantees dynamically-loaded handler and workflow files — which use
// `import { ... } from "@may-agent/sdk"` — resolve identically in dev and
// production binary.
import "./sdk-resolver-plugin.js";

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createIdentityWriter } from "./daemon.js";
import { runEmitMode } from "./modes/emit.js";
import { parseWebPort, runWebOnlyMode } from "./modes/web.js";
import { createModelRegistry } from "./model-registry.js";
import { parseAppArgs } from "./app-args.js";
import { runAppRuntime } from "./app-runtime.js";
import { resolveRuntimeRoots } from "./path-roots.js";
import { runMaintenanceMode } from "./modes/maintenance.js";
import { runRequestedControlExitMode } from "./runtime-exit-modes.js";

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
  const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf-8"));
  let gitSha = "unknown";
  try {
    gitSha = execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim();
  } catch {
    // Not inside a git repo or git not available — fall back to "unknown"
  }
  console.log(`${pkg.name} v${pkg.version} (${gitSha})`);
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

const PROCESS_START_TIME = Date.now();
const writeIdentity = createIdentityWriter({ persistDir: PERSIST_DIR, instanceLabel: INSTANCE_LABEL });

// ── Models ──────────────────────────────────────────────────────────────

const models = createModelRegistry();

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
