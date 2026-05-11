import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import {
  createIdentityWriter,
} from "./daemon.js";
import { resolveProjectRoot } from "./bundle-mode.js";
import { runEmitMode } from "./modes/emit.js";
import { parseWebPort, runWebOnlyMode } from "./modes/web.js";
import { createModelRegistry } from "./model-registry.js";
import { parseAppArgs } from "./app-args.js";
import { runAppRuntime } from "./app-runtime.js";

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

const PROJECT_ROOT = resolveProjectRoot(import.meta.url);
const AGENTS_ROOT = resolve(process.env.AGENTS_ROOT || resolve(PROJECT_ROOT, "agents"));
const PERSIST_DIR = resolve(process.env.STATE_DIR || resolve(PROJECT_ROOT, ".state"));

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
    instanceLabel: INSTANCE_LABEL,
    writeIdentity,
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
  persistDir: PERSIST_DIR,
  instance: INSTANCE,
  instanceLabel: INSTANCE_LABEL,
  processStartTime: PROCESS_START_TIME,
  writeIdentity,
});
