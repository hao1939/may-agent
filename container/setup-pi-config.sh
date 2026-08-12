#!/bin/bash
set -e

export HOME="${HOME:-/app/.state}"
export MODEL_BASE_URL="${MODEL_BASE_URL:-http://host.docker.internal:4000}"
export MODEL_API_KEY="${MODEL_API_KEY:-not-needed}"
export PI_CODING_AGENT_DIR="${PI_CODING_AGENT_DIR:-${HOME}/.pi/agent}"
pi_state_root="$(dirname "${PI_CODING_AGENT_DIR}")"

pi_openai_model="${PI_OPENAI_MODEL:-${CODEX_MODEL:-gpt-5.6-sol}}"
pi_anthropic_model="${PI_ANTHROPIC_MODEL:-${CLAUDE_MODEL:-claude-opus-5}}"
pi_anthropic_base_url="${MODEL_BASE_URL%/}"
pi_openai_base_url="${pi_anthropic_base_url}"
case "${pi_openai_base_url}" in
  */v1) ;;
  *) pi_openai_base_url="${pi_openai_base_url}/v1" ;;
esac

mkdir -p "${pi_state_root}" "${PI_CODING_AGENT_DIR}"
node - "${PI_CODING_AGENT_DIR}" "${pi_openai_base_url}" "${pi_openai_model}" "${pi_anthropic_base_url}" "${pi_anthropic_model}" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const [configDir, openaiBaseUrl, openaiModel, anthropicBaseUrl, anthropicModel] = process.argv.slice(2);
const config = {
  providers: {
    "may-openai": {
      baseUrl: openaiBaseUrl,
      api: "openai-responses",
      apiKey: "$MODEL_API_KEY",
      models: [{
        id: openaiModel,
        name: openaiModel,
        reasoning: true,
        input: ["text", "image"],
        contextWindow: 400000,
        maxTokens: 128000,
      }],
    },
    "may-anthropic": {
      baseUrl: anthropicBaseUrl,
      api: "anthropic-messages",
      apiKey: "$MODEL_API_KEY",
      models: [{
        id: anthropicModel,
        name: anthropicModel,
        reasoning: true,
        input: ["text", "image"],
        contextWindow: 200000,
        maxTokens: 128000,
        compat: { forceAdaptiveThinking: true },
      }],
    },
  },
};
fs.writeFileSync(path.join(configDir, "models.json"), `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });

const settingsPath = path.join(configDir, "settings.json");
let settings = {};
try {
  settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
} catch {}
settings.defaultProvider ??= "may-openai";
settings.defaultModel ??= openaiModel;
settings.defaultThinkingLevel ??= "high";
fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 });
NODE

chmod 600 "${PI_CODING_AGENT_DIR}/models.json" "${PI_CODING_AGENT_DIR}/settings.json"
if [ "$(id -u)" = "0" ] && id mayagent >/dev/null 2>&1; then
  # Pi updates the catalog through auth.json/models-store.json and may create
  # additional top-level state paths. Repair those without recursively walking
  # potentially large persisted session histories on every container start.
  chown mayagent:mayagent "${pi_state_root}" "${PI_CODING_AGENT_DIR}" 2>/dev/null || true
  find "${PI_CODING_AGENT_DIR}" -mindepth 1 -maxdepth 1 \
    -exec chown mayagent:mayagent {} + 2>/dev/null || true
fi
