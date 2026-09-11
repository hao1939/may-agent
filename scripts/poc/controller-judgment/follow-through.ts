import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Type, type Static } from "typebox";
import { Check } from "typebox/value";
import { runDirectAgent } from "../../../src/app/direct-agent.js";
import { createModelRegistry } from "../../../src/app/model-registry.js";
import { AppTaskController } from "../../../src/app/core/tasks/controller.js";
import { readAppTaskReconciliationEvents } from "../../../src/app/core/tasks/app-task-context.js";
import { AppTaskResourceStore } from "../../../src/app/core/state/app-task-resource-store.js";
import { admitTaskRequest } from "../../../src/app/core/state/inbox.js";
import { trackAppTaskConditionEventForTasks } from "../../../src/app/core/tasks/app-task-condition-tracker.js";
import {
  appTaskContext,
  claimObservedAppTask,
  completeAppTask,
  deferAppTask,
  observeAppTaskIntent,
  readAppTaskAdmissionOutcome,
  stopAppTask,
} from "../../../src/app/core/tasks/app-task-reconciler.js";

// A small experimental App decision, not a replacement for the public Task schema.
const explanation = {
  response: Type.String({ minLength: 1 }),
  reason: Type.String({ minLength: 1 }),
};
const decisionSchema = Type.Union([
  Type.Object(
    {
      decision: Type.Literal("delegate"),
      ...explanation,
      work: Type.Object({
        outcome: Type.String({ minLength: 1 }),
        acceptance: Type.Array(Type.String(), { minItems: 1 }),
      }),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      decision: Type.Literal("answer"),
      ...explanation,
      assessment: Type.Union([Type.Null(), Type.Object({ value: Type.Number(), acceptable: Type.Boolean() })]),
    },
    { additionalProperties: false },
  ),
  Type.Object({ decision: Type.Literal("give-up"), ...explanation }, { additionalProperties: false }),
]);
type Decision = Static<typeof decisionSchema>;
const argument = (name: string) => process.argv[process.argv.indexOf(name) + 1];
const model = process.argv.includes("--model") ? argument("--model") : undefined;
const output = process.argv.includes("--out") ? argument("--out") : undefined;
const value = process.argv.includes("--value") ? Number(argument("--value")) : 0.92;
if (!process.argv.includes("--live") || !model || !output || !Number.isFinite(value) || value < 0 || value > 1) {
  throw new Error("Use --live --model NAME --out DIRECTORY [--value NUMBER_0_TO_1]; this spends model tokens.");
}
const models = createModelRegistry();
if (!models[model]) throw new Error("The model is not configured in the Host registry");
const git = promisify(execFile);
const gitOptions = { cwd: resolve(import.meta.dir, "../../.."), timeout: 5_000 };
const sourceRevision = (await git("git", ["rev-parse", "HEAD"], gitOptions)).stdout.trim();
const sourceDirty = Boolean((await git("git", ["status", "--porcelain"], gitOptions)).stdout.trim());
const outputRoot = resolve(output);
mkdirSync(outputRoot, { recursive: true });
const root = mkdtempSync(join(tmpdir(), "may-follow-through-"));
const agentsRoot = join(root, "agents");
const agentDir = join(agentsRoot, "fixture-judge");
mkdirSync(agentDir, { recursive: true });
mkdirSync(join(root, "shared"));
writeFileSync(
  join(agentDir, "agent.json"),
  JSON.stringify({ name: "fixture-judge", description: "Judge synthetic work", domain: "fixture", model, tools: [] }),
);
writeFileSync(
  join(agentDir, "AGENTS.md"),
  `Judge the current input using the supplied evidence and earlier asks.
Reply helpfully, and only claim what the evidence supports. If independent work is needed, state its outcome and acceptance.
Code records and executes that work and brings back the evidence and original ask. Do not manage identities, subscriptions, polling, or wait procedures.
A reply does not close the Task or finish other pending work. continuedInputs are earlier asks whose awaited evidence is now supplied, not new requests.
Return your decision through finish().result. For a conceptual answer, assessment is null; assess a measured value only when evidence supports it.
These are fictional cases. No action changes a real service.
`,
);
const databasePath = join(root, "host.sqlite");
let store = AppTaskResourceStore.openStandalone(databasePath, "fixture");
store.bootstrapSnapshot(
  {
    project: "fixture",
    project_lifecycle: "active",
    root_task_id: "root",
    groups: { root: { id: "root", parent_id: null, owner: "owner" } },
  },
  "follow-through-fixture",
);
const context = () =>
  appTaskContext({ appDir: root, projectDir: root, agent: "owner", maxConcurrent: 1, resourceStore: store });
observeAppTaskIntent(context(), {
  appAgent: "owner",
  intent: {
    id: "owner",
    parentId: "root",
    mode: "maintain",
    outcome: "Discuss and return requested measurements",
    acceptance: ["Answer each ask honestly using its relevant evidence"],
  },
});
function ask(id: string, text: string) {
  admitTaskRequest(context(), {
    appId: "fixture",
    attachment: { kind: "existing", taskId: "owner" },
    idempotencyKey: `task:${id}`,
    request: { id, source: { kind: "human", id }, input: { kind: "message", data: { text } } },
  });
}

const report: Array<Record<string, unknown>> = [];
let sequence = 0;
let finishStep: (() => void) | undefined;
let failStep: ((error: unknown) => void) | undefined;
let childId: string | undefined;
function controller() {
  const runtime = new AppTaskController({
    maxConcurrent: 1,
    onError: (_id, error) => { runtime.close(); failStep?.(error); },
    reconcile: async (taskId) => {
      const claim = claimObservedAppTask(context(), {
        taskId,
        appAgent: "owner",
        handler: taskId === "owner" ? "agent" : "fixture-measurement",
      });
      if (claim.kind !== "claimed") throw new Error(`Expected claim for ${taskId}, got ${claim.kind}`);
      if (taskId !== "owner") {
        const ready = claim.events.some(({ event }) => event.type === "pipeline-run.state");
        if (!ready) {
          deferAppTask(context(), claim, {
            disposition: "waiting",
            summary: "Sample is being measured",
            conditions: [
              {
                id: "sample-ready",
                type: "pipeline-run.state",
                subject: "pipeline-run:sample-blue",
                expected: "completed",
                owner: "app:fixture",
                reviewAfterMs: 60_000,
              },
            ],
          });
          finishStep?.();
        } else {
          const accepted = completeAppTask(context(), claim, {
            summary: "Measured blue sample",
            result: { sample: "blue", value },
            evidence: ["fixture:measurement"],
          });
          if (!accepted.dependentTaskIds.includes("owner")) throw new Error("Child did not wake its owner");
          runtime.enqueue("owner");
        }
        return;
      }
      const events = readAppTaskReconciliationEvents(store, claim);
      const run = await runDirectAgent({
        agentName: "fixture-judge",
        task: JSON.stringify({ goal: claim.intent.outcome, events }),
        projectRoot: root,
        workRoot: root,
        agentsRoot,
        sharedRoot: join(root, "shared"),
        outputRoot,
        models,
        outputSchema: decisionSchema,
        timeoutMs: 90_000,
        sessionId: `follow-through-${++sequence}`,
      });
      if (run.status !== "done" || !Check(decisionSchema, run.structuredResult)) {
        throw new Error("The model did not return a valid decision; local transcript retained");
      }
      const decision = run.structuredResult as Decision;
      if (decision.decision === "delegate") {
        if (!decision.work || childId) throw new Error("Expected one supported measurement delegation");
        childId = "fixture-measurement"; // Assigned by code; absent from the model decision contract.
        deferAppTask(context(), claim, {
          disposition: "waiting",
          summary: decision.reason,
          response: decision.response,
          result: decision,
          evidence: ["input:measurement-request"],
          actions: [
            {
              kind: "create-task",
              id: childId,
              parentId: "owner",
              mode: "achieve",
              outcome: decision.work.outcome,
              acceptance: decision.work.acceptance,
              outputs: [],
            },
          ],
        });
        runtime.enqueue(childId);
      } else if (decision.decision === "answer") {
        completeAppTask(context(), claim, { summary: decision.reason, response: decision.response, result: decision });
      } else {
        stopAppTask(context(), claim, {
          summary: decision.reason,
          response: decision.response,
          result: decision,
          evidence: [],
        });
      }
      report.push({
        decision,
        durationMs: run.durationMs,
        acceptedState: store.readAttempt(claim.attemptId)?.acceptedResult?.state,
        continuedAskIds: events.continuedInputs?.map(({ event }) => (event.data.request as { id: string }).id) ?? [],
        attemptedTools: run.messages.flatMap((message) =>
          message.role === "assistant"
            ? message.content.flatMap((part) => (part.type === "toolCall" ? [part.name] : []))
            : [],
        ),
        usage: run.messages.flatMap((message) => (message.role === "assistant" ? [message.usage] : [])),
      });
      writeFileSync(
        join(outputRoot, "report.json"),
        JSON.stringify({ model, value, sourceRevision, sourceDirty, report }, null, 2),
      );
      console.log(JSON.stringify({ step: sequence, decision: decision.decision, durationMs: run.durationMs }));
      if (decision.decision !== "delegate") finishStep?.();
    },
  });
  return runtime;
}
let runtime = controller();
async function step(taskId: string) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await new Promise<void>((resolveStep, rejectStep) => {
      finishStep = resolveStep;
      failStep = rejectStep;
      timeout = setTimeout(() => rejectStep(new Error("Fixture step did not settle within two minutes")), 120_000);
      runtime.enqueue(taskId);
      runtime.enqueue(taskId); // Duplicate hints do not mean another accepted ask.
    });
  } finally {
    clearTimeout(timeout);
  }
}
let pass = false;
try {
  ask(
    "measurement",
    "Check whether the blue sample meets the 0.90 minimum. No measurement is available yet; obtain one through independent measurement work and return your assessment.",
  );
  await step("owner");
  if (!childId || report[0]?.acceptedState !== "waiting")
    throw new Error("The original ask was not delegated and retained");
  ask(
    "explanation",
    "While measurement continues, explain what a minimum threshold means. This is a separate discussion; no measurement is needed to explain it.",
  );
  await step("owner");
  const explanation = readAppTaskAdmissionOutcome(context(), "owner", "task:explanation");
  if (
    !explanation ||
    explanation.result?.decision !== "answer" ||
    explanation.result.assessment !== null ||
    readAppTaskAdmissionOutcome(context(), "owner", "task:measurement")
  ) {
    throw new Error("The intervening answer did not remain separate from the pending measurement");
  }
  runtime.close();
  await runtime.whenDrained();
  store.close();
  store = AppTaskResourceStore.openStandalone(databasePath, "fixture");
  runtime = controller();
  const ready = { type: "pipeline-run.state", eventId: 500, pipelineRunId: "sample-blue", state: "completed" };
  if (trackAppTaskConditionEventForTasks(context(), ready, [childId]).length !== 1)
    throw new Error("Measurement wake was not routed");
  await step(childId);
  const answer = readAppTaskAdmissionOutcome(context(), "owner", "task:measurement");
  const final = answer?.result as Decision | undefined;
  pass =
    final?.decision === "answer" &&
    final.assessment?.value === value &&
    final.assessment.acceptable === value >= 0.9 &&
    explanation.attemptId === readAppTaskAdmissionOutcome(context(), "owner", "task:explanation")?.attemptId &&
    report.length === 3 &&
    store.listRecoveryCandidates().items.length === 0;
  if (!pass) throw new Error("Final assessment, exact correlation, or quiet-state check failed");
} finally {
  runtime.close();
  await runtime.whenDrained();
  store.close();
  writeFileSync(
    join(outputRoot, "report.json"),
    JSON.stringify({ model, value, sourceRevision, sourceDirty, pass, report }, null, 2),
  );
  console.log(JSON.stringify({ pass, modelDecisions: report.length, value }));
}
