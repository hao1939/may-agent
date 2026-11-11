import { afterEach, describe, expect, test } from "bun:test";
import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const setupScript = resolve(import.meta.dirname, "../../container/setup-codex-config.sh");
const execute = promisify(execFile);
const tempDirs: string[] = [];
const projectRoot = "/workspace/example";
const syntheticKey = "fixture-model-api-key";

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function isolatedHome(): string {
  const home = mkdtempSync(join(tmpdir(), "may-codex-config-"));
  tempDirs.push(home);
  return home;
}

async function configure(home: string, overrides: Record<string, string> = {}) {
  await execute("bash", [setupScript], {
    env: {
      PATH: process.env.PATH,
      HOME: home,
      CODEX_HOME: home,
      PROJECT_ROOT: projectRoot,
      MODEL_API_KEY: syntheticKey,
      ...overrides,
    },
    timeout: 5_000,
    killSignal: "SIGKILL",
    maxBuffer: 128 * 1024,
  });
  const source = readFileSync(join(home, "config.toml"), "utf8");
  expect(source).not.toContain(syntheticKey);
  return Bun.TOML.parse(source);
}

const managedSettings = {
  model_provider: "model_endpoint",
  personality: "pragmatic",
  check_for_update_on_startup: false,
  approval_policy: "never",
  sandbox_mode: "danger-full-access",
  projects: { [projectRoot]: { trust_level: "trusted" } },
};

function provider(baseUrl: string) {
  return {
    model_endpoint: {
      name: "Configured model endpoint",
      base_url: baseUrl,
      env_key: "MODEL_API_KEY",
      wire_api: "responses",
    },
  };
}

describe("Codex startup configuration", () => {
  test("writes usable default model, endpoint and execution settings", async () => {
    expect(await configure(isolatedHome())).toEqual({
      ...managedSettings,
      model: "gpt-5.6-sol",
      model_reasoning_effort: "high",
      model_providers: provider("http://host.docker.internal:4000/v1"),
    });
  });

  test("refreshes overrides and normalizes endpoints while preserving trusted hooks across replay", async () => {
    const home = isolatedHome();
    const hook = "/workspace/example/hooks.json:session_start:0:0";
    writeFileSync(join(home, "config.toml"), [
      'model = "old-model"',
      "[hooks.state]",
      `[hooks.state.${JSON.stringify(hook)}]`,
      'trusted_hash = "sha256:trusted-definition"',
      "[mcp_servers.unrelated]",
      'command = "do-not-copy"',
    ].join("\n"));

    for (const endpoint of ["https://model.example.test/", "https://model.example.test/v1/"]) {
      expect(await configure(home, {
        CODEX_MODEL: "fixture-model",
        CODEX_REASONING_EFFORT: "medium",
        MODEL_BASE_URL: endpoint,
      })).toEqual({
        ...managedSettings,
        model: "fixture-model",
        model_reasoning_effort: "medium",
        model_providers: provider("https://model.example.test/v1"),
        hooks: { state: { [hook]: { trusted_hash: "sha256:trusted-definition" } } },
      });
    }
  });
});
