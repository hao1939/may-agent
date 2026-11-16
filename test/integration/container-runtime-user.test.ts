import { afterEach, describe, expect, test } from "bun:test";
import { execFile } from "node:child_process";
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const repoRoot = resolve(import.meta.dirname, "../..");
const read = (path: string) => readFileSync(resolve(repoRoot, path), "utf8");
const configureScript = resolve(repoRoot, "container/configure-runtime.cjs");
const execute = promisify(execFile);
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

async function runConfigure(env: Record<string, string>) {
  return execute(process.execPath, [configureScript], {
    env: { PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin", ...env },
    timeout: 5_000,
    killSignal: "SIGKILL",
  });
}

describe("container runtime configuration and layout", () => {
  test("ships native CLI symlinks and static build-time preconfiguration without shell wrappers", () => {
    const dockerfile = read("container/Dockerfile");
    const supervisor = read("container/supervisord.conf");
    const nginx = read("container/may-agent-nginx.conf");
    const entrypoint = read("container/entrypoint.sh");

    expect(dockerfile).toContain("WORKDIR /app");
    expect(dockerfile).toContain("ln -s /opt/may-agent-cli/node_modules/.bin/claude /usr/local/bin/claude");
    expect(dockerfile).toContain("ln -s /opt/may-agent-cli/node_modules/.bin/codex /usr/local/bin/codex");
    expect(dockerfile).toContain("ln -s /opt/may-agent-cli/node_modules/.bin/pi /usr/local/bin/pi");
    expect(dockerfile).toContain("ln -s /opt/may-agent-cli/node_modules/.bin/gemini /usr/local/bin/gemini");
    expect(dockerfile).not.toContain("-wrapper.sh");

    expect(entrypoint).toContain("/usr/sbin/groupmod --non-unique --gid");
    expect(entrypoint).toContain("/usr/sbin/usermod --non-unique --uid");
    expect(entrypoint).not.toContain("chown -R \"${runtime_user}:${runtime_user}\" \"${PROJECT_ROOT}\"");

    expect(supervisor).toContain("chown=mayagent:mayagent");
    expect(supervisor).toContain("[program:chrome]\nuser=mayagent");
    expect(nginx).toContain("error_log /tmp/may-agent-nginx-error.log warn;");
    expect(nginx).not.toContain("/dev/stderr");
    for (const program of ["terminal-herdr", "terminal-ttyd"]) {
      const start = supervisor.indexOf(`[program:${program}]`);
      expect(start).toBeGreaterThan(-1);
      expect(supervisor.slice(start, start + 300)).toContain("directory=/app");
    }
  });

  test("configures native CLI endpoints without persisting API keys and migrates legacy state + SSH safely", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-container-cfg-"));
    tempDirs.push(root);
    const home = join(root, "home");
    const stateDir = join(root, "state");

    // Pre-populate legacy /app/.state paths + existing ~/.ssh + corrupted Herdr/Codex configs
    mkdirSync(join(stateDir, ".ssh"), { recursive: true });
    mkdirSync(join(stateDir, ".codex/sessions"), { recursive: true });
    mkdirSync(join(stateDir, ".pi/agent/sessions"), { recursive: true });
    mkdirSync(join(home, ".ssh"), { recursive: true });
    mkdirSync(join(home, ".config/herdr"), { recursive: true });
    writeFileSync(join(stateDir, ".ssh/id_ed25519"), "ssh-ed25519 LEGACY_KEY\n", { mode: 0o600 });
    writeFileSync(join(home, ".ssh/known_hosts"), "github.com ssh-ed25519 AAAA\n", { mode: 0o600 });
    writeFileSync(join(stateDir, ".codex/sessions/s1.jsonl"), '{"id":"legacy-1"}\n');
    writeFileSync(join(stateDir, ".pi/agent/sessions/p1.jsonl"), '{"id":"legacy-pi"}\n');
    writeFileSync(join(home, ".config/herdr/config.toml"), "resume_agents_on_restore = false\n");

    await runConfigure({
      HOME: home,
      PROJECT_ROOT: "/workspace/app",
      STATE_DIR: stateDir,
      MODEL_BASE_URL: "https://models.example.test/",
      MODEL_API_KEY: "secret-key-must-not-persist",
      CODEX_MODEL: "gpt-custom",
      GEMINI_PRO_MODEL: "gemini-custom",
    });

    // SSH preserved from both legacy STATE_DIR/.ssh and existing ~/.ssh, and both are symlinks
    expect(lstatSync(join(home, ".ssh")).isSymbolicLink()).toBe(true);
    expect(lstatSync(join(stateDir, ".ssh")).isSymbolicLink()).toBe(true);
    expect(readFileSync(join(home, ".ssh/id_ed25519"), "utf8")).toBe("ssh-ed25519 LEGACY_KEY\n");
    expect(readFileSync(join(home, ".ssh/known_hosts"), "utf8")).toContain("github.com");

    // Appending to known_hosts survives a subsequent restart without false conflict failure
    writeFileSync(join(home, ".ssh/known_hosts"), "github.com ssh-ed25519 AAAA\ngitlab.com ssh-ed25519 BBBB\n", { mode: 0o600 });
    await runConfigure({
      HOME: home,
      PROJECT_ROOT: "/workspace/app",
      STATE_DIR: stateDir,
      MODEL_BASE_URL: "https://models.example.test/",
      MODEL_API_KEY: "secret-key-must-not-persist",
      CODEX_MODEL: "gpt-custom",
      GEMINI_PRO_MODEL: "gemini-custom",
    });
    expect(readFileSync(join(home, ".ssh/known_hosts"), "utf8")).toContain("gitlab.com");

    // Legacy CLI sessions migrated and symlinked; Herdr config repaired on restart
    expect(readFileSync(join(home, ".codex/sessions/s1.jsonl"), "utf8")).toBe('{"id":"legacy-1"}\n');
    expect(readFileSync(join(home, ".pi/agent/sessions/p1.jsonl"), "utf8")).toBe('{"id":"legacy-pi"}\n');
    expect(readFileSync(join(home, ".config/herdr/config.toml"), "utf8")).toBe("resume_agents_on_restore = true\n");

    // Native CLI configs contain normalized URLs, full permissions, and never persist MODEL_API_KEY
    const codexRaw = readFileSync(join(home, ".codex/config.toml"), "utf8");
    const piRaw = readFileSync(join(home, ".pi/agent/models.json"), "utf8");
    const piAuthRaw = readFileSync(join(home, ".pi/agent/auth.json"), "utf8");
    const geminiRaw = readFileSync(join(home, ".gemini/settings.json"), "utf8");
    const claudeRaw = readFileSync(join(home, ".claude/settings.json"), "utf8");
    for (const raw of [codexRaw, piRaw, piAuthRaw, geminiRaw, claudeRaw]) {
      expect(raw).not.toContain("secret-key-must-not-persist");
    }
    expect(Bun.TOML.parse(codexRaw)).toMatchObject({
      model: "gpt-custom",
      approval_policy: "never",
      sandbox_mode: "danger-full-access",
      features: { hooks: true },
      model_providers: { model_endpoint: { base_url: "https://models.example.test/v1", env_key: "MODEL_API_KEY" } },
    });
    expect(JSON.parse(piRaw).providers["may-google"].baseUrl).toBe("https://models.example.test/v1beta");
    const geminiParsed = JSON.parse(geminiRaw);
    expect(geminiParsed.model.name).toBe("gemini-custom");
    expect(geminiParsed.context).toMatchObject({
      includeDirectoryTree: false,
      loadMemoryFromIncludeDirectories: false,
      fileFiltering: {
        respectGitIgnore: true,
        respectGeminiIgnore: true,
        enableRecursiveFileSearch: false,
        enableFileWatcher: false,
      },
    });
    expect(JSON.parse(claudeRaw).permissions.defaultMode).toBe("bypassPermissions");

    // Conflicting SSH key material during initial migration fails closed instead of overwriting keys
    rmSync(join(stateDir, ".ssh"), { force: true });
    mkdirSync(join(stateDir, ".ssh"), { recursive: true });
    writeFileSync(join(stateDir, ".ssh/id_ed25519"), "ssh-ed25519 DIFFERENT_CONFLICTING_KEY\n", { mode: 0o600 });
    await expect(runConfigure({ HOME: home, STATE_DIR: stateDir })).rejects.toThrow();
  });
});
