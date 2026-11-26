import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { SubagentManager } from "./manager.js";
import { closeDb } from "./db/connection.js";
import { getWorkflowRun } from "./db/workflows.js";
import type { RuntimeCtx } from "./runtime-ctx.js";
import {
  createWorkflowRunner,
  runWorkflowDirect,
  WorkflowHandlerUnavailable,
  type RunWorkflowDirectOpts,
} from "./workflow-tool.js";
import { runDirectWorkflow } from "@may-agent/sdk/runtime";
import { controlledWorkflowImport, observeBoundedResult } from "../../test/fixtures/workflow-import.js";

describe("direct workflow dispatch snapshot", () => {
  const roots: string[] = [];
  afterEach(() => {
    for (const root of roots.splice(0)) {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  function setup() {
    const root = mkdtempSync(join(tmpdir(), "workflow-dispatch-"));
    roots.push(root);
    const workflowDir = join(root, "workflows");
    mkdirSync(workflowDir);
    return {
      workflowDir,
      persistDir: root,
      agentName: "owner",
      workflowName: "versioned",
      task: "Run one captured workflow definition",
      manager: {} as SubagentManager,
      runtimeCtx: { emit: () => {}, log: () => {} } as unknown as RuntimeCtx,
    };
  }

  for (const status of ["done", "blocked"] as const) {
    it(`keeps ${status} execution, nested calls, provenance, and verification in one snapshot`, async () => {
      const opts = setup();
      function source(version: string) {
        return `
export const name = "versioned";
export const description = "Versioned execution and verification fixture";
export async function execute(ctx) {
  const child = await ctx.call("global/child", { prompt: "Run the captured child" });
  return ctx.${status}("${version}:" + child.summary);
}
export async function verify(_context, result) {
  return { accepted: (result.summary ?? result.reason) === "${version}:${version}", version: "${version}" };
}
`;
      }
      function childSource(version: string) {
        return `
export const name = "child";
export const description = "Nested snapshot fixture";
export async function execute(ctx) { return ctx.done("${version}"); }
`;
      }
      const oldSource = source("v1");
      const oldPath = join(opts.workflowDir, "a-v1.ts");
      const newPath = join(opts.workflowDir, "a-v2.ts");
      const oldChildPath = join(opts.workflowDir, "b-v1.ts");
      writeFileSync(oldPath, oldSource);
      writeFileSync(oldChildPath, childSource("v1"));
      // The last catalog entry deterministically simulates a source publication
      // after v1 was loaded. Distinct entry paths also avoid relying on Bun
      // test's handling of query-string cache busting for same-path imports.
      writeFileSync(
        join(opts.workflowDir, "z-publish.ts"),
        `
import { unlinkSync, writeFileSync } from "node:fs";
unlinkSync(${JSON.stringify(oldPath)});
unlinkSync(${JSON.stringify(oldChildPath)});
writeFileSync(${JSON.stringify(newPath)}, ${JSON.stringify(source("v2"))});
writeFileSync(${JSON.stringify(join(opts.workflowDir, "b-v2.ts"))}, ${JSON.stringify(childSource("v2"))});
export const name = "publish-fixture";
export const description = "Simulate a source change during catalog loading";
export async function execute(ctx) { return ctx.done("unused"); }
`,
      );

      const first = await runWorkflowDirect(opts);
      expect(first.result).toEqual(
        status === "done"
          ? { type: "done", summary: "v1:v1", output: undefined, facts: undefined }
          : { type: "blocked", reason: "v1:v1", context: undefined, output: undefined, facts: undefined },
      );
      expect(first.verifier?.sourcePath).toBe(oldPath);
      expect(await first.verifier?.verify({}, first.result)).toEqual({ accepted: true, version: "v1" });
      expect(getWorkflowRun(opts.persistDir, first.runId)).toMatchObject({
        workflow: "versioned",
        sourcePath: oldPath,
        entryContentHash: createHash("sha256").update(oldSource).digest("hex"),
      });

      // A snapshot is per dispatch, not a permanent runner/module cache.
      const second = await runWorkflowDirect(opts);
      expect(second.result).toEqual(
        status === "done"
          ? { type: "done", summary: "v2:v2", output: undefined, facts: undefined }
          : { type: "blocked", reason: "v2:v2", context: undefined, output: undefined, facts: undefined },
      );
      expect(second.verifier?.sourcePath).toBe(newPath);
      expect(await second.verifier?.verify({}, second.result)).toEqual({ accepted: true, version: "v2" });
      expect(await first.verifier?.verify({}, first.result)).toEqual({ accepted: true, version: "v1" });
    });
  }

  it("does not require a verifier", async () => {
    const opts = setup();
    writeFileSync(
      join(opts.workflowDir, "plain.ts"),
      `
export const name = "versioned";
export const description = "No verifier";
export async function execute(ctx) { return ctx.done("done"); }
`,
    );
    const result = await runWorkflowDirect(opts);
    expect(result.result).toMatchObject({ type: "done", summary: "done" });
    expect(result.verifier).toBeUndefined();
  });

  it("preserves missing-definition errors", async () => {
    await expect(runWorkflowDirect(setup())).rejects.toBeInstanceOf(WorkflowHandlerUnavailable);
  });

  it("rejects duplicate effective names with catalog diagnostics", async () => {
    const opts = setup();
    for (const entry of ["a", "b"]) {
      writeFileSync(
        join(opts.workflowDir, `${entry}.ts`),
        `
export const name = "versioned";
export const description = "Ambiguous definition";
export async function execute() { throw new Error("must not execute"); }
`,
      );
    }
    await expect(runWorkflowDirect(opts)).rejects.toThrow('Ambiguous agent workflow name "versioned"');
  });
});

describe("root preparation shares the invocation bound", () => {
  const roots: string[] = [];
  afterEach(() => {
    for (const root of roots.splice(0)) {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  function setup() {
    const root = mkdtempSync(join(tmpdir(), "root-preparation-"));
    roots.push(root);
    const workflowDir = join(root, "workflows");
    mkdirSync(workflowDir);
    mkdirSync(join(root, "agents"));
    const starts: string[] = [];
    const opts: RunWorkflowDirectOpts = {
      workflowDir,
      persistDir: root,
      agentName: "owner",
      workflowName: "slow-import",
      task: "bounded root",
      manager: {} as SubagentManager,
      runtimeCtx: { emit: () => {}, log: () => {} } as unknown as RuntimeCtx,
      onEvent: (event) => {
        if (event.type === "workflow.started") starts.push(event.workflow);
      },
    };
    return { root, opts, starts };
  }

  // Compare real Host adapters with the portable adapter, not a copied loader.
  for (const adapter of ["direct", "runner", "standalone"] as const) {
    async function invoke(opts: RunWorkflowDirectOpts) {
      if (adapter === "standalone") {
        const run = await runDirectWorkflow({
          projectRoot: opts.persistDir,
          workRoot: opts.persistDir,
          sharedRoot: opts.persistDir,
          agentsRoot: join(opts.persistDir, "agents"),
          outputRoot: join(opts.persistDir, "output"),
          workflowDir: opts.workflowDir,
          ...(opts.executionTimeoutMs === Number.MIN_VALUE
            ? { deadlineAt: Date.now() - 1, timeoutMs: 1000 }
            : { timeoutMs: opts.executionTimeoutMs }),
          agentName: opts.agentName,
          workflowName: opts.workflowName,
          input: { prompt: opts.task },
          models: {},
          signal: opts.signal,
        });
        return {
          type: run.ok ? "done" : "error",
          error: run.error ? String(run.error) : "",
          id: run.started ? run.report.executionId : undefined,
        };
      }
      if (adapter === "runner") {
        const run = await createWorkflowRunner({ ...opts, workflowDir: opts.workflowDir! }).run(
          opts.workflowName,
          opts.task,
        );
        return {
          type: run.type,
          error: run.type === "error" ? run.error : "",
          id: "workflowRunId" in run ? run.workflowRunId : undefined,
        };
      }
      try {
        const run = await runWorkflowDirect(opts);
        return { type: run.result.type, error: "", id: run.runId };
      } catch (error) {
        return { type: "error", error: String(error), id: undefined };
      }
    }

    function markerSource(marker: string, name = "slow-import") {
      return `
import { writeFileSync } from "node:fs";
writeFileSync(${JSON.stringify(marker)}, "imported");
export const name = ${JSON.stringify(name)};
export const description = "Must not start";
export async function execute(ctx) { return ctx.done("unexpected"); }
`;
    }

    for (const mode of ["pre-cancel", "expired", "invalid"] as const) {
      it(`${adapter}: ${mode} fences the first root import`, async () => {
        const { root, opts, starts } = setup();
        const marker = join(root, "first-import");
        writeFileSync(join(opts.workflowDir!, "a-root.ts"), markerSource(marker));
        if (mode === "pre-cancel") opts.signal = AbortSignal.abort(new Error("cancel before import"));
        // A positive sub-millisecond caller allowance has already expired at
        // the first import boundary (Date.now uses integer milliseconds).
        if (mode === "expired") opts.executionTimeoutMs = Number.MIN_VALUE;
        if (mode === "invalid") opts.executionTimeoutMs = 0;
        const stopped = await invoke(opts);
        expect(stopped.type).toBe("error");
        expect(stopped.id).toBeUndefined();
        expect(stopped.error).toContain(
          mode === "pre-cancel"
            ? "cancel before import"
            : mode === "expired"
              ? adapter === "standalone"
                ? "deadline expired"
                : "timed out"
              : "positive bounded",
        );
        expect(existsSync(marker)).toBe(false);
        expect(starts).toEqual([]);
      });
    }

    for (const mode of (adapter === "standalone"
      ? ["cancel", "timeout"]
      : ["cancel", "timeout", "ceiling"]) as readonly string[]) {
      it(`${adapter}: ${mode} settles before import release and fences later imports, body and child`, async () => {
        const { root, opts, starts } = setup();
        const gate = await controlledWorkflowImport(root);
        const later = join(root, "later-import");
        const body = join(root, "body-start");
        const child = join(root, "child-start");
        writeFileSync(
          join(opts.workflowDir!, "a-root.ts"),
          gate.source.replace(
            'return ctx.done("imported");',
            `const { writeFileSync } = await import("node:fs"); writeFileSync(${JSON.stringify(body)}, "body"); await ctx.call("global/child", { prompt: "must not start" }); return ctx.done("imported");`,
          ),
        );
        writeFileSync(
          join(opts.workflowDir!, "b-child.ts"),
          `
export const name = "child";
export const description = "Child start sentinel";
export async function execute(ctx) {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(${JSON.stringify(child)}, "child");
  return ctx.done("child");
}
`,
        );
        writeFileSync(join(opts.workflowDir!, "z-later.ts"), markerSource(later, "later"));
        const controller = new AbortController();
        opts.signal = controller.signal;
        opts.executionTimeoutMs = mode === "timeout" ? 200 : 10_000;
        if (mode === "ceiling") opts.executionTimeoutLimitMs = 200;
        let importEntered = false;
        void gate.started.then(() => { importEntered = true; });
        const run = invoke(opts);
        async function observed<T>(promise: Promise<T>, phase: string): Promise<T> {
          const observation = await observeBoundedResult(promise);
          if (!observation) throw new Error(`${adapter}/${mode}: ${phase} watchdog expired`);
          return observation.result;
        }
        try {
          await observed(gate.started, "import start");
          if (mode === "cancel") controller.abort(new Error("cancel during root import"));
          const stopped = await observed(run, "caller settlement before release");
          expect(stopped.type).toBe("error");
          expect(stopped.id).toBeUndefined();
          expect(stopped.error).toContain("unconfirmed");
          expect(stopped.error).toContain(mode === "cancel" ? "cancel during root import" : "timed out");
        } finally {
          gate.release();
          // Stop a still-running cancellation case even if import startup failed.
          controller.abort(new Error("controlled import test cleanup"));
          try {
            await observed(run, "caller settlement during cleanup");
          } finally {
            // Drain the loader continuation after releasing its native import,
            // even if the caller failed to settle within the cleanup watchdog.
            await new Promise<void>((resolve) => setImmediate(resolve));
            // A fenced import never resolves completed. Only drain imports that
            // entered, and watchdog cleanup too so failures cannot hang the suite.
            if (importEntered) await observed(gate.completed, "entered import completion during cleanup");
          }
        }
        expect(starts).toEqual([]);
        for (const marker of [later, body, child]) expect(existsSync(marker)).toBe(false);
      });
    }

    it(`${adapter}: preparation consumes the ${adapter === "standalone" ? "fallback" : "hard ceiling even with a longer declaration"}`, async () => {
      const { root, opts } = setup();
      const body = join(root, "body-start");
      const finished = join(root, "body-finished");
      const clockUrl = pathToFileURL(join(root, "clock.mjs")).href;
      writeFileSync(join(root, "clock.mjs"), `
let current = ${Date.now()};
export const now = () => current;
export const consumePreparation = () => { current += 9900; };
`);
      const clock = await import(clockUrl) as { now(): number };
      writeFileSync(
        join(opts.workflowDir!, "root.ts"),
        `
import { writeFileSync } from "node:fs";
import { consumePreparation } from ${JSON.stringify(clockUrl)};
consumePreparation();
export const name = "slow-import";
export const description = "Preparation and body each fit, their total does not";
${adapter === "standalone" ? "" : "export const executionTimeoutMs = 20000;"}
export async function execute(ctx) {
  writeFileSync(${JSON.stringify(body)}, "body");
  await new Promise((resolve, reject) => {
    const onAbort = () => { clearTimeout(timer); reject(ctx.signal.reason); };
    const timer = setTimeout(() => { ctx.signal.removeEventListener("abort", onAbort); resolve(); }, 180);
    ctx.signal.addEventListener("abort", onAbort, { once: true });
  });
  writeFileSync(${JSON.stringify(finished)}, "finished");
  return ctx.done("budget renewed incorrectly");
}
`,
      );
      opts.executionTimeoutMs = 10_000;
      if (adapter !== "standalone") opts.executionTimeoutLimitMs = 10_000;
      // Charge known preparation time without racing a native import or DB setup
      // against a short deadline. The real remaining-budget timer still aborts
      // the body before its longer work timer, even if the event loop is delayed.
      const now = spyOn(Date, "now").mockImplementation(clock.now);
      try {
        const stopped = await invoke(opts);
        expect(stopped.type).toBe("error");
        expect(stopped.error).toContain("timed out");
        expect(existsSync(body)).toBe(true);
        expect(existsSync(finished)).toBe(false);
      } finally {
        now.mockRestore();
      }
    });

    if (adapter !== "standalone") {
      it(`${adapter}: checks elapsed time between imports even before the timer fires`, async () => {
        const { root, opts, starts } = setup();
        const later = join(root, "later-import");
        writeFileSync(
          join(opts.workflowDir!, "a-blocking.ts"),
          `
// A synchronous JS import is not preemptible. Once it yields, no later
// import or body may start even if the timer has not run yet.
const until = Date.now() + 40;
while (Date.now() < until) {}
export const name = "slow-import";
export const description = "Synchronous import";
export async function execute() { throw new Error("must not start"); }
`,
        );
        writeFileSync(join(opts.workflowDir!, "z-later.ts"), markerSource(later, "later"));
        opts.executionTimeoutMs = 20;
        const stopped = await invoke(opts);
        expect(stopped.type).toBe("error");
        expect(stopped.id).toBeUndefined();
        expect(stopped.error).toContain("timed out");
        expect(existsSync(later)).toBe(false);
        expect(starts).toEqual([]);
      });

      it(`${adapter}: a declaration may shorten the caller bound`, async () => {
        const { opts } = setup();
        writeFileSync(
          join(opts.workflowDir!, "root.ts"),
          `
export const name = "slow-import";
export const description = "Shorter declared timeout";
export const executionTimeoutMs = 1000;
export async function execute(ctx) {
  await new Promise((resolve, reject) => {
    const onAbort = () => { clearTimeout(timer); reject(ctx.signal.reason); };
    const timer = setTimeout(() => { ctx.signal.removeEventListener("abort", onAbort); resolve(); }, 1200);
    ctx.signal.addEventListener("abort", onAbort, { once: true });
  });
  return ctx.done("declaration ignored");
}
`,
        );
        opts.executionTimeoutMs = 2000;
        const stopped = await invoke(opts);
        expect(stopped.type).toBe("error");
        expect(stopped.error).toContain("timed out after 1000ms");
      });
    }

    it(`${adapter}: a longer declaration overrides the environment fallback`, async () => {
      const { opts } = setup();
      writeFileSync(join(opts.workflowDir!, "root.ts"), `
export const name = "slow-import";
export const description = "Declaration overrides fallback";
export const executionTimeoutMs = 1000;
export async function execute(ctx) {
  await new Promise(resolve => setTimeout(resolve, 180));
  return ctx.done("declared allowance");
}
`);
      opts.executionTimeoutMs = 100;
      expect((await invoke(opts)).type).toBe("done");
    });

    for (const exhaustedDuringImport of [false, true]) {
      it(`${adapter}: declaration is anchored at preparation start (exhausted during import=${exhaustedDuringImport})`, async () => {
        const { root, opts } = setup();
        const body = join(root, "body-start");
        const finished = join(root, "body-finished");
        writeFileSync(join(opts.workflowDir!, "root.ts"), `
import { writeFileSync } from "node:fs";
await new Promise(resolve => setTimeout(resolve, ${exhaustedDuringImport ? 1150 : 700}));
export const name = "slow-import";
export const description = "Declaration includes preparation";
export const executionTimeoutMs = 1000;
export async function execute(ctx) {
  writeFileSync(${JSON.stringify(body)}, "body");
  await new Promise((resolve, reject) => {
    const onAbort = () => { clearTimeout(timer); reject(ctx.signal.reason); };
    const timer = setTimeout(() => { ctx.signal.removeEventListener("abort", onAbort); resolve(); }, 700);
    ctx.signal.addEventListener("abort", onAbort, { once: true });
  });
  writeFileSync(${JSON.stringify(finished)}, "finished");
  return ctx.done("must not renew");
}
`);
        opts.executionTimeoutMs = 3000;
        const result = await invoke(opts);
        expect(result.type).toBe("error");
        expect(result.error).toContain("timed out");
        expect(existsSync(body)).toBe(!exhaustedDuringImport);
        expect(existsSync(finished)).toBe(false);
      });
    }

    it(`${adapter}: ordinary root preparation dispatches successfully`, async () => {
      const { opts } = setup();
      writeFileSync(
        join(opts.workflowDir!, "root.ts"),
        `
export const name = "slow-import";
export const description = "Ordinary successful dispatch";
export async function execute(ctx) { return ctx.done("done"); }
`,
      );
      const result = await invoke(opts);
      expect(result.type).toBe("done");
      expect(result.id).toBeString();
    });
  }
});
