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
  const inputPath = join(root, "tmux-input.log");
  const sessionPath = join(root, "session");
  const envPath = join(root, "env");
  writeFileSync(logPath, "");
  writeFileSync(inputPath, "");
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
    cat >> "$FAKE_TMUX_INPUT"
    ;;
  set-option)
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
    inputPath,
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
      FAKE_TMUX_INPUT: fake.inputPath,
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

async function startBridge(fake: ReturnType<typeof makeFakeTmuxDir>, config: Record<string, unknown>) {
  const child = spawn("node", [bridgePath, JSON.stringify(config)], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PATH: `${fake.binDir}:${process.env.PATH || ""}`,
      FAKE_TMUX_LOG: fake.logPath,
      FAKE_TMUX_INPUT: fake.inputPath,
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

  return child;
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
      expect(log).toContain("set-option -t may-web-claude mouse off");
      expect(log).toContain("set-option -t may-web-claude history-limit 100000");
      expect(log).toContain("set-option -t may-web-claude status off");
      expect(log).toContain("set-option -gu terminal-overrides");
      expect(log).not.toContain("capture-pane");
      expect(log).not.toContain("bind-key");
    } finally {
      fake.cleanup();
    }
  });

  test("preserves split UTF-8 inside manager input frames", async () => {
    const command = "bash -lc shell";
    const fake = makeFakeTmuxDir({ profileId: "shell", command });
    try {
      const child = await startBridge(fake, {
        profileId: "shell",
        tmuxName: "may-web-shell",
        tmuxSocket: "may-web",
        command,
        cwd: repoRoot,
      });

      const data = "typed █▒ ✓\n";
      const frame = JSON.stringify({ type: "input", data }) + "\n";
      const bytes = Buffer.from(frame, "utf8");
      const splitAt = bytes.indexOf(Buffer.from("█")) + 1;
      child.stdin.write(bytes.subarray(0, splitAt));
      await new Promise((resolve) => setTimeout(resolve, 5));
      child.stdin.write(bytes.subarray(splitAt));
      await new Promise((resolve) => setTimeout(resolve, 50));

      child.kill("SIGTERM");
      await new Promise<void>((resolveExit) => child.once("exit", () => resolveExit()));

      const input = readFileSync(fake.inputPath, "utf8");
      const log = readFileSync(fake.logPath, "utf8");
      expect(log).toContain("set-option -t may-web-shell mouse off");
      expect(input).toContain(data);
      expect(input).not.toContain("�");
    } finally {
      fake.cleanup();
    }
  });

  test("scrolls tmux history without enabling mouse handling and returns live on input", async () => {
    const command = "bash -lc claude";
    const fake = makeFakeTmuxDir({ profileId: "claude", command });
    try {
      const child = await startBridge(fake, {
        profileId: "claude",
        tmuxName: "may-web-claude",
        tmuxSocket: "may-web",
        command,
        cwd: repoRoot,
      });

      child.stdin.write(JSON.stringify({ type: "scroll", direction: "up", lines: 6 }) + "\n");
      child.stdin.write(JSON.stringify({ type: "scroll", direction: "down", lines: 3 }) + "\n");
      child.stdin.write(JSON.stringify({ type: "input", data: "continue\n" }) + "\n");
      child.stdin.write(JSON.stringify({ type: "input", data: "without extra tmux work\n" }) + "\n");
      await new Promise((resolve) => setTimeout(resolve, 80));

      child.kill("SIGTERM");
      await new Promise<void>((resolveExit) => child.once("exit", () => resolveExit()));

      const log = readFileSync(fake.logPath, "utf8");
      const input = readFileSync(fake.inputPath, "utf8");
      expect(log).toContain("set-option -t may-web-claude mouse off");
      expect(log).toContain("copy-mode -eH -t may-web-claude");
      expect(log).toContain("send-keys -t may-web-claude -X -N 6 scroll-up");
      expect(log).toContain("send-keys -t may-web-claude -X -N 3 scroll-down");
      expect(log.match(/send-keys -t may-web-claude -X cancel/g)).toHaveLength(1);
      expect(input).toContain("continue\n");
      expect(input).toContain("without extra tmux work\n");
    } finally {
      fake.cleanup();
    }
  });
});
