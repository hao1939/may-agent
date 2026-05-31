import { describe, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const bridgePath = resolve(repoRoot, "packages", "terminal", "bin", "terminal-bridge.cjs");

function commandHash(command: string): string {
  return createHash("sha256").update(command).digest("hex").slice(0, 16);
}

function makeFakeTmuxDir(seed?: { profileId?: string; command?: string }) {
  const root = join(tmpdir(), `may-terminal-test-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const binDir = join(root, "bin");
  mkdirSync(binDir, { recursive: true });
  const logPath = join(root, "tmux.log");
  const sessionPath = join(root, "session");
  const envPath = join(root, "env");
  writeFileSync(logPath, "");
  if (seed) {
    writeFileSync(sessionPath, "1");
    writeFileSync(envPath, [
      seed.profileId ? `MAY_TERMINAL_PROFILE_ID=${seed.profileId}` : "",
      seed.command ? `MAY_TERMINAL_COMMAND_HASH=${commandHash(seed.command)}` : "",
    ].filter(Boolean).join("\n"));
  }

  const tmuxPath = join(binDir, "tmux");
  writeFileSync(tmuxPath, `#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" == "-L" ]]; then shift 2; fi
cmd="\${1:-}"; shift || true
printf '%s\\n' "$cmd $*" >> "$FAKE_TMUX_LOG"
case "$cmd" in
  has-session)
    [[ -f "$FAKE_TMUX_SESSION" ]]
    ;;
  show-environment)
    name="\${@: -1}"
    [[ -f "$FAKE_TMUX_ENV" ]] || exit 1
    grep -E "^$name=" "$FAKE_TMUX_ENV" || exit 1
    ;;
  set-environment)
    name="\${@: -2:1}"
    value="\${@: -1}"
    grep -v -E "^$name=" "$FAKE_TMUX_ENV" 2>/dev/null > "$FAKE_TMUX_ENV.tmp" || true
    printf '%s=%s\\n' "$name" "$value" >> "$FAKE_TMUX_ENV.tmp"
    mv "$FAKE_TMUX_ENV.tmp" "$FAKE_TMUX_ENV"
    ;;
  kill-session)
    rm -f "$FAKE_TMUX_SESSION" "$FAKE_TMUX_ENV"
    ;;
  new-session)
    touch "$FAKE_TMUX_SESSION"
    ;;
  attach-session)
    printf 'attached fake tmux\\n'
    sleep 30
    ;;
  set-option|bind-key)
    ;;
  *)
    ;;
esac
`);
  chmodSync(tmuxPath, 0o755);

  return {
    root,
    binDir,
    logPath,
    sessionPath,
    envPath,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

async function runBridge(fake: ReturnType<typeof makeFakeTmuxDir>, config: Record<string, unknown>) {
  const child = spawn("node", [bridgePath, JSON.stringify(config)], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PATH: `${fake.binDir}:${process.env.PATH || ""}`,
      FAKE_TMUX_LOG: fake.logPath,
      FAKE_TMUX_SESSION: fake.sessionPath,
      FAKE_TMUX_ENV: fake.envPath,
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  await new Promise<void>((resolveReady, reject) => {
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("terminal bridge did not become ready"));
    }, 5_000);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      if (stdout.includes('"type":"ready"')) {
        clearTimeout(timeout);
        resolveReady();
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("exit", (code) => {
      if (!stdout.includes('"type":"ready"')) {
        clearTimeout(timeout);
        reject(new Error(`terminal bridge exited before ready: ${code}; ${stderr}`));
      }
    });
  });

  child.kill("SIGTERM");
  await new Promise<void>((resolveExit) => child.once("exit", () => resolveExit()));
}

describe("terminal bridge tmux profile validation", () => {
  test("recreates an existing tmux session when its profile marker is missing", async () => {
    const command = "bash -lc codex";
    const fake = makeFakeTmuxDir({});
    try {
      await runBridge(fake, {
        profileId: "codex",
        tmuxName: "may-web-codex",
        tmuxSocket: "may-web",
        command,
        cwd: repoRoot,
      });
      const log = readFileSync(fake.logPath, "utf8");
      const env = readFileSync(fake.envPath, "utf8");
      expect(log).toContain("kill-session -t may-web-codex");
      expect(log).toContain("new-session -d -s may-web-codex");
      expect(env).toContain("MAY_TERMINAL_PROFILE_ID=codex");
      expect(env).toContain(`MAY_TERMINAL_COMMAND_HASH=${commandHash(command)}`);
    } finally {
      fake.cleanup();
    }
  });

  test("keeps an existing tmux session when profile and command markers match", async () => {
    const command = "bash -lc claude";
    const fake = makeFakeTmuxDir({ profileId: "claude", command });
    try {
      await runBridge(fake, {
        profileId: "claude",
        tmuxName: "may-web-claude",
        tmuxSocket: "may-web",
        command,
        cwd: repoRoot,
      });
      const log = readFileSync(fake.logPath, "utf8");
      expect(log).not.toContain("kill-session -t may-web-claude");
      expect(log).not.toContain("new-session -d -s may-web-claude");
      expect(log).toContain("attach-session -t may-web-claude");
      expect(log).toContain("set-option -g mouse on");
      expect(log).toContain("set-option -g history-limit 100000");
      expect(log).toContain("bind-key -T root WheelUpPane if-shell -F #{||:#{pane_in_mode},#{mouse_any_flag}} send-keys -M copy-mode -eH");
    } finally {
      fake.cleanup();
    }
  });
});
