import { afterEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(import.meta.dirname, "../..");
const setupScript = resolve(repoRoot, "container/setup-herdr-integrations.sh");
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function runSetup(existingConfig = "onboarding = false\n") {
  const home = mkdtempSync(join(tmpdir(), "may-herdr-integration-"));
  tempDirs.push(home);
  const binDir = join(home, "bin");
  const configHome = join(home, "herdr-config");
  const configPath = join(configHome, "herdr", "config.toml");
  const callsPath = join(home, "herdr-calls.log");
  const herdrStub = join(binDir, "herdr-stub");
  mkdirSync(binDir, { recursive: true });
  mkdirSync(join(configHome, "herdr"), { recursive: true });
  writeFileSync(configPath, existingConfig);
  writeFileSync(herdrStub, "#!/bin/sh\nprintf '%s\\n' \"$*\" >> \"$HERDR_CALLS_PATH\"\n");
  chmodSync(herdrStub, 0o755);

  const result = spawnSync("bash", [setupScript], {
    env: {
      ...process.env,
      HOME: home,
      XDG_CONFIG_HOME: configHome,
      XDG_STATE_HOME: join(home, "herdr-state"),
      XDG_RUNTIME_DIR: join(home, "herdr-runtime"),
      PI_CODING_AGENT_DIR: join(home, ".pi/agent"),
      HERDR_BIN: herdrStub,
      HERDR_CALLS_PATH: callsPath,
    },
    encoding: "utf8",
  });

  return { result, configPath, callsPath };
}

describe("Herdr integration startup configuration", () => {
  test("installs all supported terminal agents and enables native session restoration", () => {
    const { result, configPath, callsPath } = runSetup();

    expect(result.status).toBe(0);
    expect(readFileSync(callsPath, "utf8").trim().split("\n")).toEqual([
      "integration install codex",
      "integration install claude",
      "integration install pi",
    ]);
    expect(readFileSync(configPath, "utf8")).toBe([
      "onboarding = false",
      "",
      "[terminal]",
      'default_shell = "/bin/bash"',
      "",
      "[session]",
      "resume_agents_on_restore = true",
      "",
    ].join("\n"));
  });

  test("updates the restore policy without duplicating its section or changing other settings", () => {
    const existing = [
      "onboarding = false",
      "",
      "[session]",
      "resume_agents_on_restore = false",
      "",
      "[ui]",
      "mouse_capture = true",
      "",
    ].join("\n");
    const first = runSetup(existing);

    expect(first.result.status).toBe(0);
    const updated = readFileSync(first.configPath, "utf8");
    expect(updated).toContain("[session]\nresume_agents_on_restore = true");
    expect(updated).toContain("[ui]\nmouse_capture = true");
    expect(updated).toContain('[terminal]\ndefault_shell = "/bin/bash"');
  });

  test("runs after agent config setup in the container entrypoint", () => {
    const entrypoint = readFileSync(resolve(repoRoot, "container/entrypoint.sh"), "utf8");
    const integrationOffset = entrypoint.indexOf("/usr/local/bin/setup-herdr-integrations.sh");

    expect(integrationOffset).toBeGreaterThan(entrypoint.indexOf("source /usr/local/bin/setup-codex-config.sh"));
    expect(integrationOffset).toBeGreaterThan(entrypoint.indexOf("source /usr/local/bin/setup-claude-config.sh"));
    expect(integrationOffset).toBeGreaterThan(entrypoint.indexOf("source /usr/local/bin/setup-pi-config.sh"));
    expect(entrypoint).toContain("runuser -u mayagent");
    expect(entrypoint).toContain('"${PI_CODING_AGENT_DIR}/extensions/herdr-agent-state.ts"');
    expect(entrypoint).not.toContain('chown -R mayagent:mayagent "${HOME}/.codex"');
    expect(entrypoint).not.toContain('chown -R mayagent:mayagent "${HOME}/.claude"');
  });
});
