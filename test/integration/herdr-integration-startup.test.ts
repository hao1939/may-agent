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

function runSetup() {
  const home = mkdtempSync(join(tmpdir(), "may-herdr-integration-"));
  tempDirs.push(home);
  const binDir = join(home, "bin");
  const callsPath = join(home, "herdr-calls.log");
  const herdrStub = join(binDir, "herdr-stub");
  mkdirSync(binDir, { recursive: true });
  writeFileSync(herdrStub, "#!/bin/sh\nprintf '%s\\n' \"$*\" >> \"$HERDR_CALLS_PATH\"\n");
  chmodSync(herdrStub, 0o755);

  const result = spawnSync("bash", [setupScript], {
    env: {
      ...process.env,
      HOME: home,
      PI_CODING_AGENT_DIR: join(home, ".pi/agent"),
      HERDR_BIN: herdrStub,
      HERDR_CALLS_PATH: callsPath,
    },
    encoding: "utf8",
  });

  return { result, callsPath };
}

describe("Herdr integration startup configuration", () => {
  test("installs all supported terminal agent integrations", () => {
    const { result, callsPath } = runSetup();

    expect(result.status).toBe(0);
    expect(readFileSync(callsPath, "utf8").trim().split("\n")).toEqual([
      "integration install codex",
      "integration install claude",
      "integration install pi",
    ]);
  });

  test("runs after agent config setup in the container entrypoint", () => {
    const entrypoint = readFileSync(resolve(repoRoot, "container/entrypoint.sh"), "utf8");
    const integrationOffset = entrypoint.indexOf("/usr/local/bin/setup-herdr-integrations.sh");

    expect(integrationOffset).toBeGreaterThan(entrypoint.indexOf("source /usr/local/bin/setup-codex-config.sh"));
    expect(integrationOffset).toBeGreaterThan(entrypoint.indexOf("source /usr/local/bin/setup-claude-config.sh"));
    expect(integrationOffset).toBeGreaterThan(entrypoint.indexOf("source /usr/local/bin/setup-pi-config.sh"));
    expect(entrypoint).toContain("runuser -u mayagent");
    expect(entrypoint).not.toContain("herdr-agent-state");
  });

  test("uses Bash and asserts the pinned Herdr restoration default in the image", () => {
    const dockerfile = readFileSync(resolve(repoRoot, "container/Dockerfile"), "utf8");

    expect(dockerfile).toContain("ENV SHELL=/bin/bash");
    expect(dockerfile).toContain("COPY container/may-herdr.sh /usr/local/bin/may-herdr");
    expect(dockerfile).toContain("herdr --default-config | grep -q '^# resume_agents_on_restore = true$'");
  });
});
