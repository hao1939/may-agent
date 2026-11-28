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

  test("executes unified WorkflowContext standalone, logs events/Conditions simply, and resumes fresh attempt from external task.json update", async () => {
    const { mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync } = await import("node:fs");
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
      mkdirSync(join(wsRoot, "projects", "evaluation.app"), { recursive: true });
      writeFileSync(
        join(wsRoot, "projects", "demo.app", "app.ts"),
        "export default { id: 'demo', version: 1, agent: 'lead', tasks: {}, inputSchema: { type: 'object', properties: { prompt: { type: 'string' } } }, observers: [{ id: 'ci', type: 'ci.status', description: 'CI', inspect: async () => null }] };\n",
      );
      writeFileSync(
        join(wsRoot, "projects", "evaluation.app", "app.ts"),
        "export const app = { id: 'evaluation-canary', version: 1, agent: 'lead', tasks: {}, inputSchema: { type: 'object', properties: { canary: { type: 'boolean' } } }, observers: [{ id: 'canary', type: 'canary.health', description: 'Canary', inspect: async () => null }] };\n",
      );
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
  const contract = await ctx.read.contract("demo");
  await ctx.events.emit({ type: "demo.checked", localKey: "check:1", data: { observers: contract.observations.length } });
  const echo = await ctx.exec(["echo", "ready"]);
  const helper = ctx.agent("demo/specialist");
  await helper.send("Turn 1 draft");
  const r2 = await helper.send("Turn 2 refine");
  const gate = ctx.observe("ci-green");
  if (gate?.state !== "true") {
    return ctx.park({
      summary: "Waiting on CI",
      conditions: [{ id: "ci-green", type: "ci.status", subject: "pr:1", expected: { green: true }, owner: "app:demo" }],
    });
  }
  return ctx.done(
    "Shipped",
    {
      attempt: ctx.task.attemptNumber,
      echo: echo.stdout.trim(),
      turnsSeenByHelper: r2.output,
      observers: contract.observations.length,
    },
    { facts: ["shipped:true"] },
  );
}
`,
      );
      writeFileSync(
        join(wfDir, "other-flow.ts"),
        `export const name = "other-flow"; export const description = "Other";
export async function execute(ctx) {
  const c1 = await ctx.read.contract("evaluation-canary");
  (c1.inputSchema as any).mutated = true;
  const c2 = await ctx.read.contract("evaluation-canary");
  return ctx.done("checked", {
    canaryId: c2.appId,
    canaryObs: c2.observations.length,
    hasWorkload: Boolean(c2.taskReads?.workload),
    schemaMutated: Boolean((c2.inputSchema as any).mutated),
    taskGen: ctx.task.generation,
    taskFacts: ctx.task.facts,
  });
}`,
      );

      const models = {
        mock: mockModel(({ userMessages }) => ({
          finish: { summary: "ok", output: userMessages.length },
        })) as any,
      };

      // Attempt 1: logs emitted event to stderr, parks with Condition summary to stdout, saves minimal task.json.
      const out1: string[] = [];
      const err1: string[] = [];
      const res1 = await runStandaloneCli(
        ["run", "demo/ship-flow", '{"prompt":"Ship v1"}', "--project-root", wsRoot, "--state-dir", stateDir],
        {
          stdout: (l) => out1.push(l),
          stderr: (l) => err1.push(l),
          execute: (target, input, opts) => run(target, input, { ...opts, models }),
        },
      );
      expect(res1.exitCode).toBe(1);
      expect(err1).toContain("[event] demo.checked");
      expect(out1[0]).toBe("[parked] Waiting on CI");
      expect(out1.some((l) => l.includes("waiting on ci.status (pr:1)"))).toBe(true);
      expect(out1.some((l) => l.includes("resume with:"))).toBe(true);

      // Reusing stateDir without --resume or with mismatched target fails cleanly.
      const reuseErr = await run("demo/ship-flow", { prompt: "Ship v1" }, { projectRoot: wsRoot, stateDir, models });
      expect(reuseErr.status).toBe("error");
      expect(reuseErr.summary).toContain("already contains task.json");
      const wrongTarget = await run("demo/other-flow", { prompt: "Ship v1" }, { projectRoot: wsRoot, stateDir, resume: true, models });
      expect(wrongTarget.status).toBe("error");
      expect(wrongTarget.summary).toContain('saved for "demo/ship-flow"');

      // External driver marks Condition satisfied in task.json and runs --resume.
      const saved = JSON.parse(readFileSync(join(stateDir, "task.json"), "utf8"));
      saved.observations["ci-green"] = { state: "true", observed: { green: true } };
      writeFileSync(join(stateDir, "task.json"), JSON.stringify(saved, null, 2));

      const out2: string[] = [];
      const res2 = await runStandaloneCli(
        ["run", "--resume", stateDir, "--project-root", wsRoot],
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
        observers: 1,
      });

      // Verify: (a) read.contract resolves declared App ID when directory differs & clones inputSchema,
      // (b) reconciliation without stateDir derives ctx.task generation/facts instead of synthetic defaults,
      // (c) spreading ctx.done(...) and forwarding via ctx.call() preserves requests and response.
      const recRes = await run(
        "demo/other-flow",
        { prompt: "Check reconciliation + contract" },
        {
          projectRoot: wsRoot,
          models,
          reconciliation: {
            appId: "demo",
            taskId: "t-42",
            generation: 3,
            agent: "lead",
            owner: "lead",
            resourceVersion: 7,
            outcome: "Reconciled outcome",
            acceptance: ["Keep facts"],
            input: {},
            task: { id: "t-42", facts: ["retained:fact-1"] } as any,
            waits: { open: [], note: "" },
            children: { live: [], completed: [] },
            taskSnapshot: { live: [], truncated: false },
            events: { items: [], truncated: false },
          },
        },
      );
      expect(recRes).toMatchObject({
        status: "done",
        summary: "checked",
        output: {
          canaryId: "evaluation-canary",
          canaryObs: 1,
          hasWorkload: false,
          schemaMutated: false,
          taskGen: 3,
          taskFacts: ["retained:fact-1"],
        },
      });
    } finally {
      rmSync(wsRoot, { recursive: true, force: true });
    }
  });
});
