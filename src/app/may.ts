import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  createIdentityWriter,
} from "./daemon.js";
import { runEmitMode } from "./modes/emit.js";
import { parseWebPort, runWebOnlyMode } from "./modes/web.js";
import { createModelRegistry } from "./model-registry.js";
import { parseAppArgs } from "./app-args.js";
import { runAppRuntime } from "./app-runtime.js";
import { resolveRuntimeRoots } from "./path-roots.js";

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

// ── Instance identity ───────────────────────────────────────────────────

const INSTANCE = process.env.INSTANCE || "";
const INSTANCE_LABEL = INSTANCE || "default";

const PROCESS_START_TIME = Date.now();

const writeIdentity = createIdentityWriter({ persistDir: PERSIST_DIR, instanceLabel: INSTANCE_LABEL });

let appArgs: ReturnType<typeof parseAppArgs>;
try {
  appArgs = parseAppArgs();
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}

const {
  emitMode: EMIT_MODE,
  interfaceAgent,
  webOnlyMode: WEB_ONLY_MODE,
} = appArgs;

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

const { models, modelBaseUrl, apiKey: LITELLM_API_KEY, anthropicDirect } = createModelRegistry();

await runAppRuntime({
  appArgs,
  models,
  modelBaseUrl,
  litellmApiKey: LITELLM_API_KEY,
  anthropicDirect,
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
