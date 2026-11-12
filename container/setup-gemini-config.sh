#!/bin/bash
set -e

export HOME="${HOME:-/app/.state}"
export PROJECT_ROOT="${PROJECT_ROOT:-/app}"
export MODEL_BASE_URL="${MODEL_BASE_URL:-http://host.docker.internal:4000}"
export MODEL_API_KEY="${MODEL_API_KEY:-not-needed}"
export GEMINI_API_KEY="${GEMINI_API_KEY:-${MODEL_API_KEY}}"
export GOOGLE_GEMINI_BASE_URL="${GOOGLE_GEMINI_BASE_URL:-${MODEL_BASE_URL%/}}"

gemini_home="${GEMINI_CLI_HOME:-${HOME}/.gemini}"
gemini_model="${GEMINI_MODEL:-gemini-3.5-flash}"
policy_dir="${gemini_home}/policies"

mkdir -p "${policy_dir}"
node - "${gemini_home}/settings.json" "${PROJECT_ROOT}" "${gemini_model}" <<'NODE'
const fs = require("node:fs");
const [file, projectRoot, model] = process.argv.slice(2);
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
