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

describe("Herdr integration startup configuration", () => {
  test("installs all supported terminal agent integrations including Gemini session hook", () => {
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
        PROJECT_ROOT: "/app",
        PI_CODING_AGENT_DIR: join(home, ".pi/agent"),
        HERDR_BIN: herdrStub,
        HERDR_CALLS_PATH: callsPath,
      },
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(readFileSync(callsPath, "utf8").trim().split("\n")).toEqual([
      "integration install codex",
      "integration install claude",
      "integration install pi",
    ]);
    const geminiSettings = JSON.parse(readFileSync(join(home, ".gemini/settings.json"), "utf8"));
    expect(geminiSettings.hooks?.SessionStart?.[0]?.hooks?.[0]?.name).toBe("herdr-gemini-session");
    expect(geminiSettings.hooks?.BeforeAgent?.[0]?.hooks?.[0]?.name).toBe("herdr-gemini-working");
    expect(geminiSettings.hooks?.AfterAgent?.[0]?.hooks?.[0]?.name).toBe("herdr-gemini-idle");
    expect(geminiSettings.hooks?.Notification?.[0]?.hooks?.[0]?.name).toBe("herdr-gemini-blocked");
    expect(geminiSettings.hooks?.SessionEnd?.[0]?.hooks?.[0]?.name).toBe("herdr-gemini-end");
    const trustedHooks = JSON.parse(readFileSync(join(home, ".gemini/trusted_hooks.json"), "utf8"));
    expect(trustedHooks["/app"]?.length).toBeGreaterThanOrEqual(5);
  });

  test("runs after agent config setup in the container entrypoint", () => {
    const entrypoint = readFileSync(resolve(repoRoot, "container/entrypoint.sh"), "utf8");
    const integrationOffset = entrypoint.indexOf("/usr/local/bin/setup-herdr-integrations.sh");

    expect(integrationOffset).toBeGreaterThan(entrypoint.indexOf("source /usr/local/bin/setup-codex-config.sh"));
    expect(integrationOffset).toBeGreaterThan(entrypoint.indexOf("source /usr/local/bin/setup-claude-config.sh"));
    expect(integrationOffset).toBeGreaterThan(entrypoint.indexOf("source /usr/local/bin/setup-pi-config.sh"));
    expect(integrationOffset).toBeGreaterThan(entrypoint.indexOf("source /usr/local/bin/setup-gemini-config.sh"));
    expect(entrypoint).toContain("/usr/sbin/runuser -u mayagent");
    expect(entrypoint).not.toContain("herdr-agent-state");
  });

  test("uses Bash and asserts the pinned Herdr restoration default in the image", () => {
    const dockerfile = readFileSync(resolve(repoRoot, "container/Dockerfile"), "utf8");

    expect(dockerfile).toContain("ENV SHELL=/bin/bash");
    expect(dockerfile).toContain("COPY container/may-herdr.sh /usr/local/bin/may-herdr");
    expect(dockerfile).toContain("herdr --default-config | grep -q '^# resume_agents_on_restore = true$'");
  });

  test("preserves symlinked session histories in STATE_DIR while regenerating tampered CLI configs on restart", () => {
    const root = mkdtempSync(join(tmpdir(), "may-restart-persistence-"));
    tempDirs.push(root);
    const stateDir = join(root, ".state");
    const home1 = join(root, "home-run1");
    const home2 = join(root, "home-run2");
    mkdirSync(join(stateDir, "cli-state/codex/sessions"), { recursive: true });
    mkdirSync(join(stateDir, "cli-state/pi/sessions"), { recursive: true });
    mkdirSync(join(stateDir, "cli-state/gemini/history"), { recursive: true });
    mkdirSync(join(stateDir, "cli-state/gemini/tmp"), { recursive: true });

    const runConfigSetup = (home: string) => {
      for (const script of [
        "container/setup-codex-config.sh",
        "container/setup-pi-config.sh",
        "container/setup-gemini-config.sh",
      ]) {
        const res = spawnSync("bash", [resolve(repoRoot, script)], {
          env: {
            ...process.env,
            HOME: home,
            STATE_DIR: stateDir,
            PI_CODING_AGENT_DIR: join(home, ".pi/agent"),
            MODEL_BASE_URL: "http://host.docker.internal:4000",
          },
          encoding: "utf8",
        });
        expect(res.status).toBe(0);
      }
    };

    // Container Start #1: write session data through symlinks AND tamper with configs
    runConfigSetup(home1);
    writeFileSync(join(home1, ".codex/sessions/s1.jsonl"), '{"id":"codex-1"}\n');
    writeFileSync(join(home1, ".pi/agent/sessions/p1.jsonl"), '{"id":"pi-1"}\n');
    writeFileSync(join(home1, ".gemini/history/g1.json"), '{"id":"gemini-1"}\n');
    writeFileSync(join(home1, ".codex/config.toml"), "broken = true\n");
    writeFileSync(join(home1, ".pi/agent/models.json"), "{corrupted");
    writeFileSync(join(home1, ".gemini/settings.json"), "{corrupted");

    // Simulated Container Recreate/Restart (#2 with fresh ephemeral HOME, same STATE_DIR):
    runConfigSetup(home2);
    expect(readFileSync(join(home2, ".codex/sessions/s1.jsonl"), "utf8")).toBe('{"id":"codex-1"}\n');
    expect(readFileSync(join(home2, ".pi/agent/sessions/p1.jsonl"), "utf8")).toBe('{"id":"pi-1"}\n');
    expect(readFileSync(join(home2, ".gemini/history/g1.json"), "utf8")).toBe('{"id":"gemini-1"}\n');
    expect(readFileSync(join(home2, ".codex/config.toml"), "utf8")).toContain('model = "gpt-6.1-sol"');
    expect(JSON.parse(readFileSync(join(home2, ".pi/agent/models.json"), "utf8")).providers["may-google"]).toBeDefined();
    expect(JSON.parse(readFileSync(join(home2, ".gemini/settings.json"), "utf8")).model.name).toBe("gemini-4-argon");
  });
});
