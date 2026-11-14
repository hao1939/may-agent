import { describe, expect, test } from "bun:test";
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
});
