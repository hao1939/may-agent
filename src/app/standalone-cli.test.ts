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
  return ctx.done(
    "Shipped",
    {
      attempt: ctx.task.attemptNumber,
      echo: echo.stdout.trim(),
      turnsSeenByHelper: r2.output,
      decision: decision.value,
    },
    { facts: ["shipped:true"] },
  );
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

  test("enforces --state-dir fresh/target guards, --answer validation, nested worktree propagation, standalone finish isolation, and bounded observationCondition() resume", async () => {
    const { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync, symlinkSync } = await import("node:fs");
    const { execFileSync } = await import("node:child_process");
    const { tmpdir } = await import("node:os");
    const { join, resolve } = await import("node:path");
    const { run } = await import("@may-agent/sdk/standalone");
    const { mockModel } = await import("@may-agent/sdk/testing");

    const wsRoot = mkdtempSync(join(tmpdir(), "standalone-guards-"));
    try {
      mkdirSync(join(wsRoot, "shared"), { recursive: true });
      writeFileSync(join(wsRoot, ".gitignore"), "node_modules\n.state*\n");
      writeFileSync(join(wsRoot, "shared", "common-sense.md"), "Test.\n");
      const appDir = join(wsRoot, "projects", "demo.app");
      const wfDir = join(appDir, "agents", "owner", "workflows");
      mkdirSync(wfDir, { recursive: true });
      mkdirSync(join(appDir, "agents", "helper"), { recursive: true });
      writeFileSync(
        join(appDir, "app.ts"),
        `import { defineObserver } from "@may-agent/sdk/app";
const fastObs = defineObserver({
  appId: "demo",
  id: "build-check",
  type: "ci.status",
  timeoutMs: 2000,
  inspect: async (resource) => ({ build: resource, green: true }),
});
const stalledObs = defineObserver({
  appId: "demo",
  id: "stalled-check",
  type: "stalled.status",
  timeoutMs: 60,
  inspect: async () => new Promise(() => {}),
});
export default { id: "demo", version: 1, agent: "owner", observers: [fastObs, stalledObs] };
`,
      );
      writeFileSync(
        join(appDir, "agents", "owner", "agent.json"),
        JSON.stringify({ name: "owner", description: "Owner", domain: "demo", model: "mock", tools: ["finish"] }),
      );
      writeFileSync(join(appDir, "agents", "owner", "AGENTS.md"), "# Owner\n");
      writeFileSync(
        join(appDir, "agents", "helper", "agent.json"),
        JSON.stringify({ name: "helper", description: "Helper", domain: "demo", model: "mock", callableFrom: "workflow", tools: ["finish"] }),
      );
      writeFileSync(join(appDir, "agents", "helper", "AGENTS.md"), "# Helper\n");

      // Workflow A: discrete approval gate + second workflow B for target mismatch
      writeFileSync(
        join(wfDir, "gate-a.ts"),
        `export const name = "gate-a"; export const description = "Gate A";
export async function execute(ctx) {
  const d = await ctx.ask({ id: "gate", prompt: "Approve?", options: ["approve", "reject"] });
  return ctx.done("approved", { choice: d.value });
}`,
      );
      writeFileSync(
        join(wfDir, "gate-b.ts"),
        `export const name = "gate-b"; export const description = "Gate B";
export async function execute(ctx) { return ctx.done("b"); }`,
      );
      writeFileSync(
        join(wfDir, "multi-ask.ts"),
        `export const name = "multi-ask"; export const description = "Two pending human Conditions";
export async function execute(ctx) {
  return ctx.park({
    summary: "Two questions",
    conditions: [
      { id: "q1", type: "human.review", subject: "s1", expected: { reviewed: true }, owner: "human" },
      { id: "q2", type: "human.review", subject: "s2", expected: { reviewed: true }, owner: "human" },
    ],
  });
}`,
      );
      writeFileSync(
        join(wfDir, "child-pwd.ts"),
        `export const name = "child-pwd"; export const description = "Reads child workspace";
export async function execute(ctx) {
  const pwd = await ctx.exec(["pwd"]);
  return ctx.done("child", { root: ctx.workspace.root, pwd: pwd.stdout.trim() });
}`,
      );
      writeFileSync(
        join(wfDir, "parent-wt.ts"),
        `export const name = "parent-wt"; export const description = "Auto worktree parent";
export const workspace = "task";
export async function execute(ctx) {
  const child = await ctx.call("demo/child-pwd", { prompt: "check" });
  const helper = ctx.agent("demo/helper");
  const t1 = await helper.send("turn-1");
  const t2 = await helper.send("turn-2-no-finish");
  return ctx.done("parent", { parentRoot: ctx.workspace.root, childOut: child.output, t1: t1.status, t2: t2.status });
}`,
      );
      writeFileSync(
        join(wfDir, "obs-flow.ts"),
        `import { defineObserver, observationCondition } from "@may-agent/sdk/app";
export const name = "obs-flow"; export const description = "Observer condition + stalled observer timeout";
const buildContract = defineObserver({ appId: "demo", id: "build-check", type: "ci.status", inspect: async () => null });
export async function execute(ctx) {
  const fast = ctx.observe("build-cond");
  const stalled = ctx.observe("stalled-cond");
  if (fast?.state === "true") {
    return ctx.done("observed", { fastState: fast.state, stalledState: stalled?.state ?? "pending" });
  }
  const cond = observationCondition(buildContract, {
    id: "build-cond",
    observerId: "build-check",
    resource: "pr-42",
    expected: { green: true },
  });
  // Ensure timestamp.gte <= resume clock even within the same millisecond
  (cond.expected as any).timestamp = { gte: Date.now() - 10 };
  return ctx.park({
    summary: "Waiting on CI",
    conditions: [
      cond,
      { id: "stalled-cond", type: "stalled.status", subject: "resource:hang", expected: { ok: true }, owner: "app:demo" },
    ],
  });
}`,
      );

      execFileSync("git", ["init", "-b", "main"], { cwd: wsRoot });
      execFileSync("git", ["config", "user.email", "t@t.com"], { cwd: wsRoot });
      execFileSync("git", ["config", "user.name", "T"], { cwd: wsRoot });
      execFileSync("git", ["add", "."], { cwd: wsRoot });
      execFileSync("git", ["commit", "-m", "init"], { cwd: wsRoot });
      mkdirSync(join(wsRoot, "node_modules", "@may-agent"), { recursive: true });
      symlinkSync(resolve(import.meta.dir, "../../packages/sdk"), join(wsRoot, "node_modules", "@may-agent", "sdk"), "dir");

      // 1. Fresh stateDir parks gate-a; reusing stateDir without --resume fails; mismatched target on --resume fails; invalid choice fails
      const stateA = join(wsRoot, ".state-a");
      const r1 = await run("demo/gate-a", { prompt: "go" }, { projectRoot: wsRoot, stateDir: stateA });
      expect(r1.status).toBe("blocked");

      const reuseWithoutResume = await run("demo/gate-a", { prompt: "go" }, { projectRoot: wsRoot, stateDir: stateA });
      expect(reuseWithoutResume.status).toBe("error");
      expect(reuseWithoutResume.summary).toContain("already contains task.json");

      const wrongTargetResume = await run("demo/gate-b", { prompt: "go" }, { projectRoot: wsRoot, stateDir: stateA, resume: true });
      expect(wrongTargetResume.status).toBe("error");
      expect(wrongTargetResume.summary).toContain('saved for "demo/gate-a"');

      const invalidChoice = await run("demo/gate-a", { prompt: "go" }, {
        projectRoot: wsRoot,
        stateDir: stateA,
        resume: true,
        answer: "maybe",
      });
      expect(invalidChoice.status).toBe("error");
      expect(invalidChoice.summary).toContain("Invalid --answer");

      // 2. Multiple pending human Conditions reject ambiguous --answer
      const stateMulti = join(wsRoot, ".state-multi");
      await run("demo/multi-ask", { prompt: "go" }, { projectRoot: wsRoot, stateDir: stateMulti });
      const ambig = await run("demo/multi-ask", { prompt: "go" }, {
        projectRoot: wsRoot,
        stateDir: stateMulti,
        resume: true,
        answer: "yes",
      });
      expect(ambig.status).toBe("error");
      expect(ambig.summary).toContain("requires exactly 1 pending human Condition, found 2");

      // 3. Nested child workflow inherits auto-allocated worktree & standalone second send without finish() fails cleanly
      const stateWt = join(wsRoot, ".state-wt");
      const models = {
        mock: mockModel(({ userMessages }) => {
          const last = userMessages[userMessages.length - 1] ?? "";
          if (last.includes("no-finish") || last.includes("has not returned its structured output")) {
            return { text: "No finish call on turn 2" };
          }
          return { finish: { summary: "ok", output: { turn: 1 } } };
        }) as any,
      };
      const wtRun = await run("demo/parent-wt", { prompt: "go" }, { projectRoot: wsRoot, workRoot: wsRoot, stateDir: stateWt, models });
      expect(wtRun.status).toBe("done");
      const wtOut = wtRun.output as { parentRoot: string; childOut: { root: string; pwd: string }; t1: string; t2: string };
      expect(wtOut.parentRoot).toBe(join(stateWt, "worktree"));
      expect(wtOut.childOut.root).toBe(wtOut.parentRoot);
      expect(realpathSync(wtOut.childOut.pwd)).toBe(realpathSync(wtOut.parentRoot));
      expect(wtOut.t1).toBe("done");
      expect(wtOut.t2).toBe("error");

      // 4. observationCondition() satisfies on --resume while stalled observer times out cleanly in ~60ms
      const stateObs = join(wsRoot, ".state-obs");
      const obs1 = await run("demo/obs-flow", { prompt: "go" }, { projectRoot: wsRoot, stateDir: stateObs });
      expect(obs1.status).toBe("blocked");
      const startedResume = Date.now();
      const obs2 = await run("demo/obs-flow", { prompt: "go" }, { projectRoot: wsRoot, stateDir: stateObs, resume: true });
      expect(Date.now() - startedResume).toBeLessThan(3000);
      expect(obs2.status).toBe("done");
      expect(obs2.output).toEqual({ fastState: "true", stalledState: "pending" });
    } finally {
      rmSync(wsRoot, { recursive: true, force: true });
    }
  });

});
