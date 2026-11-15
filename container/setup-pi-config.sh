#!/bin/bash
set -e

export HOME="${HOME:-/var/lib/mayagent}"
export MODEL_BASE_URL="${MODEL_BASE_URL:-http://host.docker.internal:4000}"
export MODEL_API_KEY="${MODEL_API_KEY:-not-needed}"
export PI_CODING_AGENT_DIR="${PI_CODING_AGENT_DIR:-${HOME}/.pi/agent}"
pi_state_root="$(dirname "${PI_CODING_AGENT_DIR}")"

pi_openai_model="${PI_OPENAI_MODEL:-${CODEX_MODEL:-${OPENAI_DEFAULT_MODEL:-gpt-6.1-sol}}}"
pi_google_model="${PI_GOOGLE_MODEL:-${GEMINI_PRO_MODEL:-gemini-4-argon}}"
pi_google_fast_model="${GEMINI_FAST_MODEL:-gemini-3.8-flash}"
pi_anthropic_model="${PI_ANTHROPIC_MODEL:-${CLAUDE_MODEL:-claude-opus-5}}"

pi_anthropic_base_url="${MODEL_BASE_URL%/}"
pi_openai_base_url="${pi_anthropic_base_url}"
case "${pi_openai_base_url}" in
  */v1) ;;
  *) pi_openai_base_url="${pi_openai_base_url}/v1" ;;
esac

pi_google_base_url="${GOOGLE_GEMINI_BASE_URL:-${MODEL_BASE_URL%/}}"
pi_google_base_url="${pi_google_base_url%/}"
case "${pi_google_base_url}" in
  */v1beta) ;;
  */v1) pi_google_base_url="${pi_google_base_url%/v1}/v1beta" ;;
  *) pi_google_base_url="${pi_google_base_url}/v1beta" ;;
esac

mkdir -p "${pi_state_root}" "${PI_CODING_AGENT_DIR}"
if [ -n "${STATE_DIR:-}" ] && [ -d "${STATE_DIR}/cli-state/pi/sessions" ] && [ "${PI_CODING_AGENT_DIR}" != "${STATE_DIR}/cli-state/pi" ]; then
  if [ ! -e "${PI_CODING_AGENT_DIR}/sessions" ] && [ ! -L "${PI_CODING_AGENT_DIR}/sessions" ]; then
    ln -sfn "${STATE_DIR}/cli-state/pi/sessions" "${PI_CODING_AGENT_DIR}/sessions"
  fi
fi

node - "${PI_CODING_AGENT_DIR}" "${pi_openai_base_url}" "${pi_openai_model}" "${pi_google_base_url}" "${pi_google_model}" "${pi_google_fast_model}" "${pi_anthropic_base_url}" "${pi_anthropic_model}" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const [
  configDir,
  openaiBaseUrl,
  openaiModel,
  googleBaseUrl,
  googleModel,
  googleFastModel,
  anthropicBaseUrl,
  anthropicModel,
] = process.argv.slice(2);

const uniqueIds = (ids) => [...new Set(ids.filter(Boolean))];
const openaiIds = uniqueIds([
  openaiModel,
  "gpt-6.1-sol",
  "gpt-6-astra",
  "gpt-5.6-sol",
  "gpt-5.5",
  "gpt-5.4",
  "gpt-5.3-codex",
  "gpt-5.4-mini",
]);
const googleIds = uniqueIds([
  googleModel,
  googleFastModel,
  "gemini-4-argon",
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-3.1-pro-preview",
]);
const anthropicIds = uniqueIds([
  anthropicModel,
  "claude-opus-5",
  "claude-sonnet-5",
  "claude-opus-4-8",
]);

const config = {
  providers: {
    "may-openai": {
      baseUrl: openaiBaseUrl,
      api: "openai-responses",
      apiKey: "$MODEL_API_KEY",
      models: openaiIds.map((id) => ({
        id,
        name: id,
        reasoning: true,
        input: ["text", "image"],
        contextWindow: 400000,
        maxTokens: 128000,
      })),
    },
    "may-google": {
      baseUrl: googleBaseUrl,
      api: "google-generative-ai",
      apiKey: "$MODEL_API_KEY",
      models: googleIds.map((id) => ({
        id,
        name: id,
        reasoning: true,
        input: ["text", "image"],
        contextWindow: 1000000,
        maxTokens: 65536,
      })),
    },
    "may-anthropic": {
      baseUrl: anthropicBaseUrl,
      api: "anthropic-messages",
      apiKey: "$MODEL_API_KEY",
      models: anthropicIds.map((id) => ({
        id,
        name: id,
        reasoning: true,
        input: ["text", "image"],
        contextWindow: 200000,
        maxTokens: 128000,
        compat: { forceAdaptiveThinking: true },
      })),
    },
  },
};

const localModelsPath = process.env.STATE_DIR
  ? path.join(process.env.STATE_DIR, "cli-config", "pi-models.local.json")
  : "";
if (localModelsPath && fs.existsSync(localModelsPath)) {
  try {
    const extra = JSON.parse(fs.readFileSync(localModelsPath, "utf8"));
    if (extra && typeof extra.providers === "object") {
      config.providers = { ...extra.providers, ...config.providers };
    }
  } catch {}
}

fs.writeFileSync(path.join(configDir, "models.json"), `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });

const settingsPath = path.join(configDir, "settings.json");
let settings = {};
try {
  settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
} catch {}
// The container-managed endpoint is authoritative for plain `pi` launches.
// Preserve unrelated UI preferences, but do not retain a stale external
// provider or model from an older persisted state directory.
settings.defaultProvider = "may-openai";
settings.defaultModel = openaiModel;
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
