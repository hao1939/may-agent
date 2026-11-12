#!/bin/bash
set -e

export HOME="${HOME:-/app/.state}"
export PROJECT_ROOT="${PROJECT_ROOT:-/app}"
export MODEL_BASE_URL="${MODEL_BASE_URL:-http://host.docker.internal:4000}"
export MODEL_API_KEY="${MODEL_API_KEY:-not-needed}"
export GEMINI_API_KEY="${GEMINI_API_KEY:-${MODEL_API_KEY}}"
export GOOGLE_GEMINI_BASE_URL="${GOOGLE_GEMINI_BASE_URL:-${MODEL_BASE_URL%/}}"

# GEMINI_CLI_HOME replaces the OS home; Gemini then appends `.gemini`.
gemini_home="${GEMINI_CLI_HOME:-${HOME}}/.gemini"
gemini_model="${GEMINI_MODEL:-gemini-3.5-flash}"
gemini_pro_model="${GEMINI_PRO_MODEL:-gemini-4-argon}"
policy_dir="${gemini_home}/policies"

mkdir -p "${policy_dir}"
node - "${gemini_home}/settings.json" "${PROJECT_ROOT}" "${gemini_model}" "${gemini_pro_model}" <<'NODE'
const fs = require("node:fs");
const [file, projectRoot, model, proModel] = process.argv.slice(2);
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
for (const alias of [proModel, "gemini4"]) {
  settings.modelConfigs.customAliases[alias] = {
    extends: "chat-base-3",
    modelConfig: { model: proModel },
  };
}
settings.modelConfigs.modelDefinitions[proModel] = {
  displayName: "Gemini 4",
  tier: "pro",
  family: "gemini-3",
  isPreview: false,
  isVisible: true,
  features: { thinking: true, multimodalToolUse: true },
};
for (const alias of [proModel, "gemini-4", "gemini4", "pro"]) {
  settings.modelConfigs.modelIdResolutions[alias] = { default: proModel };
}
fs.writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 });
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

chmod 700 "${gemini_home}" "${policy_dir}"
chmod 600 "${gemini_home}/settings.json" "${policy_dir}/full-access.toml"
if [ "$(id -u)" = "0" ] && id mayagent >/dev/null 2>&1; then
  chown mayagent:mayagent "${gemini_home}" "${policy_dir}" "${gemini_home}/settings.json" "${policy_dir}/full-access.toml" 2>/dev/null || true
  find "${gemini_home}" -mindepth 1 -maxdepth 1 -exec chown mayagent:mayagent {} + 2>/dev/null || true
fi
