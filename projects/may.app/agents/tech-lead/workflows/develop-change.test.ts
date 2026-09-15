import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  admitTaskReconcileResult,
  type TaskDetail,
  type TaskReconcileResult,
  type WorkflowContext,
} from "@may-agent/sdk";
import {
  createTestAppRead,
  createTestAppWorkflowContext,
} from "@may-agent/sdk/testing";
import { execute } from "./develop-change.js";
import app, { taskForMayInput } from "../../../app.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

function trial() {
  const root = mkdtempSync(join(tmpdir(), "may-development-test-"));
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
  writeFileSync(join(repo, ".gitignore"), ".checks\n");
  writeFileSync(join(repo, "answer.cjs"), "module.exports = () => 0;\n");
  writeFileSync(
    join(repo, "verify.cjs"),
    `require('node:fs').appendFileSync('.checks', 'check\\n'); require('node:assert/strict').equal(require('./answer.cjs')(), Number(process.argv[2]));\n`,
  );
  git(repo, "add", ".");
  git(repo, "commit", "-m", "baseline");
  git(repo, "worktree", "add", "-b", "task/development", worktree);
  const spec = (expected: number) => ({
    kind: "development",
    data: {
      outcome: `Return ${expected}`,
      acceptance: [`The function returns ${expected}`],
      verify: ["node", "verify.cjs", String(expected)],
    },
  });
  const current: TaskDetail = {
    id: "goal/trial",
    parentId: "may",
    generation: 1,
    status: "running",
    outcome: spec(1).data.outcome,
    acceptance: spec(1).data.acceptance,
    input: spec(1),
    conditions: [],
  };
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
  const context = (signal = new AbortController().signal): WorkflowContext =>
    createTestAppWorkflowContext({
      input: current.input,
      signal,
      reconciliation: {
        appId: "may",
        taskId: current.id,
        generation: current.generation,
        resourceVersion: 1,
        agent: "may-tech-lead",
        owner: "may-tech-lead",
        outcome: current.outcome,
        acceptance: current.acceptance,
        input: current.input,
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
          outcomes: async () => {
            throw Error("unused");
          },
          get: async () => current,
        },
      }),
      callAgent: (async (
        agent: string,
        prompt: string,
        options: { tools?: unknown },
      ) => {
        const stage =
          /^Development step: ([^.]+)/.exec(prompt)?.[1] ?? "unknown";
        calls.push({ agent, stage, tools: options.tools });
        return {
          id: `step-${calls.length}`,
          kind: "agent",
          status: "done",
          summary: "step complete",
          output: judgment(stage),
        };
      }) as WorkflowContext["agents"]["call"],
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
  test("admission selects the App-local workflow through the existing Task route", () => {
    const t = trial();
    const admitted = taskForMayInput({
      id: "request",
      source: { kind: "app", id: "may" },
      input: t.current.input as any,
    });
    expect(admitted).toMatchObject({
      kind: "desired",
      intent: {
        agent: "may-tech-lead",
        workflow: "develop-change",
        input: t.current.input,
      },
    });
    expect(app.tasks?.maxConcurrent).toBe(4);
    expect(app.workspace).toEqual({
      kind: "git",
      localPath: ".",
      branch: "main",
    });
  });

  test("design → direct implementation → real checks → read-only review, then quiet replay", async () => {
    const t = trial();
    expect((await t.run()).state).toBe("converged");
    expect(t.calls).toEqual([
      { agent: "may-bob", stage: "design", tools: "readonly" },
      { agent: "may-tech-lead", stage: "implementation", tools: "full" },
      { agent: "may-bob", stage: "review", tools: "readonly" },
    ]);
    expect(readFileSync(join(t.worktree, ".checks"), "utf8")).toBe("check\n");
    const ctx = t.context(); // A fresh invocation; only Task result and repository survive.
    expect((await t.run(ctx)).state).toBe("converged");
    expect(t.calls).toHaveLength(3);
    expect(readFileSync(join(t.repo, "answer.cjs"), "utf8")).toContain("=> 0");
  });

  test("a completion claim cannot bypass a failing command or obtain a review", async () => {
    const t = trial();
    t.setImplementation(() => {});
    expect((await t.run()).state).toBe("incomplete");
    expect(t.calls.filter((x) => x.stage === "implementation")).toHaveLength(3);
    expect(t.calls.some((x) => x.stage === "review")).toBe(false);
    expect(readFileSync(join(t.worktree, ".checks"), "utf8")).toBe(
      "check\ncheck\ncheck\n",
    );
    // The next ordinary invocation continues the same work after exhaustion.
    t.setImplementation(() => {
      writeFileSync(
        join(t.worktree, "answer.cjs"),
        "module.exports = () => 1;\n",
      );
      t.git(t.worktree, "add", "answer.cjs");
      t.git(t.worktree, "commit", "-m", "repair on continuation");
    });
    expect((await t.run()).state).toBe("converged");
    expect(t.calls.filter((x) => x.stage === "design")).toHaveLength(1);
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

  test.each(["verification", "review", "contradictory pass"])(
    "%s cannot certify inconsistent evidence",
    async (phase) => {
      const t = trial();
      t.current.input = t.spec(0);
      t.current.outcome = t.spec(0).data.outcome;
      t.current.acceptance = t.spec(0).data.acceptance;
      if (phase === "verification") {
        t.current.input.data.verify = [
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
          findings:
            phase === "contradictory pass" ? ["Acceptance is not met"] : [],
        };
      });
      const result = await t.run();
      expect(result.state).toBe("incomplete");
      expect(result.summary).toContain(
        phase === "verification"
          ? "uncommitted"
          : phase === "review"
            ? "does not match"
            : "retains findings",
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
  });

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

  test("invalid structured judgment does not advance the process", async () => {
    const t = trial();
    t.setJudgment(() => ({ decision: "finished" }));
    expect((await t.run()).state).toBe("incomplete");
    expect(t.calls).toHaveLength(1);
  });

  test("shared checkout is rejected before calling an agent", async () => {
    const t = trial();
    const ctx = t.context();
    ctx.workspace!.root = t.repo;
    expect((await t.run(ctx)).state).toBe("incomplete");
    expect(t.calls).toHaveLength(0);
  });
});
