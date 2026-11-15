#!/bin/bash
set -e

export HOME="${HOME:-/var/lib/mayagent}"
export PROJECT_ROOT="${PROJECT_ROOT:-/app}"
export MODEL_BASE_URL="${MODEL_BASE_URL:-http://host.docker.internal:4000}"
export MODEL_API_KEY="${MODEL_API_KEY:-not-needed}"
export GEMINI_API_KEY="${GEMINI_API_KEY:-${MODEL_API_KEY}}"
export GOOGLE_GEMINI_BASE_URL="${GOOGLE_GEMINI_BASE_URL:-${MODEL_BASE_URL%/}}"

# GEMINI_CLI_HOME replaces the OS home; Gemini then appends `.gemini`.
gemini_home="${GEMINI_CLI_HOME:-${HOME}}/.gemini"
gemini_pro_model="${GEMINI_PRO_MODEL:-gemini-4-argon}"
gemini_fast_model="${GEMINI_FAST_MODEL:-gemini-3.8-flash}"
gemini_model="${GEMINI_MODEL:-${gemini_pro_model}}"
policy_dir="${gemini_home}/policies"
hooks_dir="${gemini_home}/hooks"

mkdir -p "${policy_dir}" "${hooks_dir}"
if [ -n "${STATE_DIR:-}" ] && [ -d "${STATE_DIR}/cli-state/gemini" ] && [ "${gemini_home}" != "${STATE_DIR}/cli-state/gemini" ]; then
  for sub in history tmp; do
    mkdir -p "${STATE_DIR}/cli-state/gemini/${sub}"
    if [ ! -e "${gemini_home}/${sub}" ] && [ ! -L "${gemini_home}/${sub}" ]; then
      ln -sfn "${STATE_DIR}/cli-state/gemini/${sub}" "${gemini_home}/${sub}"
    fi
  done
fi

node - "${gemini_home}/settings.json" "${PROJECT_ROOT}" "${gemini_model}" "${gemini_pro_model}" "${gemini_fast_model}" <<'NODE'
const fs = require("node:fs");
const [file, projectRoot, model, proModel, fastModel] = process.argv.slice(2);
let settings = {};
try {
  settings = JSON.parse(fs.readFileSync(file, "utf8"));
} catch {}
settings.general = { ...settings.general, defaultApprovalMode: "auto_edit" };
settings.security = {
  ...settings.security,
  folderTrust: { ...settings.security?.folderTrust, enabled: false },
  auth: { ...settings.security?.auth, selectedType: "gemini-api-key" },
};
settings.context = {
  ...settings.context,
  includeDirectories: [projectRoot],
  loadMemoryFromIncludeDirectories: false,
  fileFiltering: {
    ...settings.context?.fileFiltering,
    respectGitIgnore: false,
    respectGeminiIgnore: false,
  },
};
settings.tools = { ...settings.tools, sandbox: false, sandboxNetworkAccess: true };
settings.model = { ...settings.model, name: model };
settings.experimental = { ...settings.experimental, dynamicModelConfiguration: true };
settings.modelConfigs ??= {};
settings.modelConfigs.customAliases ??= {};
settings.modelConfigs.modelDefinitions ??= {};
settings.modelConfigs.modelIdResolutions ??= {};
settings.modelConfigs.classifierIdResolutions ??= {};

for (const alias of [proModel, "gemini4", "gemini-4-carbon", "gemini-4-hydrogen", "gemini-3.1-pro-preview"]) {
  const resolved = alias === "gemini4" || alias === "gemini-3.1-pro-preview" ? proModel : alias;
  settings.modelConfigs.customAliases[alias] = {
    extends: "chat-base-3",
    modelConfig: { model: resolved },
  };
}
settings.modelConfigs.customAliases[fastModel] = {
  extends: "chat-base-3",
  modelConfig: { model: fastModel },
};

settings.modelConfigs.modelDefinitions[proModel] = {
  displayName: "Gemini 4",
  tier: "pro",
  family: "gemini-3",
  isPreview: false,
  isVisible: true,
  features: { thinking: true, multimodalToolUse: true },
};
settings.modelConfigs.modelDefinitions[fastModel] = {
  displayName: "Gemini 3.8 Flash",
  tier: "flash",
  family: "gemini-3",
  isPreview: false,
  isVisible: true,
  features: { thinking: true, multimodalToolUse: true },
};

for (const alias of [proModel, "gemini-4", "gemini4", "pro", "auto", "auto-gemini-3", "gemini-3.1-pro-preview", "gemini-2.5-pro"]) {
  settings.modelConfigs.modelIdResolutions[alias] = { default: proModel };
}
for (const alias of [fastModel, "flash", "flash-lite", "gemini-3.5-flash", "gemini-3.6-flash", "gemini-2.5-flash"]) {
  settings.modelConfigs.modelIdResolutions[alias] = { default: fastModel };
}
settings.modelConfigs.classifierIdResolutions.pro = { default: proModel };
settings.modelConfigs.classifierIdResolutions.flash = { default: fastModel };

fs.writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 });

const path = require("node:path");
const trustedFoldersPath = path.join(path.dirname(file), "trustedFolders.json");
let trustedFolders = {};
try {
  trustedFolders = JSON.parse(fs.readFileSync(trustedFoldersPath, "utf8"));
} catch {}
for (const folder of [projectRoot, `${projectRoot}/projects`, `${projectRoot}/worktrees`, "/app", "/tmp"]) {
  if (folder) trustedFolders[folder] = "TRUST_PARENT";
}
fs.writeFileSync(trustedFoldersPath, `${JSON.stringify(trustedFolders, null, 2)}\n`, { mode: 0o600 });
NODE

cat > "${policy_dir}/full-access.toml" <<'EOF'
# The container is the isolation boundary. Gemini tools use the runtime user's
# complete filesystem and process permissions without interactive approval.
[[rule]]
toolName = "*"
decision = "allow"
priority = 999
modes = ["plan", "default", "autoEdit", "yolo"]
allowRedirection = true
EOF

chmod 700 "${gemini_home}" "${policy_dir}" "${hooks_dir}"
chmod 600 "${gemini_home}/settings.json" "${policy_dir}/full-access.toml"
if [ "$(id -u)" = "0" ] && id mayagent >/dev/null 2>&1; then
  chown mayagent:mayagent "${gemini_home}" "${policy_dir}" "${hooks_dir}" "${gemini_home}/settings.json" "${policy_dir}/full-access.toml" 2>/dev/null || true
  find "${gemini_home}" -mindepth 1 -maxdepth 1 -exec chown mayagent:mayagent {} + 2>/dev/null || true
fi
