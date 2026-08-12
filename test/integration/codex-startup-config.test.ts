import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(import.meta.dirname, "../..");
const setupScript = resolve(repoRoot, "container/setup-codex-config.sh");
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("Codex startup configuration", () => {
  test("defaults Codex to GPT-5.6 Sol with high reasoning", () => {
    const source = readFileSync(resolve(repoRoot, "container/setup-codex-config.sh"), "utf8");

    expect(source).toContain('codex_model="${CODEX_MODEL:-gpt-5.6-sol}"');
    expect(source).toContain('codex_reasoning_effort="${CODEX_REASONING_EFFORT:-high}"');
    expect(source).toContain('model = "${codex_model}"');
    expect(source).toContain('model_reasoning_effort = "${codex_reasoning_effort}"');
  });

  test("uses the supported setting to disable startup update checks", () => {
    const source = readFileSync(resolve(repoRoot, "container/setup-codex-config.sh"), "utf8");

    expect(source).toContain("check_for_update_on_startup = false");
    expect(source).toContain('export MODEL_BASE_URL="${MODEL_BASE_URL:-http://host.docker.internal:4000}"');
    expect(source).not.toContain("CODEX_BASE_URL");
    expect(source).not.toMatch(/^update_on_startup\s*=/m);
  });

  test("persists unrestricted execution for plain and resumed Codex sessions", () => {
    const source = readFileSync(resolve(repoRoot, "container/setup-codex-config.sh"), "utf8");

    expect(source).toContain('approval_policy = "never"');
    expect(source).toContain('sandbox_mode = "danger-full-access"');
  });

  test("preserves trusted hook hashes while refreshing managed settings", () => {
    const home = mkdtempSync(join(tmpdir(), "may-codex-config-"));
    tempDirs.push(home);
    const configPath = join(home, "config.toml");
    const trustedHookState = [
      "[hooks.state]",
      "",
      '[hooks.state.\"/app/.state/.codex/hooks.json:session_start:0:0\"]',
      'trusted_hash = "sha256:trusted-definition"',
    ].join("\n");
    writeFileSync(configPath, [
      'model = "old-model"',
      "",
      trustedHookState,
      "",
      "[mcp_servers.unrelated]",
      'command = "do-not-copy"',
      "",
    ].join("\n"));

    for (let run = 0; run < 2; run += 1) {
      const result = spawnSync("bash", [setupScript], {
        env: {
          ...process.env,
          CODEX_HOME: home,
          CODEX_MODEL: "new-model",
          PROJECT_ROOT: "/app",
        },
        encoding: "utf8",
      });
      expect(result.status).toBe(0);
    }

    const config = readFileSync(configPath, "utf8");
    expect(config).toContain('model = "new-model"');
    expect(config.match(/\[hooks\.state\]/g)).toHaveLength(1);
    expect(config).toContain(trustedHookState);
    expect(config).not.toContain("mcp_servers.unrelated");
  });
});
