import { describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { drainBashProcessGroup } from "../lib/tools/bash.js";
import { spawnFixtureProcess } from "../../test/fixtures/owned-process.js";
import { parseStandaloneCliArgs, runStandaloneCli } from "./standalone-cli.js";

describe("may run / may list standalone CLI", () => {
  test("parses `run` subcommand, duration units, --cwd, --out, and optional --app", () => {
    const parsed = parseStandaloneCliArgs([
      "run",
      "alex",
      "Summarize",
      "README.md",
      "--readonly",
      "--timeout=45s",
      "--cwd",
      "/tmp/work",
      "--out=/tmp/artifacts",
    ]);
    expect(parsed.command).toBe("run");
    expect(parsed.target).toBe("alex");
    expect(parsed.input).toBe("Summarize README.md");
    expect(parsed.options.app).toBeUndefined();
    expect(parsed.options.tools).toBe("readonly");
    expect(parsed.options.timeoutMs).toBe(45_000);
    expect(parsed.options.cwd).toBe("/tmp/work");
    expect(parsed.options.outputRoot).toBe("/tmp/artifacts");
    expect(parsed.needsStdin).toBe(false);
  });

  test("rejects missing option values instead of consuming subsequent flags like --readonly", () => {
    expect(() =>
      parseStandaloneCliArgs(["run", "reviewer", "Inspect", "--skill", "--readonly"]),
    ).toThrow("Option --skill requires a value");
    expect(() => parseStandaloneCliArgs(["run", "reviewer", "Inspect", "--timeout"])).toThrow(
      "Option --timeout requires a value",
    );
    expect(() => parseStandaloneCliArgs(["run", "reviewer", "Inspect", "--cwd="])).toThrow(
      "Option --cwd requires a value",
    );
  });

  test("does not read stdin when --help or explicit/positional input is provided", async () => {
    let stdinReads = 0;
    const readStdin = () => {
      stdinReads += 1;
      return "should-not-be-read";
    };

    const helpRes = await runStandaloneCli(["run", "--help"], {
      readStdin,
      stdout: () => undefined,
      stderr: () => undefined,
    });
    expect(helpRes.exitCode).toBe(0);
    expect(stdinReads).toBe(0);

    const explicitRes = await runStandaloneCli(["run", "reviewer", "Check HEAD", "--readonly"], {
      readStdin,
      stdout: () => undefined,
      stderr: () => undefined,
      execute: async (target, input, options) => ({
        ok: true,
        started: true,
        status: "done",
        result: {
          type: "done",
          summary: `${target}:${String(input)}:${options?.tools}`,
        },
        report: {} as any,
        childSessions: [],
      }),
    });
    expect(explicitRes.exitCode).toBe(0);
    expect(stdinReads).toBe(0);

    // Only reads stdin when no positional or --input payload was supplied:
    const pipedRes = await runStandaloneCli(["run", "alex/review-change", "--readonly"], {
      readStdin: () => {
        stdinReads += 1;
        return '{"subjectRef":"HEAD"}';
      },
      stdout: () => undefined,
      stderr: () => undefined,
      execute: async (_target, input) => {
        expect(input).toEqual({ subjectRef: "HEAD" });
        return {
          ok: true,
          started: true,
          status: "done",
          result: { type: "done", summary: "piped-ok" },
          report: {} as any,
          childSessions: [],
        };
      },
    });
    expect(pipedRes.exitCode).toBe(0);
    expect(stdinReads).toBe(1);
  });

  test("supports `list` subcommand in human and --json formats without reading stdin", async () => {
    const out: string[] = [];
    const listRes = await runStandaloneCli(["list"], {
      readStdin: () => {
        throw new Error("list must not read stdin");
      },
      stdout: (line) => out.push(line),
      listTargets: () => [
        { target: "alex", kind: "prompt", owner: "alex", app: "alex.app", description: "Alex lead" },
        {
          target: "tech-lead/verified-coder",
          kind: "code",
          owner: "tech-lead",
          app: "alex.app",
          description: "Code procedure (verified-coder.ts)",
        },
      ],
    });
    expect(listRes.exitCode).toBe(0);
    expect(out.some((l) => l.includes("alex") && l.includes("[alex.app]"))).toBe(true);
    expect(out.some((l) => l.includes("tech-lead/verified-coder"))).toBe(true);
  });

  test("invokes run(target, input, options) and formats human & JSON output", async () => {
    const out: string[] = [];
    const err: string[] = [];

    const res = await runStandaloneCli(["run", "reviewer", "Check diff", "--readonly"], {
      stdout: (line) => out.push(line),
      stderr: (line) => err.push(line),
      execute: async (target, input, options) => ({
        ok: true,
        started: true,
        status: "done",
        result: {
          type: "done",
          summary: `Ran ${target}: ${String(input)} (${options?.tools ?? "full"})`,
          output: { verdict: "pass" },
        },
        report: {} as any,
        childSessions: [],
      }),
    });

    expect(res.exitCode).toBe(0);
    expect(err).toHaveLength(0);
    expect(out[0]).toBe("[done] Ran reviewer: Check diff (readonly)");
    expect(JSON.parse(out[1]!)).toEqual({ verdict: "pass" });
  });

  test("src/app/may.ts has a valid #!/usr/bin/env bun shebang for direct bin invocation and forwards SIGINT to drain child process groups", async () => {
    const mayEntry = resolve(import.meta.dir, "may.ts");
    const firstLine = readFileSync(mayEntry, "utf8").split("\n")[0];
    expect(firstLine).toBe("#!/usr/bin/env bun");

    // 1. Direct bin invocation via executable symlink:
    const tempDir = mkdtempSync(join(tmpdir(), "may-bin-test-"));
    let child: ReturnType<typeof spawnFixtureProcess> | undefined;
    let spawnedCodexPid = 0;
    try {
      chmodSync(mayEntry, 0o755);
      const helpProc = Bun.spawn([mayEntry, "run", "--help"], {
        stdout: "pipe",
        stderr: "pipe",
      });
      const exitCode = await helpProc.exited;
      const stdout = await new Response(helpProc.stdout).text();
      expect(exitCode).toBe(0);
      expect(stdout).toContain("may run <target>");

      // 2. Subprocess regression: interrupting `may run codex ...` with SIGINT aborts execution and drains its native child process group:
      const fakeBinDir = join(tempDir, "bin");
      const workDir = join(tempDir, "work");
      const pidFile = join(tempDir, "codex-child.pid");
      mkdirSync(fakeBinDir, { recursive: true });
      mkdirSync(workDir, { recursive: true });
      const fakeCodexPath = join(fakeBinDir, "codex");
      writeFileSync(
        fakeCodexPath,
        `#!/usr/bin/env node
const { writeFileSync } = require("node:fs");
writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));
setInterval(() => {}, 1000);
`,
      );
      chmodSync(fakeCodexPath, 0o755);

      child = spawnFixtureProcess([mayEntry, "run", "codex", "Long task", "--cwd", workDir], {
        env: {
          ...process.env,
          PATH: `${fakeBinDir}:${process.env.PATH ?? ""}`,
        },
      });

      const deadline = Date.now() + 5_000;
      while (Date.now() < deadline) {
        try {
          const raw = readFileSync(pidFile, "utf8").trim();
          if (raw) {
            spawnedCodexPid = Number(raw);
            break;
          }
        } catch {
          // Wait for fake codex to write its PID.
        }
        await new Promise((r) => setTimeout(r, 25));
      }
      expect(spawnedCodexPid).toBeGreaterThan(0);

      // Send SIGINT to `may` CLI process and wait with a bounded timeout:
      child.kill("SIGINT");
      await Promise.race([
        new Promise<void>((resolveExit) => {
          if (child?.exitCode !== null || child?.signalCode !== null) {
            resolveExit();
            return;
          }
          child.once("close", () => resolveExit());
        }),
        new Promise<never>((_, rejectTimeout) =>
          setTimeout(() => rejectTimeout(new Error("Timed out waiting for may CLI to exit after SIGINT")), 5_000),
        ),
      ]);

      // Verify the detached codex child process group was drained:
      let codexStillAlive = true;
      try {
        process.kill(spawnedCodexPid, 0);
      } catch {
        codexStillAlive = false;
      }
      expect(codexStillAlive).toBe(false);
    } finally {
      if (child && child.exitCode === null && child.signalCode === null) {
        try {
          child.stdin?.end();
          child.kill("SIGKILL");
        } catch {
          // Ignore already exited child.
        }
        await Promise.race([
          new Promise<void>((resolveExit) => child!.once("close", () => resolveExit())),
          new Promise<void>((resolveTimeout) => setTimeout(resolveTimeout, 1_000)),
        ]);
      }
      if (spawnedCodexPid > 0) {
        await drainBashProcessGroup(spawnedCodexPid);
      }
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
