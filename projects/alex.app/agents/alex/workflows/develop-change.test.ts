import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer, type AddressInfo, type Socket } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { admitTaskReconcileResult, type TaskDetail, type TaskReconcileResult, type AppWorkflowContext } from "@may-agent/sdk/app";
import {
  createTestAppRead,
  createTestAppWorkflowContext,
  runWorkflowTest,
} from "@may-agent/sdk/testing";
import { Check } from "typebox/value";
import { run } from "@may-agent/sdk/standalone";
import * as developChange from "./develop-change.js";
import app, { taskForInput } from "../../../app.js";
import { EvidenceStore } from "../../../../../shared/tools/task-evidence.js";

const { execute } = developChange;

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

function trial() {
  const root = mkdtempSync(join(tmpdir(), "alex-development-test-"));
  roots.push(root);
  const repo = join(root, "repository");
  const worktree = join(root, "candidate");
  mkdirSync(repo);
  const git = (cwd: string, ...args: string[]) =>
    execFileSync("git", ["-C", cwd, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  git(repo, "init", "-b", "main");
  git(repo, "config", "user.name", "Development Test");
  git(repo, "config", "user.email", "development@example.invalid");
  writeFileSync(join(repo, ".gitignore"), ".checks\n.state/\n");
  writeFileSync(join(repo, "answer.cjs"), "module.exports = () => 0;\n");
  writeFileSync(
    join(repo, "verify.cjs"),
    `require('node:fs').appendFileSync('.checks', 'check\\n'); require('node:assert/strict').equal(require('./answer.cjs')(), Number(process.argv[2])); console.log('verification stdout'); console.error('verification stderr');\n`,
  );
  git(repo, "add", ".");
  git(repo, "commit", "-m", "baseline");
  git(repo, "worktree", "add", "-b", "task/development", worktree);
  const spec = (expected: number) => ({
    kind: "goal",
    data: {
      outcome: `Return ${expected}`,
      acceptance: [`The function returns ${expected}`],
      verify: ["node", "verify.cjs", String(expected)],
    },
  });
  const current: TaskDetail = {
    id: "goal/trial",
    parentId: "root",
    generation: 1,
    status: "running",
    outcome: spec(1).data.outcome,
    acceptance: spec(1).data.acceptance,
    input: spec(1),
    conditions: [],
    acceptedEvidence: { available: true, maxPageSize: 8 },
  };
  const prompts: string[] = [];
  const calls: Array<{ agent: string; stage: string; tools: unknown }> = [];
  let implementation = () => {
    const desired = (current.input as ReturnType<typeof spec>).data.verify[2];
    writeFileSync(
      join(worktree, "answer.cjs"),
      `module.exports = () => ${desired};\n`,
    );
    git(worktree, "add", "answer.cjs");
    if (git(worktree, "diff", "--cached", "--name-only"))
      git(worktree, "commit", "-m", "implement requirement");
  };
  let judgment: (stage: string) => unknown = (stage) => {
    if (stage === "design")
      return {
        decision: "implement",
        reason: "A focused function change is sufficient",
        design: "Return the required value; preserve the verification contract",
      };
    if (stage === "implementation") {
      implementation();
      return { decision: "ready", reason: "Candidate committed" };
    }
    return {
      decision: "pass",
      reason: "Current candidate meets the requirement",
      commit: git(worktree, "rev-parse", "HEAD"),
      findings: [],
    };
  };
  const context = (
    signal = new AbortController().signal,
  ): Parameters<typeof execute>[0] =>
    createTestAppWorkflowContext<{ prompt: string; data: { verify: string[] } }>({
      input: { prompt: "Run the selected development procedure", data: { verify: (current.input as any).data.verify } },
      signal,
      reconciliation: {
        task: current,
        appId: "alex",
        taskId: current.id,
        generation: current.generation,
        resourceVersion: 1,
        agent: "alex/tech-lead",
        owner: "tech-lead",
        outcome: current.outcome,
        acceptance: current.acceptance,
        input: current.input as any, // Owning Task envelope, distinct from procedure options.
        children: { live: [], completed: [] },
        waits: { open: [], note: "" },
        taskSnapshot: { live: [], truncated: false },
        events: { items: [], truncated: false },
      },
      workspace: {
        appRoot: repo,
        projectRoot: repo,
        root: worktree,
        output: worktree,
      },
      read: createTestAppRead({
        tasks: {
          list: async () => ({ items: [] }),
          get: async () => current,
        },
        execution: async (id) => ({
          id,
          kind: "agent",
          status: "done",
          summary: "step complete",
          diagnostics: {
            cliCalls: [{
              sessionId: id,
              toolCallId: `cli-${id}`,
              taskId: "task-1",
              tool: "codex",
              status: "completed",
              resultPath: "/tmp/result.md",
              structuredResultPath: "/tmp/result.json",
              eventsPath: "/tmp/events.jsonl",
            }],
            truncated: true,
          },
        }),
      }),
      call: (async (
        agent: string,
        input: { prompt: string },
        options: { tools?: unknown },
      ) => {
        const prompt = input.prompt;
        const stage =
          /^Development step: ([^.]+)/.exec(prompt)?.[1] ?? "unknown";
        calls.push({ agent, stage, tools: options?.tools });
        prompts.push(prompt);
        return {
          id: `step-${calls.length}`,
          kind: "agent",
          status: "done",
          summary: "step complete",
          facts: { retained: "execution evidence" },
          output: judgment(stage),
        };
      }) as AppWorkflowContext["call"],
    });
  const run = async (ctx = context()) => {
    const response = await execute(ctx);
    const output = response.output as TaskReconcileResult;
    const admitted = admitTaskReconcileResult(output);
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) throw Error(JSON.stringify(admitted));
    current.result = output.result;
    return output;
  };
  return {
    repo,
    worktree,
    current,
    calls,
    prompts,
    evidence() {
      const delivery = current.result!.development as any;
      return JSON.parse(readFileSync(delivery.evidence.path, "utf8"));
    },
    context,
    run,
    git,
    spec,
    setImplementation(fn: typeof implementation) {
      implementation = fn;
    },
    setJudgment(fn: typeof judgment) {
      judgment = fn;
    },
  };
}

describe("development workflow using real Git and verification", () => {
  test("develops in the creator's explicit checkout and compares its declared base", async () => {
    const target = trial();
    const fallback = trial();
    const base = target.git(target.worktree, "rev-parse", "HEAD");
    target.git(target.repo, "branch", "review-base", base);
    writeFileSync(join(target.repo, "unrelated.txt"), "Existing main work\n");
    target.git(target.repo, "add", "unrelated.txt");
    target.git(target.repo, "commit", "-m", "advance main");
    target.git(target.worktree, "merge", "--ff-only", "main");
    (target.current.input as any).data.context = {
      developmentCheckout: { root: target.worktree, baseRef: "review-base" },
    };
    const ctx = target.context();
    ctx.workspace!.root = fallback.worktree;
    const result = await target.run(ctx);
    expect(result.state).toBe("converged");
    expect(target.evidence().verified.base).toBe(base);
    expect(target.prompts.every((prompt) => prompt.includes(`Worktree: ${target.worktree}`))).toBe(true);
    expect(readFileSync(join(target.worktree, "answer.cjs"), "utf8")).toContain("=> 1");
    expect(readFileSync(join(fallback.worktree, "answer.cjs"), "utf8")).toContain("=> 0");
    expect(existsSync(join(fallback.worktree, ".checks"))).toBe(false);
  });

  test("rejects an invalid assigned checkout before specialists or verification", async () => {
    const t = trial();
    (t.current.input as any).data.context = {
      developmentCheckout: { root: "../different-repository", baseRef: "--all" },
    };
    const result = await t.run();
    expect(result.state).toBe("incomplete");
    expect(result.summary).toContain("developmentCheckout");
    expect(t.calls).toHaveLength(0);
    expect(existsSync(join(t.worktree, ".checks"))).toBe(false);
  });

  test.each(["accepted policy", "initial periodic input", "initial audit input"])(
    "standing review returns before spending development allowance: %s", async (kind) => {
      const t = trial();
      t.current.outcome = "Own the standing daily May improvement review";
      if (kind === "accepted policy") t.current.result = {
        periodicReview: { mode: "standing", cumulativeIncidentCounts: { automatedReviewRepairRounds: 3 } },
      };
      else (t.current.input as any).data.context = kind === "initial periodic input"
        ? { periodicReview: { kind: "standing-task-owned-review" } }
        : { audit: { identity: "may/improvement-review", mode: "standing" } };
      const previous = structuredClone(t.current.result);
      const output = (await execute(t.context())).output as TaskReconcileResult;
      expect(output.state).toBe("incomplete");
      expect(output.summary).toContain("finite incident Task");
      expect(output.summary).toContain("exhausted incident requires owner disposition");
      expect(t.current.result).toEqual(previous);
      expect(t.calls).toEqual([]);
      expect(existsSync(join(t.worktree, ".checks"))).toBe(false);
      expect(existsSync(join(t.worktree, ".state/alex-development"))).toBe(false);
    },
  );

  test("finite incident child supplies its exact requirement to every specialist", async () => {
    const t = trial();
    t.current.creator = { appId: "alex", taskId: "standing/improvement-review" };
    (t.current.input as any).data.context = {
      improvementIncident: { id: "incident/return-one", standingTaskId: "standing/improvement-review" },
    };
    expect((await t.run()).state).toBe("converged");
    expect(t.calls.map(c => c.stage)).toEqual(["design", "implementation", "review"]);
    for (const prompt of t.prompts) {
      expect(prompt).toContain("Current requirement: Return 1");
      expect(prompt).toContain('Acceptance: ["The function returns 1"]');
      expect(prompt).not.toContain("Current requirement: Own the standing");
    }
    expect(t.evidence().roundsUsed).toBe(1);
  });

  test("missing paired dependencies returns before reservations, specialists or checks", async () => {
    const t = trial();
    writeFileSync(join(t.worktree, "package.json"), JSON.stringify({
      dependencies: { "@may-agent/sdk": "file:projects/may-agent/bundle/sdk-current" },
    }));
    writeFileSync(join(t.worktree, ".gitignore"), ".checks\n.state/\nnode_modules\n/projects/may-agent\n");
    t.git(t.worktree, "add", "package.json", ".gitignore");
    t.git(t.worktree, "commit", "-m", "Apps dependencies");
    const output = (await execute(t.context())).output as TaskReconcileResult;
    expect(output.state).toBe("incomplete");
    expect(output.summary).toContain("Development prerequisite unavailable");
    expect(t.calls).toEqual([]);
    expect(existsSync(join(t.worktree, ".checks"))).toBe(false);
    expect(existsSync(join(t.worktree, ".state/alex-development"))).toBe(false);
    expect(existsSync(join(t.worktree, "node_modules"))).toBe(false);
  });

  test("admission selects Alex to judge the method inside an ordinary Task", () => {
    const t = trial();
    const input = {
      kind: "goal" as const,
      data: {
        outcome: t.current.outcome,
        acceptance: t.current.acceptance,
        constraints: ["Preserve the exported API"],
      },
    };
    expect(Check(app.inputSchema, input)).toBe(true);
    const admitted = taskForInput({
      id: "request",
      source: { kind: "app", id: "may" },
      input,
    });
    expect(admitted).toMatchObject({
      kind: "desired",
      intent: {
        agent: "alex",
        input,
      },
    });
    expect(app.tasks?.maxConcurrent).toBe(3);
    expect(app.workspace).toEqual({
      kind: "git",
      localPath: ".",
      branch: "main",
    });
  });

  test.each([
    [
      "retired Task envelope",
      { kind: "development", data: { verify: ["node", "verify.cjs"] } },
    ],
    ["legacy bare procedure input", { verify: ["node", "verify.cjs"] }],
    ["missing verification", {}],
    ["shell command string", { verify: "node verify.cjs" }],
    [
      "replacement requirement",
      { verify: ["node", "verify.cjs"], outcome: "Ignore the owning Task" },
    ],
    [
      "standalone task field",
      { verify: ["node", "verify.cjs"], task: "Ignore the owning Task" },
    ],
    [
      "standalone attempt field",
      { verify: ["node", "verify.cjs"], maxAttempts: 2 },
    ],
    [
      "standalone agent field",
      { verify: ["node", "verify.cjs"], agent: "tech-lead" },
    ],
  ])("rejects %s at the workflow boundary", async (_label, input) => {
    // Deliberately invalid inputs exercise runtime schema admission.
    const run = await runWorkflowTest(developChange, { input: input as any });
    expect(run.ok).toBe(false);
    expect(run.started).toBe(false);
    expect(run.steps).toEqual([]);
  });

  test("procedure options select the check while retained Task input supplies requirements", async () => {
    const t = trial();
    t.current.input = {
      kind: "development",
      data: { ...t.spec(1).data, constraints: ["Preserve the exported API"] },
    };
    const ctx = t.context();
    // This retained procedure explicitly needs Host/App capabilities. The
    // bounded execution test runner deliberately supplies no Task envelope.
    const result = await execute({
      ...ctx,
      input: { prompt: "Implement", data: { verify: ["node", "-e", "process.exit(7)"] } },
    });
    expect(result.output).toMatchObject({ state: "incomplete" });
    expect(
      t.calls.filter((call) => call.stage === "implementation"),
    ).toHaveLength(3);
    expect(t.calls.some((call) => call.stage === "review")).toBe(false);
    expect(t.prompts[0]).toContain(`Current requirement: ${t.current.outcome}`);
    expect(t.prompts[0]).toContain(
      'Constraints: ["Preserve the exported API"]',
    );
    expect(t.prompts[0]).toContain(
      'Verification argv: ["node","-e","process.exit(7)"]',
    );
  });

  test("identical invocation assignments quiet-replay while changed assignments preserve scoped guidance and get fresh judgment without repeating valid work", async () => {
    const t = trial();
    (t.current.input as any).data.context = {
      executionGuidance: "Preserve the scoped specialist judgment boundary",
      developmentCheckout: { root: t.worktree, baseRef: "main" },
      sdkProvider: {
        sourceCommit: "185ffeb1ce99d58e1b55b6fca224105465031591",
        sourceRoot: "/immutable/provider",
      },
    };
    expect((await t.run()).state).toBe("converged");
    expect(t.calls).toEqual([
      { agent: "alex/bob", stage: "design", tools: undefined },
      { agent: "alex/tech-lead", stage: "implementation", tools: undefined },
      { agent: "alex/bob", stage: "review", tools: undefined },
    ]);
    expect(t.prompts[0]).toContain(
      "Current invocation assignment: Run the selected development procedure",
    );
    expect(t.prompts[0]).toContain(
      "Preserve the scoped specialist judgment boundary",
    );
    expect(t.prompts[0]).toContain(
      '"sourceCommit":"185ffeb1ce99d58e1b55b6fca224105465031591"',
    );
    expect(t.prompts[0]).toContain(
      "Keep the owning Task's wider acceptance visible as context",
    );
    expect(t.prompts[0]).toContain("exact SETUP dependency");
    expect(readFileSync(join(t.worktree, ".checks"), "utf8")).toBe("check\n");
    expect(t.evidence().roundsUsed).toBe(1);

    t.setJudgment((stage) =>
      stage === "design"
        ? {
            decision: "review",
            reason: "The changed assignment needs fresh judgment of the retained candidate",
            design: "Reuse the exact verified implementation and review it against the current assignment",
          }
        : {
            decision: "pass",
            reason: "The retained candidate satisfies the current assignment",
            commit: t.git(t.worktree, "rev-parse", "HEAD"),
            findings: [],
          },
    );
    const changed = t.context();
    changed.input = {
      prompt: "Assess the retained candidate against the revised invocation assignment",
      data: { verify: (t.current.input as any).data.verify },
    };
    expect(changed.reconciliation.events.items).toEqual([]);
    expect((await t.run(changed)).state).toBe("converged");
    expect(t.calls.slice(3)).toEqual([
      { agent: "alex/bob", stage: "design", tools: undefined },
      { agent: "alex/bob", stage: "review", tools: undefined },
    ]);
    for (const prompt of t.prompts.slice(3)) {
      expect(prompt).toContain(
        "Current invocation assignment: Assess the retained candidate against the revised invocation assignment",
      );
      expect(prompt).toContain(
        "Preserve the scoped specialist judgment boundary",
      );
      expect(prompt).toContain(
        "Keep the owning Task's wider acceptance visible as context",
      );
      expect(prompt).toContain(
        "Retained reports, local verification receipts, and bounded child execution projections",
      );
      expect(prompt).toContain("/.state/alex-development/");
      expect(prompt).toContain("preserve diagnostics.truncated");
    }
    expect(readFileSync(join(t.worktree, ".checks"), "utf8")).toBe("check\n");
    expect(t.evidence().roundsUsed).toBe(2);

    const identical = t.context();
    identical.input = structuredClone(changed.input);
    expect((await t.run(identical)).state).toBe("converged");
    expect(t.calls).toHaveLength(5);
    expect(t.evidence().roundsUsed).toBe(2);
    expect(readFileSync(join(t.repo, "answer.cjs"), "utf8")).toContain("=> 0");
  });

  test("a completion claim cannot bypass a failing command or reset exhausted rounds", async () => {
    const t = trial();
    t.setImplementation(() => {});
    expect((await t.run()).state).toBe("incomplete");
    expect(t.calls.filter((x) => x.stage === "implementation")).toHaveLength(3);
    expect(t.calls.some((x) => x.stage === "review")).toBe(false);
    expect(readFileSync(join(t.worktree, ".checks"), "utf8")).toBe(
      "check\ncheck\ncheck\n",
    );
    expect(t.evidence().roundsUsed).toBe(3);

    t.setImplementation(() => {
      throw Error("exhausted work must not restart in another invocation");
    });
    expect((await t.run()).state).toBe("incomplete");
    expect(t.calls.filter((x) => x.stage === "implementation")).toHaveLength(3);
    expect(readFileSync(join(t.worktree, ".checks"), "utf8")).toBe(
      "check\ncheck\ncheck\n",
    );
  });

  test("failed checks are repaired within the same attempt", async () => {
    const t = trial();
    let attempts = 0;
    t.setImplementation(() => {
      if (++attempts === 1) return;
      writeFileSync(
        join(t.worktree, "answer.cjs"),
        "module.exports = () => 1;\n",
      );
      t.git(t.worktree, "add", "answer.cjs");
      t.git(t.worktree, "commit", "-m", "repair");
    });
    expect((await t.run()).state).toBe("converged");
    expect(attempts).toBe(2);
    expect(t.calls.filter((x) => x.stage === "review")).toHaveLength(1);
  });

  test("live reentry shares three rounds even before the owner accepts a result", async () => {
    const t = trial();
    t.setJudgment(() => ({ decision: "invalid" }));
    const first = await execute(t.context());
    expect(first.output).toMatchObject({ state: "incomplete" });
    expect(t.current.result).toBeUndefined();

    // The owner continues its live attempt without first settling a Task result.
    t.setJudgment((stage) =>
      stage === "design"
        ? { decision: "implement", reason: "Repair", design: "Return 1" }
        : { decision: "ready", reason: "Claims ready without fixing the source" },
    );
    const second = await execute(t.context());
    expect(second.output).toMatchObject({ state: "incomplete" });
    expect(t.calls.filter(({ stage }) => stage === "implementation")).toHaveLength(
      2,
    );

    const third = t.context();
    third.input = { prompt: "Implement", data: { verify: ["node", "./verify.cjs", "1"] } };
    const count = t.calls.length;
    const result = await t.run(third);
    expect(result.state).toBe("incomplete");
    expect(result.summary).toContain("3 cumulative");
    expect(t.calls).toHaveLength(count);
    expect(t.evidence().roundsUsed).toBe(3);
    expect(readFileSync(join(t.worktree, ".checks"), "utf8")).toBe(
      "check\ncheck\n",
    );
    expect(t.current.acceptance).toEqual(["The function returns 1"]);
  });

  test("accepted development evidence survives producer worktree cleanup", async () => {
    const t = trial();
    expect((await t.run()).state).toBe("converged");
    const delivery = t.current.result!.development as any;
    const saved = t.evidence();
    t.git(t.repo, "worktree", "remove", "--force", t.worktree);
    const store = new EvidenceStore(dirname(delivery.evidence.path));
    expect(JSON.parse(await store.read(delivery.evidence))).toEqual(saved);
    expect(await store.read(delivery.report)).toContain("Cumulative rounds reserved: 1/3");
    for (const report of saved.reports) {
      expect(await store.read(report.record)).toBeTruthy();
      expect(await store.read(report.report)).toBeTruthy();
    }
    expect(JSON.parse(readFileSync(join(store.directory, "round-1.reserved.json"), "utf8")))
      .toMatchObject({ round: 1, kind: "round-reservation" });
  });

  test("a new execution output retains pinned evidence and consumed rounds across a creator revision", async () => {
    const t = trial();
    expect((await t.run()).state).toBe("converged");
    const original = t.evidence();
    const calls = t.calls.length;
    t.current.generation++;
    const ctx = t.context();
    ctx.workspace!.output = join(t.worktree, ".state", "revised-output");
    expect((await t.run(ctx)).state).toBe("converged");
    expect(t.calls).toHaveLength(calls);
    expect(t.evidence().roundsUsed).toBe(original.roundsUsed);
    expect(t.evidence().review).toEqual(original.review);
    for (const report of t.evidence().reports) {
      expect(report.record.path).toStartWith(ctx.workspace!.projectRoot);
      expect(report.report.path).toStartWith(ctx.workspace!.projectRoot);
    }
    // The copied references must also survive ordinary reentry in this output.
    expect((await t.run(ctx)).state).toBe("converged");
    expect(t.calls).toHaveLength(calls);
    expect(t.evidence().roundsUsed).toBe(original.roundsUsed);
  });

  test("moving execution output cannot replenish exhausted or corrupt prior evidence", async () => {
    for (const corrupt of [false, true]) {
      const t = trial();
      t.setImplementation(() => {});
      await t.run();
      if (corrupt)
        writeFileSync((t.current.result!.development as any).evidence.path, "{}");
      const calls = t.calls.length;
      t.current.generation++;
      const ctx = t.context();
      ctx.workspace!.output = join(t.worktree, ".state", "revised-output");
      expect((await t.run(ctx)).state).toBe("incomplete");
      expect(t.calls).toHaveLength(calls);
      expect(t.evidence().roundsUsed).toBe(3);
    }
  });

  test("a changed verification command does not replenish accepted round usage", async () => {
    const t = trial();
    t.setImplementation(() => {});
    expect((await t.run()).state).toBe("incomplete");
    const calls = t.calls.length;
    const ctx = t.context();
    ctx.input = { prompt: "Implement", data: { verify: ["node", "./verify.cjs", "1"] } };
    expect((await t.run(ctx)).state).toBe("incomplete");
    expect(t.calls).toHaveLength(calls);
    expect(t.evidence().roundsUsed).toBe(3);
    expect(t.evidence().verified).toBeUndefined();
  });

  test("cancellation consumes its reserved round without an accepted result", async () => {
    const t = trial();
    const controller = new AbortController();
    const ctx = t.context(controller.signal);
    const call = ctx.call;
    ctx.call = (async (...args: Parameters<typeof call>) => {
      await call(...args);
      controller.abort(new Error("Interrupted specialist"));
      throw controller.signal.reason;
    }) as typeof call;
    await expect(execute(ctx)).rejects.toThrow("Interrupted specialist");
    expect(t.current.result).toBeUndefined();
    t.setJudgment(() => ({ decision: "invalid" }));
    for (let attempt = 0; attempt < 3; attempt++) await t.run();
    expect(t.calls).toHaveLength(3);
    expect(t.evidence().roundsUsed).toBe(3);
  });

  test("a saved creator allowance continues at round four without replacing consumed receipts", async () => {
    const t = trial();
    t.setImplementation(() => {});
    expect((await t.run()).state).toBe("incomplete");
    expect(t.evidence().roundsUsed).toBe(3);
    const priorDirectory = dirname((t.current.result!.development as any).evidence.path);
    const reservations = [1, 2, 3].map((round) => {
      const path = join(priorDirectory, `round-${round}.reserved.json`);
      return { path, body: readFileSync(path, "utf8") };
    });
    const failed = t.evidence().reports.filter((report: any) => report.stage === "verification");
    expect(failed).toHaveLength(3);

    t.current.generation++;
    (t.current.input as any).data.context = { developmentRoundLimit: 6 };
    t.setImplementation(() => {
      writeFileSync(join(t.worktree, "answer.cjs"), "module.exports = () => 1;\n");
      t.git(t.worktree, "add", "answer.cjs");
      t.git(t.worktree, "commit", "-m", "authorized continuation");
    });
    const ctx = t.context();
    ctx.workspace!.output = join(t.worktree, ".state", "new-output");
    expect((await t.run(ctx)).state).toBe("converged");
    expect(t.current.id).toBe("goal/trial");
    expect(t.evidence().roundsUsed).toBe(4);
    const directory = dirname((t.current.result!.development as any).evidence.path);
    expect(JSON.parse(readFileSync(join(directory, "round-4.reserved.json"), "utf8")))
      .toMatchObject({ round: 4, roundLimit: 6, generation: 2 });
    for (const receipt of reservations)
      expect(readFileSync(receipt.path, "utf8")).toBe(receipt.body);
    for (const report of failed)
      expect(JSON.parse(readFileSync(report.record.path, "utf8")).passed).toBe(false);
  });

  test("lowering or removing a saved allowance preserves usage beyond the default limit", async () => {
    const t = trial();
    (t.current.input as any).data.context = { developmentRoundLimit: 6 };
    t.setJudgment(() => ({ decision: "invalid" }));
    for (let attempt = 0; attempt < 6; attempt++) await t.run();
    expect(t.evidence().roundsUsed).toBe(6);
    const calls = t.calls.length;
    for (const context of [{ developmentRoundLimit: 4 }, {}]) {
      t.current.generation++;
      (t.current.input as any).data.context = context;
      const ctx = t.context();
      ctx.workspace!.output = join(t.worktree, ".state", `output-${t.current.generation}`);
      expect((await t.run(ctx)).state).toBe("incomplete");
      expect(t.evidence().roundsUsed).toBe(6);
      expect(t.calls).toHaveLength(calls);
    }
  });

  test.each([0, -1, 1.5, "6", null, Infinity])(
    "rejects invalid saved developmentRoundLimit %p before spending work", async (limit) => {
      const t = trial();
      (t.current.input as any).data.context = { developmentRoundLimit: limit };
      const output = await t.run();
      expect(output.state).toBe("incomplete");
      expect(output.summary).toContain("developmentRoundLimit");
      expect(t.calls).toHaveLength(0);
      expect(existsSync(join(t.worktree, ".checks"))).toBe(false);
    },
  );

  test("a caller-context allowance cannot replace the saved Task's default limit", async () => {
    const t = trial();
    t.setJudgment(() => ({ decision: "invalid" }));
    for (let attempt = 0; attempt < 3; attempt++) await t.run();
    const ctx = t.context();
    ctx.reconciliation!.input = {
      ...t.current.input,
      data: { ...(t.current.input as any).data, context: { developmentRoundLimit: 6 } },
    };
    expect((await t.run(ctx)).state).toBe("incomplete");
    expect(t.evidence().roundsUsed).toBe(3);
    expect(t.calls).toHaveLength(3);
  });

  test.each(["malformed delivery", "missing evidence", "legacy count"])(
    "an extended total grants no work when prior usage is unknown: %s", async (kind) => {
      const t = trial();
      await t.run();
      const delivery = t.current.result!.development as any;
      if (kind === "malformed delivery") delete delivery.evidence.sha256;
      else if (kind === "missing evidence") rmSync(delivery.evidence.path);
      else {
        const historic = t.evidence();
        delete historic.roundsUsed;
        delivery.evidence = await new EvidenceStore(dirname(delivery.evidence.path))
          .put(JSON.stringify(historic), "json");
      }
      const calls = t.calls.length;
      t.current.generation++;
      (t.current.input as any).data.context = { developmentRoundLimit: 6 };
      const ctx = t.context();
      ctx.workspace!.output = join(t.worktree, ".state", "extended-output");
      expect((await t.run(ctx)).state).toBe("incomplete");
      expect(t.calls).toHaveLength(calls);
      expect(t.evidence().roundsUsed).toBe(6);
    },
  );

  test.each([3, 6])("concurrent invocations cannot exceed the saved total of %p rounds", async (limit) => {
    const t = trial();
    (t.current.input as any).data.context = { developmentRoundLimit: limit };
    t.setJudgment(() => ({ decision: "invalid" }));
    const results = await Promise.all(
      Array.from({ length: limit * 2 }, () => execute(t.context())),
    );
    for (const result of results)
      expect(result.output).toMatchObject({ state: "incomplete" });
    expect(t.calls).toHaveLength(limit);
  });

  test.each(["known", "unknown"])(
    "legacy evidence with %s usage cannot replenish the allowance during migration",
    async (usage) => {
      const t = trial();
      if (usage === "known") t.setImplementation(() => {});
      await t.run();
      const delivery = t.current.result!.development as any;
      const directory = dirname(delivery.evidence.path);
      // Simulate pre-repair evidence: no durable reservation slots existed.
      for (let round = 1; round <= 3; round++)
        rmSync(join(directory, `round-${round}.reserved.json`), { force: true });
      if (usage === "unknown") {
        const historic = t.evidence();
        delete historic.roundsUsed;
        delivery.evidence = await new EvidenceStore(directory).put(
          JSON.stringify(historic),
          "json",
        );
      }
      const count = t.calls.length;
      const ctx = t.context();
      ctx.input = { prompt: "Implement", data: { verify: ["node", "./verify.cjs", "1"] } };
      expect((await t.run(ctx)).state).toBe("incomplete");
      expect(t.calls).toHaveLength(count);
      expect(t.evidence().roundsUsed).toBe(3);
    },
  );

  test("an unreadable prior allowance does not silently grant a fresh budget", async () => {
    const t = trial();
    await t.run();
    rmSync((t.current.result!.development as any).evidence.path);
    const calls = t.calls.length;
    expect((await t.run()).state).toBe("incomplete");
    expect(t.calls).toHaveLength(calls);
    expect(t.evidence().roundsUsed).toBe(3);
  });

  test("implementation continue resumes unfinished work in the next round before verification", async () => {
    const t = trial();
    let implCalls = 0;
    t.setJudgment((stage) => {
      if (stage === "design")
        return {
          decision: "implement",
          reason: "Implement in two passes",
          design: "Write file then commit",
        };
      if (stage === "implementation") {
        implCalls += 1;
        writeFileSync(join(t.worktree, "answer.cjs"), "module.exports = () => 1;\n");
        if (implCalls === 1) {
          return {
            decision: "continue",
            reason: "Bounded completion arrived before git commit",
          };
        }
        t.git(t.worktree, "add", "answer.cjs");
        t.git(t.worktree, "commit", "-m", "finish implementation");
        return { decision: "ready", reason: "Committed candidate" };
      }
      return {
        decision: "pass",
        reason: "Verified",
        commit: t.git(t.worktree, "rev-parse", "HEAD"),
        findings: [],
      };
    });
    expect((await t.run()).state).toBe("converged");
    expect(implCalls).toBe(2);
    expect(t.calls.map((c) => c.stage)).toEqual([
      "design",
      "implementation",
      "implementation",
      "review",
    ]);
    expect(readFileSync(join(t.worktree, ".checks"), "utf8")).toBe("check\n");
  });

  test("a review of another commit cannot certify the candidate", async () => {
    const t = trial();
    t.setJudgment((stage) =>
      stage === "design"
        ? {
            decision: "review",
            reason: "Assess existing behavior",
            design: "Review current implementation",
          }
        : {
            decision: "pass",
            reason: "Looks fine",
            commit: "wrong-commit",
            findings: [],
          },
    );
    t.current.input = t.spec(0);
    t.current.outcome = t.spec(0).data.outcome;
    t.current.acceptance = t.spec(0).data.acceptance;
    const result = await t.run();
    expect(result.state).toBe("incomplete");
    expect(result.summary).toContain("does not match");
  });

  test.each(["revise", "redesign"])(
    "review %s drives a repair and a new verification/review",
    async (decision) => {
      const t = trial();
      let reviews = 0;
      t.setJudgment((stage) => {
        if (stage === "design")
          return {
            decision: "implement",
            reason: "Implement",
            design: "A small change",
          };
        if (stage === "implementation") {
          writeFileSync(
            join(t.worktree, "answer.cjs"),
            `// iteration ${reviews}\nmodule.exports = () => 1;\n`,
          );
          t.git(t.worktree, "add", "answer.cjs");
          t.git(t.worktree, "commit", "-m", "candidate");
          return { decision: "ready", reason: "Committed" };
        }
        return {
          decision: ++reviews === 1 ? decision : "pass",
          reason: "Review",
          commit: t.git(t.worktree, "rev-parse", "HEAD"),
          findings: reviews === 1 ? ["Clarify the implementation"] : [],
        };
      });
      expect((await t.run()).state).toBe("converged");
      expect(reviews).toBe(2);
      expect(t.calls.filter((x) => x.stage === "design")).toHaveLength(
        decision === "redesign" ? 2 : 1,
      );
      expect(readFileSync(join(t.worktree, ".checks"), "utf8")).toBe(
        "check\ncheck\n",
      );
    },
  );

  test("a passing review retains optional findings and reuses the verified candidate", async () => {
    const t = trial();
    t.current.input = t.spec(0);
    t.current.outcome = t.spec(0).data.outcome;
    t.current.acceptance = t.spec(0).data.acceptance;
    t.setJudgment((stage) =>
      stage === "design"
        ? {
            decision: "review",
            reason: "Inspect existing work",
            design: "Verify the existing function",
          }
        : {
            decision: "pass",
            reason: "Acceptance is met; documentation improvement is optional",
            commit: t.git(t.worktree, "rev-parse", "HEAD"),
            findings: ["Optional: add another usage example"],
          },
    );
    expect((await t.run()).state).toBe("converged");
    expect(t.evidence().review.judgment.findings).toEqual([
      "Optional: add another usage example",
    ]);
    expect((await t.run()).state).toBe("converged");
    expect(t.calls.map((call) => call.stage)).toEqual(["design", "review"]);
    expect(readFileSync(join(t.worktree, ".checks"), "utf8")).toBe("check\n");
  });

  test.each(["verification", "review"])(
    "%s cannot certify inconsistent evidence",
    async (phase) => {
      const t = trial();
      t.current.input = t.spec(0);
      t.current.outcome = t.spec(0).data.outcome;
      t.current.acceptance = t.spec(0).data.acceptance;
      if (phase === "verification") {
        (t.current.input as ReturnType<typeof t.spec>).data.verify = [
          "node",
          "-e",
          "require('node:fs').appendFileSync('answer.cjs', '// changed during verification\\n')",
        ];
      }
      t.setJudgment((stage) => {
        if (stage === "design")
          return {
            decision: "review",
            reason: "Inspect existing work",
            design: "Verify the current behavior",
          };
        if (stage === "implementation")
          return {
            decision: "ready",
            reason: "Claim ready without fixing dirty source",
          };
        const commit = t.git(t.worktree, "rev-parse", "HEAD");
        if (phase === "review") {
          writeFileSync(
            join(t.worktree, "answer.cjs"),
            "module.exports = () => 7;\n",
          );
          t.git(t.worktree, "add", "answer.cjs");
          t.git(t.worktree, "commit", "-m", "concurrent candidate change");
        }
        return {
          decision: "pass",
          reason: "Claim accepted",
          commit,
          findings: [],
        };
      });
      const result = await t.run();
      expect(result.state).toBe("incomplete");
      expect(result.summary).toContain(
        phase === "verification" ? "uncommitted" : "does not match",
      );
      if (phase === "verification")
        expect(t.calls.some((x) => x.stage === "review")).toBe(false);
    },
  );

  test("requirement edits succeed while implementation runs and are handled on the next invocation", async () => {
    const t = trial();
    t.setImplementation(() => {
      t.current.generation = 2;
      t.current.input = t.spec(2);
      t.current.outcome = t.spec(2).data.outcome;
      t.current.acceptance = t.spec(2).data.acceptance;
    });
    const result = await t.run();
    expect(result.state).toBe("incomplete");
    expect(result.summary).toContain("Requirement changed");
    expect(t.calls.some((x) => x.stage === "review")).toBe(false);
    t.setImplementation(() => {
      writeFileSync(
        join(t.worktree, "answer.cjs"),
        "module.exports = () => 2;\n",
      );
      t.git(t.worktree, "add", "answer.cjs");
      t.git(t.worktree, "commit", "-m", "new requirement");
    });
    expect((await t.run()).state).toBe("converged");
    expect(t.current.id).toBe("goal/trial");
  });

  test("an interrupted dirty edit is preserved and repaired in a fresh invocation", async () => {
    const t = trial();
    const controller = new AbortController();
    t.setImplementation(() => {
      writeFileSync(
        join(t.worktree, "answer.cjs"),
        "module.exports = () => 1;\n",
      );
      controller.abort(Error("interrupted"));
    });
    await expect(t.run(t.context(controller.signal))).rejects.toThrow();
    expect(t.git(t.worktree, "status", "--porcelain")).toContain("answer.cjs");
    t.setImplementation(() => {
      t.git(t.worktree, "add", "answer.cjs");
      t.git(t.worktree, "commit", "-m", "retain interrupted work");
    });
    expect((await t.run()).state).toBe("converged");
    expect(t.evidence().roundsUsed).toBe(2);
    expect(t.calls.filter((call) => call.stage === "design")).toHaveLength(2);
    expect(t.current.id).toBe("goal/trial");
  });

  test("workflow cancellation stops running verification without allowing review", async () => {
    const t = trial();
    const controller = new AbortController();
    const stopped = Promise.withResolvers<void>();
    let started = false;
    let guarded = false;
    let peer: Socket | undefined;
    const server = createServer((socket) => {
      peer = socket;
      let messages = "";
      socket.on("data", (chunk) => {
        messages += chunk.toString();
        if (messages.includes("ready") && !started) {
          started = true;
          controller.abort(new Error("Verification cancelled"));
        }
        if (messages.includes("guarded")) guarded = true;
      });
      socket.on("close", () => stopped.resolve());
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const port = (server.address() as AddressInfo).port;
    const ctx = t.context(controller.signal);
    ctx.input = {
      prompt: "Implement",
      data: { verify: [
        "node",
        "-e",
        `
          const socket = require("node:net").connect(${port}, "127.0.0.1");
          // Bound the fixture even if production cancellation breaks.
          const guard = setTimeout(() => {
            socket.end("guarded", () => process.exit(71));
          }, 10_000);
          socket.on("connect", () => socket.write("ready"));
          socket.on("close", () => clearTimeout(guard));
        `,
      ] },
    };
    try {
      await expect(t.run(ctx)).rejects.toThrow("Verification cancelled");
      expect(started).toBe(true);
      await stopped.promise;
      expect(guarded).toBe(false);
      expect(t.calls.map((call) => call.stage)).toEqual([
        "design",
        "implementation",
      ]);
      expect(t.current.result).toBeUndefined();
    } finally {
      controller.abort();
      peer?.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }, 15_000);

  test("new input triggers judgment despite a previously accepted result", async () => {
    const t = trial();
    await t.run();
    const ctx = t.context();
    ctx.reconciliation!.events.items.push({
      eventId: 42,
      observedAt: "2026-09-15T00:00:00Z",
      event: {
        type: "review.comment",
        data: { text: "Reconsider the test coverage" },
      },
    });
    t.setJudgment((stage) =>
      stage === "design"
        ? {
            decision: "review",
            reason: "Reassess new feedback",
            design: "Existing design remains sufficient",
          }
        : {
            decision: "pass",
            reason: "Feedback assessed",
            commit: t.git(t.worktree, "rev-parse", "HEAD"),
            findings: [],
          },
    );
    expect((await t.run(ctx)).state).toBe("converged");
    expect(t.calls.map((x) => x.stage)).toEqual([
      "design",
      "implementation",
      "review",
      "design",
      "review",
    ]);
  });

  test("GitHub CI/comment feedback reassesses and repairs the same Task instead of quietly reusing a local pass", async () => {
    const t = trial();
    await t.run();
    const before = t.git(t.worktree, "rev-parse", "HEAD");
    const ctx = t.context();
    ctx.reconciliation!.events.items.push({
      eventId: 215,
      observedAt: "2026-11-16T10:00:00Z",
      event: { type: "alex.github.pull-request.state", data: {
        resource: "github:hao1939/may-agent#215", headSha: before,
        feedback: { headSha: before, checks: [{ name: "remote-verify", conclusion: "failure" }],
          comments: [{ id: 1, bodyPreview: "Cover the missing remote environment case" }] },
      } },
    });
    t.setImplementation(() => {
      writeFileSync(join(t.worktree, "answer.cjs"), "'use strict';\nmodule.exports = () => 1;\n");
      t.git(t.worktree, "add", "answer.cjs");
      t.git(t.worktree, "commit", "-m", "repair assessed CI feedback");
    });
    const result = await t.run(ctx);
    expect(t.calls.map(({ stage }) => stage)).toEqual([
      "design", "implementation", "review", "design", "implementation", "review",
    ]);
    expect(t.prompts[3]).toContain("remote-verify");
    expect(t.prompts[3]).toContain("Cover the missing remote environment case");
    expect(t.git(t.worktree, "rev-parse", "HEAD")).not.toBe(before);
    expect(readFileSync(join(t.worktree, ".checks"), "utf8")).toBe("check\ncheck\n");
    expect(t.current.id).toBe("goal/trial");
    expect(t.current.outcome).toBe("Return 1");
    expect(result.state).toBe("converged"); // Local contribution, not remote acceptance.
    expect(result.result).not.toHaveProperty("taskDisposition");
  });

  test("informational input retains reports and permits judgment to reuse exact verification", async () => {
    const t = trial();
    await t.run();
    const reports = t.evidence().reports.map((r: any) => r.report.path);
    const ctx = t.context();
    ctx.reconciliation!.events.items.push({
      eventId: 91,
      observedAt: "2026-09-17T00:00:00Z",
      event: {
        type: "review.comment",
        data: { text: "Please summarize the existing evidence" },
      },
    });
    t.setJudgment((stage) =>
      stage === "design"
        ? {
            decision: "review",
            reason: "The current checks still fit",
            design: "Review retained work",
          }
        : {
            decision: "pass",
            reason: "Existing evidence is sufficient",
            commit: t.git(t.worktree, "rev-parse", "HEAD"),
            findings: [],
          },
    );
    const before = t.prompts.length;
    expect((await t.run(ctx)).state).toBe("converged");
    for (const report of reports) expect(t.prompts[before]).toContain(report);
    expect(t.calls.slice(before).map((c) => c.stage)).toEqual([
      "design",
      "review",
    ]);
    expect(readFileSync(join(t.worktree, ".checks"), "utf8")).toBe("check\n");
  });

  test("changed procedure checks cannot reuse a passing receipt", async () => {
    const t = trial();
    await t.run();
    const reports = t.evidence().reports.map((r: any) => r.report.path);
    const ctx = t.context();
    ctx.input = { prompt: "Implement", data: { verify: ["node", "-e", "process.exit(1)"] } };
    const before = t.prompts.length;
    expect((await t.run(ctx)).state).toBe("incomplete");
    for (const report of reports) expect(t.prompts[before]).toContain(report);
    expect(t.evidence().verified).toBeUndefined();
  });

  test("clarification returns ordinary caller feedback, without inventing a passive wait", async () => {
    const t = trial();
    t.setJudgment(() => ({
      decision: "clarify",
      reason: "Which offline behavior is required?",
      design: "Two materially different outcomes",
    }));
    expect(await t.run()).toMatchObject({ state: "incomplete", report: true });
    expect(t.calls).toHaveLength(1);
  });

  test("an exact setup clarification stops unchanged repair rounds while retaining the failed local check", async () => {
    const t = trial();
    t.current.acceptance.push(
      "Publish the eventual candidate and activate it after this local procedure",
    );
    t.setImplementation(() => {});
    t.setJudgment((stage) => {
      if (stage === "design")
        return {
          decision: "implement",
          reason: "First assess the local source candidate",
          design: "Keep the source requirement and run the selected local check",
        };
      if (
        stage === "implementation" &&
        t.calls.filter((call) => call.stage === "implementation").length === 1
      )
        return {
          decision: "ready",
          reason: "Candidate is ready for the required check",
        };
      return {
        decision: "clarify",
        reason:
          "SETUP dependency: Docker daemon access; owner: workspace operator; resume when docker info exits 0, then rerun the selected verification on this candidate",
      };
    });

    const result = await t.run();
    expect(result).toMatchObject({ state: "incomplete", report: true });
    expect(result.summary).toContain("SETUP dependency: Docker daemon access");
    expect(t.calls.map((call) => call.stage)).toEqual([
      "design",
      "implementation",
      "implementation",
    ]);
    expect(t.prompts[0]).toContain(
      "Keep the owning Task's wider acceptance visible as context",
    );
    expect(t.prompts[0]).toContain(
      "Publish the eventual candidate and activate it after this local procedure",
    );
    expect(t.prompts[2]).toContain("exact SETUP dependency");
    expect(t.prompts[2]).toContain("accountable owner");
    expect(readFileSync(join(t.worktree, ".checks"), "utf8")).toBe("check\n");
    const evidence = t.evidence();
    expect(evidence.roundsUsed).toBe(2);
    const verification = evidence.reports.find(
      (report: any) => report.stage === "verification",
    );
    expect(JSON.parse(readFileSync(verification.record.path, "utf8"))).toMatchObject({
      passed: false,
      receipt: { exitCode: 1 },
    });
  });

  test("invalid structured judgments fail closed and exhaust across invocations", async () => {
    const t = trial();
    t.setJudgment(() => ({ decision: "finished" }));
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      expect((await t.run()).state).toBe("incomplete");
      expect(t.calls).toHaveLength(attempt);
      expect(t.evidence().roundsUsed).toBe(attempt);
    }
    expect((await t.run()).state).toBe("incomplete");
    expect(t.calls).toHaveLength(3);
  });

  test("shared checkout is rejected before calling an agent", async () => {
    const t = trial();
    const ctx = t.context();
    ctx.workspace!.root = t.repo;
    expect((await t.run(ctx)).state).toBe("incomplete");
    expect(t.calls).toHaveLength(0);
  });
  test.each(["a", "汉"])(
    "large %s reports survive the aggregate UTF-8 result boundary",
    async (character) => {
      const t = trial();
      t.current.input = t.spec(0);
      t.current.outcome = t.spec(0).data.outcome;
      t.current.acceptance = t.spec(0).data.acceptance;
      const body = character.repeat(14_000);
      t.setJudgment((stage) =>
        stage === "design"
          ? { decision: "review", reason: body, design: body }
          : {
              decision: "pass",
              reason: body,
              findings: [],
              commit: t.git(t.worktree, "rev-parse", "HEAD"),
            },
      );
      const result = await t.run();
      expect(result.state).toBe("converged");
      expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThan(3000);
      const evidence = t.evidence();
      expect(evidence.design.design).toBe(body);
      expect(evidence.review.judgment.reason).toBe(body);
      const designRecord = JSON.parse(
        readFileSync(evidence.reports[0].record.path, "utf8"),
      );
      expect(designRecord.response.output.reason).toBe(body);
      const readable = readFileSync(evidence.reports[0].report.path, "utf8");
      expect(
        readable.split("\n").every((line) => Buffer.byteLength(line) < 2000),
      ).toBe(true);
      expect((await t.run()).state).toBe("converged");
      expect(t.calls).toHaveLength(2);
    },
  );

  test("review receives inspectable implementation identity and actual successful verification receipt", async () => {
    const t = trial();
    expect((await t.run()).state).toBe("converged");
    const evidence = t.evidence();
    const implementation = evidence.reports.find(
      (r: any) => r.stage === "implementation",
    );
    const verification = evidence.reports.find(
      (r: any) => r.stage === "verification",
    );
    const reviewPrompt = t.prompts.find((p) =>
      p.startsWith("Development step: review"),
    )!;
    expect(reviewPrompt).toContain(implementation.executionId);
    expect(reviewPrompt).toContain(implementation.report.path);
    expect(reviewPrompt).toContain(verification.report.path);
    const implementationRecord = JSON.parse(
      readFileSync(implementation.record.path, "utf8"),
    );
    expect(implementationRecord.response).toMatchObject({
      id: "step-2",
      summary: "step complete",
      output: { decision: "ready", reason: "Candidate committed" },
      facts: { retained: "execution evidence" },
    });
    expect(implementationRecord.execution).toMatchObject({
      id: "step-2",
      diagnostics: {
        cliCalls: [{
          sessionId: "step-2",
          toolCallId: "cli-step-2",
          tool: "codex",
          status: "completed",
        }],
        truncated: true,
      },
    });
    expect(
      readFileSync(implementation.report.path, "utf8"),
    ).toContain('"toolCallId": "cli-step-2"');
    const verified = JSON.parse(readFileSync(verification.record.path, "utf8"));
    expect(verified.passed).toBe(true);
    expect(verified.candidate.commit).toBe(evidence.review.candidate.commit);
    expect(verified.after).toEqual(verified.candidate);
    expect(verified.receipt).toMatchObject({
      argv: ["node", "verify.cjs", "1"],
      cwd: t.worktree,
      exitCode: 0,
      signal: null,
      stdout: "verification stdout\n",
      stderr: "verification stderr\n",
    });
    expect(t.git(t.worktree, "status", "--porcelain")).toBe("");
    const report = (t.current.result!.development as any).report;
    expect(readFileSync(report.path, "utf8")).toContain(
      "Task settlement and Request closure must be read from Runtime",
    );
  });

  test("a failed verification receipt survives repair and is supplied to tech-lead", async () => {
    const t = trial();
    t.setImplementation(() => {});
    expect((await t.run()).state).toBe("incomplete");
    const evidence = t.evidence();
    const verification = evidence.reports.find(
      (r: any) => r.stage === "verification",
    );
    const receipt = JSON.parse(readFileSync(verification.record.path, "utf8"));
    expect(receipt.passed).toBe(false);
    expect(receipt.receipt.exitCode).toBe(1);
    expect(receipt.receipt.stderr).toContain("AssertionError");
    expect(
      t.prompts.filter((p) =>
        p.startsWith("Development step: implementation"),
      )[1],
    ).toContain(verification.report.path);
    expect(evidence.verified).toBeUndefined();
  });

  test("a rejected delivery reuses checked evidence through Runtime previousAttempt", async () => {
    const t = trial();
    const result = await t.run();
    t.current.result = undefined; // The proposed report was never admitted.
    const ctx = t.context();
    ctx.reconciliation!.previousAttempt = {
      attemptId: "rejected-1",
      generation: 1,
      state: "failed",
      workspacePath: t.worktree,
      unacceptedResult: {
        attemptId: "rejected-1",
        settlementError: "settlement failed",
        summary: result.summary,
        result: result.result,
        facts: result.facts,
      },
    };
    expect((await t.run(ctx)).state).toBe("converged");
    expect(t.calls).toHaveLength(3);
    expect(readFileSync(join(t.worktree, ".checks"), "utf8")).toBe("check\n");
  });

  test.each(["generation", "workspace", "input"])(
    "rejected evidence cannot cross a changed %s",
    async (change) => {
      const t = trial();
      const result = await t.run();
      t.current.result = undefined;
      const ctx = t.context();
      ctx.reconciliation!.previousAttempt = {
        attemptId: "rejected-1",
        generation: change === "generation" ? 0 : 1,
        state: "failed",
        workspacePath: change === "workspace" ? t.repo : t.worktree,
        unacceptedResult: {
          attemptId: "rejected-1",
          settlementError: "settlement failed",
          summary: result.summary,
          result: result.result,
          facts: result.facts,
        },
      };
      if (change === "input")
        ctx.reconciliation!.events.items.push({
          eventId: 42,
          observedAt: "2026-09-17T00:00:00Z",
          event: {
            type: "review.comment",
            data: { text: "Reconsider coverage" },
          },
        });
      expect((await t.run(ctx)).state).toBe("converged");
      expect(t.calls.filter((c) => c.stage === "design")).toHaveLength(2);
      expect(readFileSync(join(t.worktree, ".checks"), "utf8")).toBe(
        "check\ncheck\n",
      );
    },
  );

  test.each(["missing", "corrupt"])(
    "%s evidence prevents quiet acceptance",
    async (damage) => {
      const t = trial();
      await t.run();
      const path = t
        .evidence()
        .reports.find((r: any) => r.stage === "verification").record.path;
      if (damage === "missing") rmSync(path);
      else writeFileSync(path, "{}");
      expect((await t.run()).state).toBe("converged");
      expect(t.calls.filter((c) => c.stage === "design")).toHaveLength(2);
      expect(readFileSync(join(t.worktree, ".checks"), "utf8")).toBe(
        "check\ncheck\n",
      );
    },
  );

  test("a changed candidate cannot inherit a previous passing receipt", async () => {
    const t = trial();
    await t.run();
    writeFileSync(join(t.worktree, "notes.md"), "A new committed change\n");
    t.git(t.worktree, "add", "notes.md");
    t.git(t.worktree, "commit", "-m", "new candidate");
    expect((await t.run()).state).toBe("converged");
    expect(t.calls.filter((c) => c.stage === "review")).toHaveLength(2);
    expect(readFileSync(join(t.worktree, ".checks"), "utf8")).toBe(
      "check\ncheck\n",
    );
  });

  test("archive failures cannot produce a completion claim", async () => {
    const t = trial();
    writeFileSync(join(t.repo, ".state"), "archive unavailable");
    const result = await t.run();
    expect(result.state).toBe("incomplete");
    expect(result.result).toBeUndefined();
    expect(t.calls.some((c) => c.stage === "review")).toBe(false);
  });
  test("current verification stays visible until the cumulative review limit", async () => {
    const t = trial();
    t.setJudgment((stage) =>
      stage === "design"
        ? {
            decision: "review",
            reason: "Existing candidate",
            design: "Review the current behavior",
          }
        : { decision: "invalid" },
    );
    t.current.input = t.spec(0);
    t.current.outcome = t.spec(0).data.outcome;
    t.current.acceptance = t.spec(0).data.acceptance;
    for (let attempt = 0; attempt < 3; attempt++)
      expect((await t.run()).state).toBe("incomplete");
    const evidence = t.evidence();
    const verification = evidence.reports.find(
      (r: any) => r.stage === "verification",
    );
    expect(evidence.roundsUsed).toBe(3);
    expect(t.prompts.at(-1)).toContain(verification.report.path);
    expect(readFileSync(join(t.worktree, ".checks"), "utf8")).toBe("check\n");
    expect(t.calls.filter((c) => c.stage === "design")).toHaveLength(1);
    expect(t.calls.filter((c) => c.stage === "review")).toHaveLength(3);
  });

  test("third-round success replays after exhaustion and rejected delivery", async () => {
    const t = trial();
    let reviews = 0;
    t.setJudgment((stage) => {
      if (stage === "design")
        return {
          decision: "review",
          reason: "Existing candidate",
          design: "Review the current behavior",
        };
      if (++reviews < 3) return { decision: "invalid" };
      return {
        decision: "pass",
        reason: "The exact verified candidate is correct",
        findings: [],
        commit: t.git(t.worktree, "rev-parse", "HEAD"),
      };
    });
    t.current.input = t.spec(0);
    t.current.outcome = t.spec(0).data.outcome;
    t.current.acceptance = t.spec(0).data.acceptance;

    expect((await t.run()).state).toBe("incomplete");
    expect((await t.run()).state).toBe("incomplete");
    const completed = await t.run();
    expect(completed.state).toBe("converged");
    expect(t.evidence().roundsUsed).toBe(3);
    expect(t.calls.filter((c) => c.stage === "review")).toHaveLength(3);
    expect(readFileSync(join(t.worktree, ".checks"), "utf8")).toBe("check\n");

    expect((await t.run(t.context())).state).toBe("converged");
    expect(t.calls.filter((c) => c.stage === "review")).toHaveLength(3);

    t.current.result = undefined;
    const rejected = t.context();
    rejected.reconciliation!.previousAttempt = {
      attemptId: "rejected-third-round",
      generation: 1,
      state: "failed",
      workspacePath: t.worktree,
      unacceptedResult: {
        attemptId: "rejected-third-round",
        settlementError: "settlement failed",
        summary: completed.summary,
        result: completed.result,
        facts: completed.facts,
      },
    };
    expect((await t.run(rejected)).state).toBe("converged");
    expect(t.calls.filter((c) => c.stage === "review")).toHaveLength(3);
    expect(readFileSync(join(t.worktree, ".checks"), "utf8")).toBe("check\n");
  });

  test("a fresh design can choose rereview without forcing implementation", async () => {
    const t = trial();
    t.current.input = t.spec(0);
    t.current.outcome = t.spec(0).data.outcome;
    t.current.acceptance = t.spec(0).data.acceptance;
    let reviews = 0;
    t.setJudgment((stage) => {
      if (stage === "design")
        return {
          decision: "review",
          reason: "Existing source is sufficient",
          design: "Inspect it against the requirement",
        };
      if (stage === "implementation")
        return { decision: "ready", reason: "No source change was needed" };
      return {
        decision: ++reviews === 1 ? "redesign" : "pass",
        reason: "Reconsider the interpretation",
        findings: [],
        commit: t.git(t.worktree, "rev-parse", "HEAD"),
      };
    });
    expect((await t.run()).state).toBe("converged");
    expect(t.calls.map((c) => c.stage)).toEqual([
      "design",
      "review",
      "design",
      "review",
    ]);
    expect(readFileSync(join(t.worktree, ".checks"), "utf8")).toBe("check\n");
  });

  test("standalone run() blocks the retained Task-aware procedure before effects", async () => {
    const root = mkdtempSync(join(tmpdir(), "develop-change-standalone-"));
    roots.push(root);
    const result = await run(
      "alex/develop-change",
      { prompt: "Implement", data: { verify: ["node", "-e", "process.exit(0)"] } },
      {
        cwd: root,
        projectRoot: resolve(import.meta.dirname, "../../../../.."),
        outputRoot: join(root, "output"),
        timeoutMs: 30_000,
      },
    );
    expect(result).toMatchObject({
      status: "blocked",
      summary: "Development requires an ordinary Task and its worktree",
    });
    expect(result.output).toBeUndefined();
    expect(existsSync(join(root, ".checks"))).toBe(false);
    expect(existsSync(join(root, ".state/alex-development"))).toBe(false);
  });
});
