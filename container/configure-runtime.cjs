#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const home = process.env.HOME || "/root";
const projectRoot = process.env.PROJECT_ROOT || "/app";
const stateDir = process.env.STATE_DIR || path.join(projectRoot, ".state");
const baseUrlRaw = (process.env.MODEL_BASE_URL || "http://host.docker.internal:4000").replace(/\/+$/, "");

const openaiBaseUrl = baseUrlRaw.endsWith("/v1") ? baseUrlRaw : `${baseUrlRaw}/v1`;
const anthropicBaseUrl = baseUrlRaw.endsWith("/v1") ? baseUrlRaw.slice(0, -3) : baseUrlRaw;
const googleRaw = (process.env.GOOGLE_GEMINI_BASE_URL || anthropicBaseUrl).replace(/\/+$/, "");
const googleBaseUrl = googleRaw.endsWith("/v1beta")
  ? googleRaw
  : googleRaw.endsWith("/v1")
    ? `${googleRaw.slice(0, -3)}/v1beta`
    : `${googleRaw}/v1beta`;

const openaiModel = process.env.PI_OPENAI_MODEL || process.env.CODEX_MODEL || process.env.OPENAI_DEFAULT_MODEL || "gpt-6.1-sol";
const codexModel = process.env.CODEX_MODEL || process.env.OPENAI_DEFAULT_MODEL || "gpt-6.1-sol";
const codexReasoning = process.env.CODEX_REASONING_EFFORT || "high";
const geminiProModel = process.env.GEMINI_PRO_MODEL || "gemini-4-argon";
const geminiFastModel = process.env.GEMINI_FAST_MODEL || "gemini-3.8-flash";
const geminiModel = process.env.GEMINI_MODEL || geminiProModel;
const claudeModel = process.env.PI_ANTHROPIC_MODEL || process.env.CLAUDE_MODEL || "claude-opus-5";

const codexHome = process.env.CODEX_HOME || process.env.MAY_CODEX_HOME || path.join(home, ".codex");
const piDir = process.env.PI_CODING_AGENT_DIR || path.join(home, ".pi", "agent");
const geminiHome = path.join(process.env.GEMINI_CLI_HOME || home, ".gemini");
const claudeHome = process.env.CLAUDE_CONFIG_DIR || path.join(home, ".claude");
const herdrConfigDir = path.join(process.env.XDG_CONFIG_HOME || path.join(home, ".config"), "herdr");

const trustedRoots = [...new Set([projectRoot, `${projectRoot}/projects`, `${projectRoot}/worktrees`, "/app", "/tmp"].filter(Boolean))];
const uniqueIds = (ids) => [...new Set(ids.filter(Boolean))];

const { execFileSync } = require("node:child_process");

function readJson(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeJson(filePath, value, mode = 0o600) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { mode });
  fs.chmodSync(filePath, mode);
}

function ensureSymlink(linkPath, targetPath) {
  if (linkPath === targetPath) return;
  try {
    const st = fs.lstatSync(linkPath);
    if (st.isSymbolicLink()) {
      if (fs.readlinkSync(linkPath) !== targetPath) {
        fs.unlinkSync(linkPath);
        fs.symlinkSync(targetPath, linkPath);
      }
      return;
    }
    return;
  } catch {
    fs.mkdirSync(path.dirname(linkPath), { recursive: true });
    fs.symlinkSync(targetPath, linkPath);
  }
}

function copyMissingTree(srcDir, dstDir, strictConflict = false) {
  if (!srcDir || !dstDir || srcDir === dstDir) return;
  let st;
  try {
    st = fs.lstatSync(srcDir);
  } catch {
    return;
  }
  if (!st.isDirectory() || st.isSymbolicLink()) return;
  fs.mkdirSync(dstDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const srcPath = path.join(srcDir, entry.name);
    const dstPath = path.join(dstDir, entry.name);
    if (entry.isDirectory()) {
      copyMissingTree(srcPath, dstPath, strictConflict);
    } else if (entry.isFile()) {
      if (!fs.existsSync(dstPath)) {
        const mode = fs.statSync(srcPath).mode & 0o777;
        fs.copyFileSync(srcPath, dstPath);
        fs.chmodSync(dstPath, mode);
      } else if (strictConflict) {
        if (!fs.readFileSync(srcPath).equals(fs.readFileSync(dstPath))) {
          console.error(`Conflicting SSH file in ${srcPath} and ${dstPath}; refusing to overwrite key material.`);
          process.exit(1);
        }
      }
    }
  }
}

function copyFileIfMissing(srcFile, dstFile) {
  try {
    const st = fs.lstatSync(srcFile);
    if (st.isFile() && !st.isSymbolicLink() && !fs.existsSync(dstFile)) {
      fs.mkdirSync(path.dirname(dstFile), { recursive: true });
      fs.copyFileSync(srcFile, dstFile);
    }
  } catch {}
}

// 1. Durable state directories & idempotent legacy state migration (/app/.state)
if (process.env.MAY_SKIP_STATE_LINKS !== "1") {
  const cliState = path.join(stateDir, "cli-state");
  for (const rel of [
    "ssh",
    "cli-state/herdr/sessions",
    "cli-state/herdr/state",
    "cli-state/codex/sessions",
    "cli-state/codex/memories",
    "cli-state/pi/sessions",
    "cli-state/gemini/history",
    "cli-state/gemini/tmp",
    "cli-state/claude/projects",
  ]) {
    fs.mkdirSync(path.join(stateDir, rel), { recursive: true });
  }
  fs.chmodSync(path.join(stateDir, "ssh"), 0o700);

  // Migrate legacy /app/.state/* paths from older images where HOME=/app/.state
  const legacySshDir = path.join(stateDir, ".ssh");
  try {
    const legacySshStat = fs.lstatSync(legacySshDir);
    if (legacySshStat.isDirectory() && !legacySshStat.isSymbolicLink()) {
      copyMissingTree(legacySshDir, path.join(stateDir, "ssh"), true);
      fs.rmSync(legacySshDir, { recursive: true, force: true });
      ensureSymlink(legacySshDir, path.join(stateDir, "ssh"));
    }
  } catch {}
  copyMissingTree(path.join(stateDir, "herdr", "config", "herdr", "sessions"), path.join(cliState, "herdr", "sessions"));
  copyMissingTree(path.join(stateDir, "herdr", "state"), path.join(cliState, "herdr", "state"));
  copyMissingTree(path.join(stateDir, ".codex", "sessions"), path.join(cliState, "codex", "sessions"));
  copyMissingTree(path.join(stateDir, ".codex", "memories"), path.join(cliState, "codex", "memories"));
  for (const f of ["history.jsonl", "session_index.jsonl"]) {
    copyFileIfMissing(path.join(stateDir, ".codex", f), path.join(cliState, "codex", f));
  }
  copyMissingTree(path.join(stateDir, ".pi", "agent", "sessions"), path.join(cliState, "pi", "sessions"));
  copyMissingTree(path.join(stateDir, ".gemini", "history"), path.join(cliState, "gemini", "history"));
  copyMissingTree(path.join(stateDir, ".gemini", "tmp"), path.join(cliState, "gemini", "tmp"));
  copyFileIfMissing(path.join(stateDir, ".gemini", "projects.json"), path.join(cliState, "gemini", "projects.json"));
  copyMissingTree(path.join(stateDir, ".claude", "projects"), path.join(cliState, "claude", "projects"));

  // Preserve any existing real ~/.ssh directory before linking ~/.ssh -> STATE_DIR/ssh
  const sshPersistDir = path.join(stateDir, "ssh");
  const homeSsh = path.join(home, ".ssh");
  if (home !== stateDir && homeSsh !== sshPersistDir) {
    try {
      const st = fs.lstatSync(homeSsh);
      if (st.isDirectory() && !st.isSymbolicLink()) {
        copyMissingTree(homeSsh, sshPersistDir, true);
        fs.rmSync(homeSsh, { recursive: true, force: true });
      }
    } catch {}
    ensureSymlink(homeSsh, sshPersistDir);
  }
  const sshConfigPath = path.join(sshPersistDir, "config");
  const sshConfig = fs.existsSync(sshConfigPath) ? fs.readFileSync(sshConfigPath, "utf8") : "";
  if (!sshConfig.includes("StrictHostKeyChecking accept-new")) {
    fs.appendFileSync(sshConfigPath, "Host *\n  StrictHostKeyChecking accept-new\n", { mode: 0o600 });
  }
  // OpenSSH rejects a user config owned by the former runtime UID, even when
  // root can read it. Preserve key bytes and normalize only this trust boundary.
  fs.chmodSync(sshConfigPath, 0o600);
  if (process.getuid?.() === 0) {
    fs.chownSync(sshPersistDir, 0, 0);
    fs.chownSync(sshConfigPath, 0, 0);
  }

  // Symlink durable Herdr & CLI histories/sessions into HOME
  fs.mkdirSync(herdrConfigDir, { recursive: true });
  if (herdrConfigDir !== path.join(cliState, "herdr")) {
    const herdrSessionsLink = path.join(herdrConfigDir, "sessions");
    try {
      const st = fs.lstatSync(herdrSessionsLink);
      if (st.isDirectory() && !st.isSymbolicLink()) {
        copyMissingTree(herdrSessionsLink, path.join(cliState, "herdr", "sessions"));
        fs.rmSync(herdrSessionsLink, { recursive: true, force: true });
      }
    } catch {}
    // Clean any stale .sock files left behind by an ungraceful kill (SIGKILL)
    const walkSockets = (dir) => {
      if (!fs.existsSync(dir)) return;
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walkSockets(p);
        else if (e.isSocket() || e.name.endsWith(".sock")) fs.rmSync(p, { force: true });
      }
    };
    walkSockets(path.join(cliState, "herdr", "sessions"));
    ensureSymlink(herdrSessionsLink, path.join(cliState, "herdr", "sessions"));
  }
  fs.mkdirSync(codexHome, { recursive: true });
  if (codexHome !== path.join(cliState, "codex")) {
    ensureSymlink(path.join(codexHome, "sessions"), path.join(cliState, "codex", "sessions"));
    ensureSymlink(path.join(codexHome, "memories"), path.join(cliState, "codex", "memories"));
    for (const f of ["history.jsonl", "session_index.jsonl"]) {
      const target = path.join(cliState, "codex", f);
      if (!fs.existsSync(target)) fs.writeFileSync(target, "");
      ensureSymlink(path.join(codexHome, f), target);
    }
    const codexDbDir = path.join(cliState, "codex", "db");
    fs.mkdirSync(codexDbDir, { recursive: true });
    for (const f of ["state_5.sqlite", "thread_history_1.sqlite", "memories_1.sqlite"]) {
      copyFileIfMissing(path.join(stateDir, ".codex", f), path.join(codexDbDir, f));
      const link = path.join(codexHome, f);
      const target = path.join(codexDbDir, f);
      try {
        const st = fs.lstatSync(link);
        if (st.isFile() && !st.isSymbolicLink()) {
          if (!fs.existsSync(target) || fs.statSync(target).size === 0) fs.copyFileSync(link, target);
          fs.unlinkSync(link);
        }
      } catch {}
      for (const suffix of ["", "-wal", "-shm"]) {
        if (suffix === "" && !fs.existsSync(target)) continue;
        if (suffix === "" || fs.existsSync(`${target}${suffix}`)) {
          ensureSymlink(`${link}${suffix}`, `${target}${suffix}`);
        }
      }
    }
  }
  fs.mkdirSync(piDir, { recursive: true });
  if (piDir !== path.join(cliState, "pi")) {
    ensureSymlink(path.join(piDir, "sessions"), path.join(cliState, "pi", "sessions"));
  }
  fs.mkdirSync(geminiHome, { recursive: true });
  if (geminiHome !== path.join(cliState, "gemini")) {
    ensureSymlink(path.join(geminiHome, "history"), path.join(cliState, "gemini", "history"));
    ensureSymlink(path.join(geminiHome, "tmp"), path.join(cliState, "gemini", "tmp"));
    const geminiProjects = path.join(cliState, "gemini", "projects.json");
    if (!fs.existsSync(geminiProjects)) fs.writeFileSync(geminiProjects, '{"projects":{}}\n');
    ensureSymlink(path.join(geminiHome, "projects.json"), geminiProjects);
  }
  fs.mkdirSync(claudeHome, { recursive: true });
  if (claudeHome !== path.join(cliState, "claude")) {
    ensureSymlink(path.join(claudeHome, "projects"), path.join(cliState, "claude", "projects"));
  }
}

// 2. Herdr config (repaired on every startup)
fs.mkdirSync(herdrConfigDir, { recursive: true });
fs.writeFileSync(
  path.join(herdrConfigDir, "config.toml"),
  ["onboarding = false", "resume_agents_on_restore = true", "", "[ui.sound]", "enabled = false", ""].join("\n"),
  { mode: 0o600 }
);
if (process.env.XDG_RUNTIME_DIR) {
  fs.mkdirSync(process.env.XDG_RUNTIME_DIR, { recursive: true, mode: 0o700 });
}

// 3. Codex native config (~/.codex/config.toml + version.json)
fs.mkdirSync(codexHome, { recursive: true });
fs.rmSync(path.join(codexHome, "app-server-control"), { recursive: true, force: true });
let preservedHookState = "";
const codexConfigPath = path.join(codexHome, "config.toml");
if (fs.existsSync(codexConfigPath)) {
  const lines = fs.readFileSync(codexConfigPath, "utf8").split(/\r?\n/);
  let inHookState = false;
  const kept = [];
  for (const line of lines) {
    if (/^\[hooks\.state(\]|\.)/.test(line)) inHookState = true;
    else if (/^\[/.test(line)) inHookState = false;
    if (inHookState) kept.push(line);
  }
  preservedHookState = kept.join("\n").trim();
}
const bakedHookStatePath = "/opt/may-agent-cli/codex-hook-state.toml";
if (!preservedHookState && fs.existsSync(bakedHookStatePath)) {
  preservedHookState = fs.readFileSync(bakedHookStatePath, "utf8").trim();
}

const codexTrustBlocks = trustedRoots
  .map((root) => `[projects.${JSON.stringify(root)}]\ntrust_level = "trusted"`)
  .join("\n\n");

const codexToml = [
  'model_provider = "model_endpoint"',
  `model = ${JSON.stringify(codexModel)}`,
  `model_reasoning_effort = ${JSON.stringify(codexReasoning)}`,
  'personality = "pragmatic"',
  "check_for_update_on_startup = false",
  'approval_policy = "never"',
  'sandbox_mode = "danger-full-access"',
  "",
  "[features]",
  "hooks = true",
  "",
  "[notice]",
  "hide_full_access_warning = true",
  "hide_world_writable_warning = true",
  "hide_rate_limit_model_nudge = true",
  "",
  "[tui]",
  "screen_reader_detection_done = true",
  "",
  "[model_providers.model_endpoint]",
  'name = "Configured model endpoint"',
  `base_url = ${JSON.stringify(openaiBaseUrl)}`,
  'env_key = "MODEL_API_KEY"',
  'wire_api = "responses"',
  "",
  codexTrustBlocks,
  preservedHookState ? `\n${preservedHookState}` : "",
  "",
].join("\n");
fs.writeFileSync(codexConfigPath, codexToml, { mode: 0o600 });

let codexVersion = "0.0.0";
try {
  codexVersion = require("/opt/may-agent-cli/package.json").dependencies["@openai/codex"] || "0.0.0";
} catch {}
const versionState = readJson(path.join(codexHome, "version.json"));
versionState.latest_version = versionState.latest_version || codexVersion;
versionState.dismissed_version = versionState.dismissed_version || versionState.latest_version;
versionState.last_checked_at = versionState.last_checked_at || new Date(0).toISOString();
writeJson(path.join(codexHome, "version.json"), versionState);

// 4. Pi native config (~/.pi/agent/models.json + settings.json)
fs.mkdirSync(piDir, { recursive: true });
const piModels = {
  providers: {
    "may-openai": {
      baseUrl: openaiBaseUrl,
      api: "openai-responses",
      apiKey: "$MODEL_API_KEY",
      models: uniqueIds([openaiModel, "gpt-6.1-sol", "gpt-6-astra", "gpt-5.6-sol", "gpt-5.5", "gpt-5.4", "gpt-5.3-codex", "gpt-5.4-mini"]).map(
        (id) => ({ id, name: id, reasoning: true, input: ["text", "image"], contextWindow: 400000, maxTokens: 128000 })
      ),
    },
    "may-google": {
      baseUrl: googleBaseUrl,
      api: "google-generative-ai",
      apiKey: "$MODEL_API_KEY",
      models: uniqueIds([geminiProModel, geminiFastModel, "gemini-4-argon", "gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.1-pro-preview"]).map(
        (id) => ({ id, name: id, reasoning: true, input: ["text", "image"], contextWindow: 1000000, maxTokens: 65536 })
      ),
    },
    "may-anthropic": {
      baseUrl: anthropicBaseUrl,
      api: "anthropic-messages",
      apiKey: "$MODEL_API_KEY",
      models: uniqueIds([claudeModel, "claude-opus-5", "claude-sonnet-5", "claude-opus-4-8"]).map(
        (id) => ({
          id,
          name: id,
          reasoning: true,
          input: ["text", "image"],
          contextWindow: 200000,
          maxTokens: 128000,
          compat: { forceAdaptiveThinking: true },
        })
      ),
    },
  },
};
const localPiModelsPath = path.join(stateDir, "cli-config", "pi-models.local.json");
if (fs.existsSync(localPiModelsPath)) {
  const extra = readJson(localPiModelsPath);
  if (extra.providers && typeof extra.providers === "object") {
    piModels.providers = { ...extra.providers, ...piModels.providers };
  }
}
writeJson(path.join(piDir, "models.json"), piModels);

const piAuthPath = path.join(piDir, "auth.json");
const piAuth = readJson(piAuthPath);
for (const provider of ["may-openai", "may-google", "may-anthropic"]) {
  piAuth[provider] = { type: "api_key", key: "!printf '%s' \"${MODEL_API_KEY:-not-needed}\"" };
}
writeJson(piAuthPath, piAuth);

const piSettings = readJson(path.join(piDir, "settings.json"));
piSettings.defaultProvider = "may-openai";
piSettings.defaultModel = openaiModel;
piSettings.defaultThinkingLevel ??= "high";
writeJson(path.join(piDir, "settings.json"), piSettings);

// 5. Gemini native config (~/.gemini/settings.json + policies/full-access.toml + trustedFolders.json)
const geminiPoliciesDir = path.join(geminiHome, "policies");
fs.mkdirSync(geminiPoliciesDir, { recursive: true, mode: 0o700 });
const geminiSettings = readJson(path.join(geminiHome, "settings.json"));
geminiSettings.general = {
  ...geminiSettings.general,
  defaultApprovalMode: "auto_edit",
  maxAttempts: geminiSettings.general?.maxAttempts ?? 3,
  sessionRetention: {
    enabled: true,
    maxAge: "30d",
    warningAcknowledged: true,
    ...geminiSettings.general?.sessionRetention,
  },
};
geminiSettings.security = {
  ...geminiSettings.security,
  folderTrust: { ...geminiSettings.security?.folderTrust, enabled: false },
  auth: { ...geminiSettings.security?.auth, selectedType: "gemini-api-key" },
};
// Prevent Gemini CLI from recursively indexing the entire /app or container filesystem
// (mirrored from local ~/.gemini/settings.json).
geminiSettings.context = {
  ...geminiSettings.context,
  includeDirectories: [projectRoot],
  loadMemoryFromIncludeDirectories: false,
  includeDirectoryTree: false,
  fileFiltering: {
    ...geminiSettings.context?.fileFiltering,
    respectGitIgnore: true,
    respectGeminiIgnore: true,
    enableRecursiveFileSearch: false,
    enableFileWatcher: false,
  },
};
geminiSettings.tools = {
  ...geminiSettings.tools,
  sandbox: false,
  sandboxNetworkAccess: true,
  shell: {
    enableInteractiveShell: false,
    inactivityTimeout: 120,
    ...geminiSettings.tools?.shell,
  },
};
geminiSettings.ui = { ...geminiSettings.ui, errorVerbosity: geminiSettings.ui?.errorVerbosity ?? "full" };
geminiSettings.model = {
  ...geminiSettings.model,
  name: geminiModel,
  compressionThreshold: geminiSettings.model?.compressionThreshold ?? 0.3,
};
geminiSettings.experimental = {
  ...geminiSettings.experimental,
  dynamicModelConfiguration: true,
  useOSC52Copy: geminiSettings.experimental?.useOSC52Copy ?? true,
};
geminiSettings.agents = {
  ...geminiSettings.agents,
  overrides: {
    ...geminiSettings.agents?.overrides,
    cli_help: { enabled: false, ...geminiSettings.agents?.overrides?.cli_help },
    codebase_investigator: {
      modelConfig: { model: geminiFastModel },
      ...geminiSettings.agents?.overrides?.codebase_investigator,
    },
  },
};
geminiSettings.modelConfigs ??= {};
geminiSettings.modelConfigs.customAliases ??= {};
geminiSettings.modelConfigs.modelDefinitions ??= {};
geminiSettings.modelConfigs.modelIdResolutions ??= {};
geminiSettings.modelConfigs.classifierIdResolutions ??= {};

for (const alias of [
  geminiProModel,
  "gemini4",
  "gemini-4-carbon",
  "gemini-4-hydrogen",
  "gemini-3-pro-preview",
  "gemini-3.1-pro-preview",
  "gemini-3.1-pro-preview-customtools",
  "gemini-2.5-pro",
]) {
  const resolved = alias === "gemini-4-carbon" || alias === "gemini-4-hydrogen" ? alias : geminiProModel;
  geminiSettings.modelConfigs.customAliases[alias] = { extends: "chat-base-3", modelConfig: { model: resolved } };
}
for (const alias of [
  geminiFastModel,
  "gemini-3-flash-preview",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-3.1-flash-lite-preview",
  "gemini-3.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
]) {
  geminiSettings.modelConfigs.customAliases[alias] = { extends: "chat-base-3", modelConfig: { model: geminiFastModel } };
}
for (const baseAlias of ["gemini-2.5-flash-base", "gemini-3-flash-base", "gemini-3.5-flash-base"]) {
  geminiSettings.modelConfigs.customAliases[baseAlias] = { extends: "base", modelConfig: { model: geminiFastModel } };
}
geminiSettings.modelConfigs.customAliases["loop-detection-double-check"] = {
  extends: "base",
  modelConfig: { model: geminiProModel },
};
for (const compPro of ["chat-compression-3-pro", "chat-compression-2.5-pro", "chat-compression-default"]) {
  geminiSettings.modelConfigs.customAliases[compPro] = { modelConfig: { model: geminiProModel } };
}
for (const compFast of [
  "chat-compression-3-flash",
  "chat-compression-3.1-flash-lite",
  "chat-compression-2.5-flash",
  "chat-compression-2.5-flash-lite",
  "agent-history-provider-summarizer",
]) {
  geminiSettings.modelConfigs.customAliases[compFast] = { modelConfig: { model: geminiFastModel } };
}

geminiSettings.modelConfigs.modelDefinitions[geminiProModel] = {
  displayName: "Gemini 4",
  tier: "pro",
  family: "gemini-3",
  isPreview: false,
  isVisible: true,
  features: { thinking: true, multimodalToolUse: true },
};
geminiSettings.modelConfigs.modelDefinitions[geminiFastModel] = {
  displayName: "Gemini 3.8 Flash",
  tier: "flash",
  family: "gemini-3",
  isPreview: false,
  isVisible: true,
  features: { thinking: true, multimodalToolUse: true },
};
for (const alias of [
  geminiProModel,
  "gemini-4",
  "gemini4",
  "pro",
  "auto",
  "auto-gemini-3",
  "auto-gemini-2.5",
  "gemini-3-pro-preview",
  "gemini-3.1-pro-preview",
  "gemini-3.1-pro-preview-customtools",
  "gemini-2.5-pro",
]) {
  geminiSettings.modelConfigs.modelIdResolutions[alias] = { default: geminiProModel };
}
for (const alias of [
  geminiFastModel,
  "flash",
  "flash-lite",
  "gemini-3-flash-preview",
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-3.1-flash-lite",
  "gemini-3.1-flash-lite-preview",
  "gemini-3.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
]) {
  geminiSettings.modelConfigs.modelIdResolutions[alias] = { default: geminiFastModel };
}
geminiSettings.modelConfigs.classifierIdResolutions.pro = { default: geminiProModel };
geminiSettings.modelConfigs.classifierIdResolutions.flash = { default: geminiFastModel };
writeJson(path.join(geminiHome, "settings.json"), geminiSettings);

const trustedFolders = readJson(path.join(geminiHome, "trustedFolders.json"));
for (const root of trustedRoots) trustedFolders[root] = "TRUST_PARENT";
writeJson(path.join(geminiHome, "trustedFolders.json"), trustedFolders);

fs.writeFileSync(
  path.join(geminiPoliciesDir, "full-access.toml"),
  [
    "# The container is the isolation boundary. Gemini tools use the runtime user's",
    "# complete filesystem and process permissions without interactive approval.",
    "[[rule]]",
    'toolName = "*"',
    'decision = "allow"',
    "priority = 999",
    'modes = ["plan", "default", "autoEdit", "yolo"]',
    "allowRedirection = true",
    "",
  ].join("\n"),
  { mode: 0o600 }
);
fs.chmodSync(geminiHome, 0o700);
fs.chmodSync(geminiPoliciesDir, 0o700);

// 6. Claude native config (~/.claude/settings.json + ~/.claude.json)
fs.mkdirSync(claudeHome, { recursive: true });
const claudeSettings = readJson(path.join(claudeHome, "settings.json"));
claudeSettings.permissions = { ...claudeSettings.permissions, defaultMode: "bypassPermissions" };
claudeSettings.skipDangerousModePermissionPrompt = true;
writeJson(path.join(claudeHome, "settings.json"), claudeSettings);

const claudeState = readJson(path.join(home, ".claude.json"));
claudeState.hasCompletedOnboarding = true;
claudeState.bypassPermissionsModeAccepted = true;
claudeState.projects ??= {};
for (const root of trustedRoots) {
  claudeState.projects[root] = {
    ...claudeState.projects[root],
    hasTrustDialogAccepted: true,
    hasTrustDialogHooksAccepted: true,
  };
}
writeJson(path.join(home, ".claude.json"), claudeState);

// 7. Ensure native Herdr integrations are present & configured in settings/hooks
// (baked into /root at image build time; re-applied if settings were regenerated).
const herdrBin = process.env.HERDR_BIN || "/usr/local/bin/herdr";
if (fs.existsSync(herdrBin)) {
  const integrations = [
    ["codex", path.join(codexHome, "hooks.json")],
    ["claude", path.join(claudeHome, "hooks", "herdr-agent-state.sh")],
    ["pi", path.join(piDir, "extensions", "herdr-agent-state.ts")],
  ];
  for (const [kind, marker] of integrations) {
    const needsClaudeHook = kind === "claude" && !Array.isArray(readJson(path.join(claudeHome, "settings.json")).hooks?.SessionStart);
    if (!fs.existsSync(marker) || needsClaudeHook) {
      try {
        execFileSync(herdrBin, ["integration", "install", kind], {
          env: { ...process.env, HOME: home, PI_CODING_AGENT_DIR: piDir },
          stdio: "ignore",
        });
      } catch {}
    }
  }
}

// 8. Build-time hook trust bake: when invoked with --bake-image, approve the
// Codex Herdr hook via a 1-second PTY launch and record its [hooks.state] hash.
if (process.argv.includes("--bake-image")) {
  for (const kind of ["codex", "claude", "pi"]) {
    execFileSync(herdrBin, ["integration", "install", kind], {
      env: { ...process.env, HOME: home, PI_CODING_AGENT_DIR: piDir },
      stdio: "inherit",
    });
  }
  const pyScript = [
    "import fcntl, os, pty, select, struct, subprocess, termios, time",
    "master, slave = pty.openpty()",
    'fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", 40, 120, 0, 0))',
    'p = subprocess.Popen(["/usr/local/bin/codex"], stdin=slave, stdout=slave, stderr=slave, cwd="/app", close_fds=True)',
    "os.close(slave)",
    'buf = b""',
    "deadline = time.time() + 8",
    "while time.time() < deadline:",
    "    r, _, _ = select.select([master], [], [], 0.1)",
    "    if r:",
    "        buf += os.read(master, 8192)",
    '        if b"Trust" in buf:',
    "            time.sleep(0.3)",
    '            os.write(master, b"2\\r")',
    "            time.sleep(0.8)",
    "            break",
    "p.terminate()",
    "try:",
    "    p.wait(timeout=3)",
    "except Exception:",
    "    p.kill()",
  ].join("\n");
  execFileSync("python3", ["-c", pyScript], { env: { ...process.env, HOME: home } });
  try {
    execFileSync("pkill", ["-9", "-f", "codex"], { stdio: "ignore" });
  } catch {}
  for (const stale of ["app-server-control", "app-server-daemon", "tmp", "log"]) {
    fs.rmSync(path.join(codexHome, stale), { recursive: true, force: true });
  }
  const updatedLines = fs.readFileSync(codexConfigPath, "utf8").split(/\r?\n/);
  let inHookState = false;
  const hookLines = [];
  for (const line of updatedLines) {
    if (/^\[hooks\.state(\]|\.)/.test(line)) inHookState = true;
    else if (/^\[/.test(line)) inHookState = false;
    if (inHookState) hookLines.push(line);
  }
  const hookState = hookLines.join("\n").trim();
  if (!hookState.includes('trusted_hash = "sha256:')) {
    throw new Error("Failed to bake Codex hook trusted_hash at build time");
  }
  fs.writeFileSync(bakedHookStatePath, `${hookState}\n`, { mode: 0o644 });
}
