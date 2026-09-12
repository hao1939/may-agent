import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const repoRoot = resolve(import.meta.dirname, "../..");
const setupScript = resolve(repoRoot, "container/setup-pi-config.sh");
const exec = promisify(execFile);
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("Pi startup configuration", () => {
  test("repairs the persistent Pi root and immediate runtime state", () => {
    const source = readFileSync(setupScript, "utf8");

    expect(source).toContain('pi_state_root="$(dirname "${PI_CODING_AGENT_DIR}")"');
    expect(source).toContain('chown mayagent:mayagent "${pi_state_root}" "${PI_CODING_AGENT_DIR}"');
    expect(source).toContain('find "${PI_CODING_AGENT_DIR}" -mindepth 1 -maxdepth 1');
  });

  test("writes both configured providers without persisting the API key", async () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "may-pi-config-"));
    tempDirs.push(fixtureRoot);
    // Keep the test runner responsive if a startup subprocess stalls; inherited
    // Pi configuration must not redirect this fixture into an installation.
    await exec("bash", [setupScript], {
      timeout: 10_000,
      env: {
        PATH: process.env.PATH,
        HOME: fixtureRoot,
        MODEL_BASE_URL: "https://models.example.test/",
        MODEL_API_KEY: "must-not-be-persisted",
        CODEX_MODEL: "gpt-test",
        CLAUDE_MODEL: "claude-test",
      },
      encoding: "utf8",
    });

    const source = readFileSync(join(fixtureRoot, ".pi/agent/models.json"), "utf8");
    const config = JSON.parse(source);
    expect(config.providers["may-openai"]).toEqual({
      baseUrl: "https://models.example.test/v1",
      api: "openai-responses",
      apiKey: "$MODEL_API_KEY",
      models: [{
        id: "gpt-test",
        name: "gpt-test",
        reasoning: true,
        input: ["text", "image"],
        contextWindow: 400000,
        maxTokens: 128000,
      }],
    });
    expect(config.providers["may-anthropic"]).toEqual({
      baseUrl: "https://models.example.test",
      api: "anthropic-messages",
      apiKey: "$MODEL_API_KEY",
      models: [{
        id: "claude-test",
        name: "claude-test",
        reasoning: true,
        input: ["text", "image"],
        contextWindow: 200000,
        maxTokens: 128000,
        compat: { forceAdaptiveThinking: true },
      }],
    });
    expect(source).not.toContain("must-not-be-persisted");

    expect(JSON.parse(readFileSync(join(fixtureRoot, ".pi/agent/settings.json"), "utf8"))).toEqual({
      defaultProvider: "may-openai",
      defaultModel: "gpt-test",
      defaultThinkingLevel: "high",
    });
  });

  test("allows a dedicated persistent Pi configuration directory", async () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "may-pi-config-"));
    const configDir = join(fixtureRoot, "persistent-pi");
    tempDirs.push(fixtureRoot);
    await exec("bash", [setupScript], {
      timeout: 10_000,
      env: { PATH: process.env.PATH, HOME: fixtureRoot, PI_CODING_AGENT_DIR: configDir },
      encoding: "utf8",
    });

    expect(JSON.parse(readFileSync(join(configDir, "models.json"), "utf8")))
      .toHaveProperty("providers.may-openai.models.0.id", "gpt-5.6-sol");
  });

  test("preserves existing Pi preferences while filling missing defaults", async () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "may-pi-config-"));
    const configDir = join(fixtureRoot, ".pi/agent");
    tempDirs.push(fixtureRoot);
    mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, "settings.json"), JSON.stringify({
      defaultProvider: "may-anthropic",
      defaultModel: "claude-custom",
      theme: "light",
    }));

    await exec("bash", [setupScript], {
      timeout: 10_000,
      env: { PATH: process.env.PATH, HOME: fixtureRoot },
      encoding: "utf8",
    });
    expect(JSON.parse(readFileSync(join(configDir, "settings.json"), "utf8"))).toEqual({
      defaultProvider: "may-anthropic",
      defaultModel: "claude-custom",
      theme: "light",
      defaultThinkingLevel: "high",
    });
  });
});
