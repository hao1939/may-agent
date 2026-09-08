import { describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFile, spawnSync } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const ENTRYPOINT = resolve(import.meta.dir, "may.ts");
const PACKAGE_IDENTITY = JSON.parse(readFileSync(resolve(import.meta.dir, "../../package.json"), "utf8")) as {
  name: string;
  version: string;
};

describe("may CLI help", () => {
  it("exits successfully without starting recovery or mutating state", () => {
    const stateDir = mkdtempSync(join(tmpdir(), "may-help-state-"));
    const markerPath = join(stateDir, "existing-state.txt");
    writeFileSync(markerPath, "unchanged\n");

    try {
      const result = spawnSync(process.execPath, [ENTRYPOINT, "--help"], {
        cwd: resolve(import.meta.dir, "../.."),
        env: { ...process.env, STATE_DIR: stateDir },
        encoding: "utf8",
        timeout: 10_000,
      });

      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Usage: may-agent [options]");
      expect(result.stderr).not.toContain("handler-recovery");
      expect(result.stderr).not.toContain("workflow-recovery");
      expect(readdirSync(stateDir)).toEqual(["existing-state.txt"]);
      expect(readFileSync(markerPath, "utf8")).toBe("unchanged\n");
    } finally {
      rmSync(stateDir, { recursive: true, force: true });
    }
  });

  it("prints package identity without starting runtime state", () => {
    const stateDir = mkdtempSync(join(tmpdir(), "may-version-state-"));
    try {
      const result = spawnSync(process.execPath, [ENTRYPOINT, "--version"], {
        cwd: resolve(import.meta.dir, "../.."),
        env: { ...process.env, STATE_DIR: stateDir },
        encoding: "utf8",
        timeout: 10_000,
      });

      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
      expect(result.stdout).toMatch(
        new RegExp(`^${PACKAGE_IDENTITY.name} v${PACKAGE_IDENTITY.version.replaceAll(".", "\\.")} \\([0-9a-f]+\\)\\n$`),
      );
      expect(readdirSync(stateDir)).toEqual([]);
    } finally {
      rmSync(stateDir, { recursive: true, force: true });
    }
  });

  it.each(["release", "standalone"])("embeds package identity in the %s binary", async (mode) => {
    const root = mkdtempSync(join(tmpdir(), "may-version-bundle-"));
    const binary = join(root, "may-agent");
    const buildCommit = "a".repeat(40);
    try {
      await execFileAsync(
        process.execPath,
        mode === "release"
          ? [resolve(import.meta.dir, "../../scripts/build-runtime-binary.ts"), "--outfile", binary]
          : [
              "build",
              "--compile",
              "src/app/binary-entry.ts",
              "--outfile",
              binary,
              "--define",
              `__MAY_AGENT_BUILD_COMMIT__=${JSON.stringify(buildCommit)}`,
            ],
        {
          cwd: resolve(import.meta.dir, "../.."),
          env: { ...process.env, MAY_AGENT_BUILD_COMMIT: buildCommit },
          encoding: "utf8",
          timeout: 30_000,
        },
      );
      // A standalone binary must not read a manifest from its launch directory.
      writeFileSync(join(root, "package.json"), JSON.stringify({ name: "unrelated-app", version: "99.0.0" }));
      const result = await execFileAsync(binary, ["--version"], {
        cwd: root,
        env: { ...process.env, STATE_DIR: join(root, "state") },
        encoding: "utf8",
        timeout: 10_000,
      });
      expect(result.stdout).toBe(`${PACKAGE_IDENTITY.name} v${PACKAGE_IDENTITY.version} (aaaaaaaa)\n`);

      const help = await execFileAsync(binary, ["--help"], {
        cwd: root,
        env: { ...process.env, STATE_DIR: join(root, "state") },
        encoding: "utf8",
        timeout: 10_000,
      });
      expect(help.stdout).toContain("Usage: may-agent [options]");
      expect(existsSync(join(root, "state"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps a running instance identity unchanged for --status", () => {
    const stateDir = mkdtempSync(join(tmpdir(), "may-status-state-"));
    const instanceDir = join(stateDir, "instances", "background");
    mkdirSync(instanceDir, { recursive: true });
    const identityPath = join(instanceDir, "identity.json");
    const runningIdentity = JSON.stringify({ pid: 42, status: "running", instance: "background" });
    writeFileSync(identityPath, runningIdentity);

    try {
      const result = spawnSync(process.execPath, [ENTRYPOINT, "--status"], {
        cwd: resolve(import.meta.dir, "../.."),
        env: { ...process.env, STATE_DIR: stateDir, INSTANCE: "background" },
        encoding: "utf8",
        timeout: 10_000,
      });

      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
      expect(readFileSync(identityPath, "utf8")).toBe(runningIdentity);
    } finally {
      rmSync(stateDir, { recursive: true, force: true });
    }
  });
});
