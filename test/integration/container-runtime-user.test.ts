import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "../..");
const read = (path: string) => readFileSync(resolve(repoRoot, path), "utf8");

describe("container runtime identity and working directory", () => {
  test("matches the runtime user to mounted ownership before configuring agents", () => {
    const entrypoint = read("container/entrypoint.sh");
    const runtimeSetup = entrypoint.indexOf("source /usr/local/bin/setup-runtime-user.sh");

    expect(runtimeSetup).toBeGreaterThan(-1);
    expect(runtimeSetup).toBeLessThan(entrypoint.indexOf("source /usr/local/bin/setup-codex-config.sh"));
    expect(runtimeSetup).toBeLessThan(entrypoint.indexOf("source /usr/local/bin/setup-pi-config.sh"));
    expect(runtimeSetup).toBeLessThan(entrypoint.indexOf("source /usr/local/bin/setup-gemini-config.sh"));

    const source = read("container/setup-runtime-user.sh");
    expect(source).toContain('ownership_path="${MAY_RUNTIME_OWNERSHIP_PATH:-${projects_root}}"');
    expect(source).toContain("groupmod --non-unique --gid");
    expect(source).toContain("usermod --non-unique --uid");
    expect(source).toContain("cannot use ${path}");
    expect(source).not.toContain("chown -R \"${runtime_user}:${runtime_user}\" \"${project_root}\"");
  });

  test("keeps image, supervisor and terminal sessions rooted at /app", () => {
    const dockerfile = read("container/Dockerfile");
    const supervisor = read("container/supervisord.conf");
    const nginx = read("container/may-agent-nginx.conf");

    expect(dockerfile).toContain("WORKDIR /app");
    expect(supervisor).toContain("chown=mayagent:mayagent");
    expect(nginx).toContain("error_log /tmp/may-agent-nginx-error.log warn;");
    expect(nginx).not.toContain("/dev/stderr");
    for (const program of ["terminal-herdr", "terminal-ttyd"]) {
      const start = supervisor.indexOf(`[program:${program}]`);
      expect(start).toBeGreaterThan(-1);
      expect(supervisor.slice(start, start + 300)).toContain("directory=/app");
    }
  });
});
