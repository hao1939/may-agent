const PORTABLE_PROCESS_ENV = [
  "HOME",
  "LANG",
  "LC_ALL",
  "LOGNAME",
  "NO_COLOR",
  "PATH",
  "DISPLAY",
  "SHELL",
  "TERM",
  "TMPDIR",
  "TZ",
  "USER",
  "XDG_CACHE_HOME",
  "XDG_CONFIG_HOME",
  "XDG_DATA_HOME",
  "XDG_RUNTIME_DIR",
] as const;

const HOST_RUNTIME_ENV = [
  "AGENT",
  "AGENTS_ROOT",
  "APP_ROOT",
  "CONVERSATION_APP",
  "CONVERSATION_ID",
  "DAEMON_AGENT",
  "DAEMON_INSTANCE",
  "DISABLED_GUARDS",
  "INSTANCE",
  "MAY_AGENT_APP_ROOT",
  "MAY_AGENT_SDK_ROOT",
  "MAY_AGENT_UI_DIR",
  "MAY_DAEMON_QUIET",
  "MAY_HOST_MAX_CONCURRENT",
  "MAY_RUNTIME_IMPORT_CACHE_DIR",
  "PROJECT_ROOT",
  "PROJECTS_ROOT",
  "SHARED_ROOT",
  "STATE_DIR",
  "WEB_PORT",
] as const;

// Explicit non-secret fixture controls keep portable subprocess tests exercising the
// production spawn path without restoring ambient inheritance.
const TASK_ADMISSION_TEST_ENV = ["ADMISSION_TEST_ROOT", "ADMISSION_TEST_SCENARIO"] as const;
const TASK_ATTEMPT_TEST_ENV = ["MAY_TEST_HOLD_STARTUP_ATTEMPT", "TASK_COMMAND_PROBE_ROOT"] as const;
const NATIVE_CLI_TEST_ENV = ["TASK_NATIVE_DB_PROBE"] as const;
const MODEL_PROVIDER_ENV = ["MODEL_API_KEY", "MODEL_BASE_URL", "DEEPSEEK_API_KEY", "DEEPSEEK_BASE_URL"] as const;
const TASK_ATTEMPT_EXECUTOR_ENV = ["MAY_CODEX_GOAL_COMMAND"] as const;
const NATIVE_CLI_ENV = [
  "CLAUDE_CONFIG_DIR",
  "CLAUDE_MODEL",
  "CODEX_HOME",
  "CODEX_MODEL",
  "CODEX_REASONING_EFFORT",
  "MAY_CODEX_HOME",
  "MAY_NATIVE_CALLER_IDENTITY",
] as const;
const GITHUB_ENV = ["GH_HOST", "GH_TOKEN", "GITHUB_TOKEN"] as const;

function selectEnvironment(source: NodeJS.ProcessEnv, names: readonly string[]): NodeJS.ProcessEnv {
  const selected: NodeJS.ProcessEnv = {};
  for (const name of names) {
    const value = source[name];
    if (value !== undefined) selected[name] = value;
  }
  return selected;
}

/** Canonical Task admission mutates local state and loads definitions; it needs no provider or transport credential. */
export function taskAdmissionEnvironment(source: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return selectEnvironment(source, [...PORTABLE_PROCESS_ENV, ...HOST_RUNTIME_ENV, ...TASK_ADMISSION_TEST_ENV]);
}

/** Task attempts run the model and may invoke GitHub-aware tools, but do not own transport adapters. */
export function taskAttemptEnvironment(source: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return selectEnvironment(source, [
    ...PORTABLE_PROCESS_ENV,
    ...HOST_RUNTIME_ENV,
    ...MODEL_PROVIDER_ENV,
    ...TASK_ATTEMPT_EXECUTOR_ENV,
    ...NATIVE_CLI_ENV,
    ...GITHUB_ENV,
    ...TASK_ATTEMPT_TEST_ENV,
  ]);
}

/** Native coding CLIs need their model endpoint/config plus ordinary GitHub and process context. */
export function nativeCliEnvironment(source: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return selectEnvironment(source, [
    ...PORTABLE_PROCESS_ENV,
    ...HOST_RUNTIME_ENV,
    ...MODEL_PROVIDER_ENV,
    ...NATIVE_CLI_ENV,
    ...GITHUB_ENV,
    ...NATIVE_CLI_TEST_ENV,
  ]);
}

/** Agent shell commands retain runtime paths and GitHub access, not model-provider or transport credentials. */
export function agentShellEnvironment(source: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return selectEnvironment(source, [...PORTABLE_PROCESS_ENV, ...HOST_RUNTIME_ENV, ...GITHUB_ENV]);
}
