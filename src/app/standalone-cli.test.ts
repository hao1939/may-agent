import { describe, expect, test } from "bun:test";
import { chmodSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
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

    expect(() =>
      parseStandaloneCliArgs(["run", "alex/develop-change", '{"requirement":"Fix bug"}', "--task", "legacy"]),
    ).toThrow("Unknown flag: --task");
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
        { name: "alex/alex", description: "Alex lead", inputSchema: {} as any },
        {
          name: "alex/verified-coder",
          description: "Code procedure (verified-coder.ts)",
          inputSchema: {} as any,
        },
      ],
    });
    expect(listRes.exitCode).toBe(0);
    expect(out.some((l) => l.includes("alex/alex") && l.includes("Alex lead"))).toBe(true);
    expect(out.some((l) => l.includes("alex/verified-coder"))).toBe(true);
  });

  test("invokes run(target, input, options) and formats human & JSON output", async () => {
    const out: string[] = [];
    const err: string[] = [];

    const res = await runStandaloneCli(["run", "reviewer", "Check diff", "--readonly"], {
      stdout: (line) => out.push(line),
      stderr: (line) => err.push(line),
      execute: async (target, input, options) => ({
        id: "wr_cli_fixture",
        status: "done",
        summary: `Ran ${target}: ${String(input)} (${options?.tools ?? "full"})`,
        output: { verdict: "pass" },
      }),
    });

    expect(res.exitCode).toBe(0);
    expect(err).toHaveLength(0);
    expect(out[0]).toBe("[done] Ran reviewer: Check diff (readonly)");
    expect(JSON.parse(out[1]!)).toEqual({ verdict: "pass" });
  });

  test("src/app/may.ts has a valid #!/usr/bin/env bun shebang for direct bin invocation", async () => {
    const mayEntry = resolve(import.meta.dir, "may.ts");
    const firstLine = readFileSync(mayEntry, "utf8").split("\n")[0];
    expect(firstLine).toBe("#!/usr/bin/env bun");

    chmodSync(mayEntry, 0o755);
    const helpProc = Bun.spawn([mayEntry, "run", "--help"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await helpProc.exited;
    const stdout = await new Response(helpProc.stdout).text();
    expect(exitCode).toBe(0);
    expect(stdout).toContain("may run <target>");
  });

  test("executes unified WorkflowContext standalone, parks on ctx.ask, and resumes fresh attempt with --resume --answer", async () => {
    const { mkdtempSync, mkdirSync, rmSync, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { run } = await import("@may-agent/sdk/standalone");
    const { mockModel } = await import("@may-agent/sdk/testing");

    const wsRoot = mkdtempSync(join(tmpdir(), "unified-ctx-e2e-"));
    const stateDir = join(wsRoot, "state");
    try {
      mkdirSync(join(wsRoot, "shared"), { recursive: true });
      writeFileSync(join(wsRoot, "shared", "common-sense.md"), "Shared rules\n");
      const wfDir = join(wsRoot, "projects", "demo.app", "agents", "lead", "workflows");
      const helperDir = join(wsRoot, "projects", "demo.app", "agents", "specialist");
      mkdirSync(wfDir, { recursive: true });
      mkdirSync(helperDir, { recursive: true });
      writeFileSync(join(wsRoot, "projects", "demo.app", "app.ts"), "export default { id: 'demo', version: 1, agent: 'lead' };\n");
      writeFileSync(
        join(wsRoot, "projects", "demo.app", "agents", "lead", "agent.json"),
        JSON.stringify({ name: "lead", description: "Lead", domain: "demo", model: "mock", tools: ["finish"] }),
      );
      writeFileSync(
        join(helperDir, "agent.json"),
        JSON.stringify({
          name: "specialist",
          description: "Workflow-only specialist",
          domain: "demo",
          model: "mock",
          tools: ["finish"],
          callableFrom: "workflow",
        }),
      );
      writeFileSync(
        join(wfDir, "ship-flow.ts"),
        `export const name = "ship-flow";
export const description = "Sequential unified ctx workflow";
export async function execute(ctx) {
  ctx.progress("Checking environment");
  const echo = await ctx.exec(["echo", "ready"]);
  const helper = ctx.agent("demo/specialist");
  const r1 = await helper.send("Turn 1 draft");
  const r2 = await helper.send("Turn 2 refine");
  const decision = await ctx.ask({ id: "ship-gate", prompt: "Ship release?", options: ["approve", "hold"] });
  return ctx.done("Shipped", {
    output: {
      attempt: ctx.task.attemptNumber,
      echo: echo.stdout.trim(),
      turnsSeenByHelper: r2.output,
      decision: decision.value,
    },
    facts: ["shipped:true"],
  });
}
`,
      );

      const models = {
        mock: mockModel(({ userMessages }) => ({
          finish: { summary: "ok", output: userMessages.length },
        })) as any,
      };

      // Attempt 1: runs multi-turn specialist + exec, then parks cleanly on await ctx.ask().
      const out1: string[] = [];
      const res1 = await runStandaloneCli(
        ["run", "demo/ship-flow", '{"prompt":"Ship v1"}', "--project-root", wsRoot, "--state-dir", stateDir],
        {
          stdout: (l) => out1.push(l),
          execute: (target, input, opts) => run(target, input, { ...opts, models }),
        },
      );
      expect(res1.exitCode).toBe(1);
      expect(out1[0]).toBe("[parked] Ship release?");
      expect(out1.some((l) => l.includes("resume with:"))).toBe(true);

      // Attempt 2: manual --resume with --answer starts fresh attempt (#2), sees multi-turn history (2 user turns), and completes!
      const out2: string[] = [];
      const res2 = await runStandaloneCli(
        ["run", "--resume", stateDir, "--answer", "approve", "--project-root", wsRoot],
        {
          stdout: (l) => out2.push(l),
          execute: (target, input, opts) => run(target, input, { ...opts, models }),
        },
      );
      expect(res2.exitCode).toBe(0);
      expect(out2[0]).toBe("[done] Shipped");
      expect(JSON.parse(out2[1]!)).toEqual({
        attempt: 2,
        echo: "ready",
        turnsSeenByHelper: 2,
        decision: "approve",
      });
    } finally {
      rmSync(wsRoot, { recursive: true, force: true });
    }
  });

});
