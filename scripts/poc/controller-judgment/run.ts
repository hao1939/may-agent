import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Type, type Static } from "typebox";
import { Check } from "typebox/value";
import { admitTaskReconcileResult, taskAgentResultSchema } from "../../../packages/sdk/src/task-contract.js";
import { appTaskAgentProtocol } from "../../../src/app/adapters/executors/managed-agent.js";
import { runDirectAgent } from "../../../src/app/direct-agent.js";
import { createModelRegistry } from "../../../src/app/model-registry.js";
import { AppTaskController } from "../../../src/app/core/tasks/controller.js";
import { readAppTaskReconciliationEvents } from "../../../src/app/core/tasks/app-task-context.js";
import { AppTaskResourceStore } from "../../../src/app/core/state/app-task-resource-store.js";
import {
  appTaskContext,
  claimObservedAppTask,
  completeAppTask,
  failAppTaskAttempt,
  observeAppTaskIntent,
  stopAppTask,
} from "../../../src/app/core/tasks/app-task-reconciler.js";

// Experimental App judgment contract, deliberately not a new public Host API.
const decisionSchema = Type.Object({
  decision: Type.Union([
    Type.Literal("answer"),
    Type.Literal("delegate"),
    Type.Literal("ask"),
    Type.Literal("give-up"),
    Type.Literal("wait"),
  ]),
  response: Type.String({ minLength: 1 }),
  reason: Type.String({ minLength: 1 }),
  work: Type.Optional(Type.Object({ outcome: Type.String(), acceptance: Type.Array(Type.String()) })),
});
type Decision = Static<typeof decisionSchema>;
type Scenario = {
  id: string;
  ask: string;
  evidence: Array<{ id: string; fact: string }>;
  acceptable: Decision["decision"][];
  childOpen?: boolean;
};

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const model = argument("--model");
const output = argument("--out");
const scenariosPath = argument("--scenarios");
const hostContract = process.argv.includes("--host-contract");
if (!process.argv.includes("--live") || !model || !output || !scenariosPath) {
  throw new Error("Use --live --model NAME --out DIRECTORY --scenarios FILE; this experiment spends model tokens.");
}
const cases = argument("--cases")?.split(",");
const availableScenarios: Scenario[] = JSON.parse(readFileSync(resolve(scenariosPath), "utf8"));
if (cases?.some((id) => !availableScenarios.some((scenario) => scenario.id === id))) {
  throw new Error("Every --cases ID must exist in the supplied scenarios file.");
}
const scenarios = availableScenarios.filter((scenario) => !cases || cases.includes(scenario.id));
if (
  hostContract &&
  scenarios.some((scenario) => scenario.acceptable.some((choice) => choice !== "answer" && choice !== "give-up"))
) {
  throw new Error(
    "The Host-contract smoke covers answer and give-up cases; cross-App dependency execution is not implemented by this harness.",
  );
}
const models = createModelRegistry();
if (!models[model]) throw new Error("The selected model is not configured in the Host registry.");
const outputRoot = resolve(output);
mkdirSync(outputRoot, { recursive: true });
const root = mkdtempSync(join(tmpdir(), "may-judgment-"));
const agentsRoot = join(root, "agents");
const agentDir = join(agentsRoot, "fixture-judge");
mkdirSync(agentDir, { recursive: true });
mkdirSync(join(root, "shared"), { recursive: true });
writeFileSync(
  join(agentDir, "agent.json"),
  JSON.stringify({ name: "fixture-judge", description: "Judge synthetic work", domain: "fixture", model, tools: [] }),
);
writeFileSync(
  join(agentDir, "AGENTS.md"),
  hostContract
    ? appTaskAgentProtocol("fixture")
    : `Judge the current ask using the supplied evidence. Explain a useful answer or the next useful work.
Only claim what the evidence supports. Weigh another attempt against its value and cost.
Return your judgment through finish().result. The finish status describes this judgment step.
Code owns recording, delegated execution and returning results; this trial tests that boundary.
You do not manage queues, task IDs, subscriptions, versions, retries, or closure procedures.
If independent work is useful, include its outcome and acceptance. Otherwise omit work.
These are isolated fictional cases; no action affects a real service.
`,
);

const report: Array<Record<string, unknown>> = [];
for (const scenario of scenarios) {
  const databasePath = join(root, `${scenario.id}.sqlite`);
  let store = AppTaskResourceStore.openStandalone(databasePath, "fixture");
  store.bootstrapSnapshot(
    {
      project: "fixture",
      project_lifecycle: "active",
      root_task_id: "root",
      groups: { root: { id: "root", parent_id: null, owner: "owner" } },
    },
    "controller-judgment-fixture",
  );
  const context = () =>
    appTaskContext({ appDir: root, projectDir: root, agent: "owner", maxConcurrent: 1, resourceStore: store });
  observeAppTaskIntent(context(), {
    intent: {
      id: "owner",
      parentId: "root",
      outcome: scenario.ask,
      acceptance: ["Explain the evidence honestly"],
      mode: "maintain",
    },
    appAgent: "owner",
  });

  // The code supplies exact accepted evidence. The agent never looks up attempt IDs.
  let evidence = scenario.evidence;
  let originalAttemptId: string | undefined;
  if (scenario.childOpen) {
    observeAppTaskIntent(context(), {
      intent: {
        id: "measurement",
        parentId: "owner",
        outcome: "Measure the assigned sample",
        acceptance: ["Report the measurement"],
        mode: "maintain",
      },
      appAgent: "owner",
    });
    const child = claimObservedAppTask(context(), { taskId: "measurement", appAgent: "owner", handler: "agent" });
    if (child.kind !== "claimed") throw new Error(`Fixture child did not claim: ${JSON.stringify(child)}`);
    originalAttemptId = child.attemptId;
    completeAppTask(context(), child, {
      summary: "Measurement verified",
      result: { evidence },
      evidence: evidence.map((item) => item.id),
      acceptanceBasis: { method: "deterministic", evidence: ["fixture:measurement"] },
    });
    store.close();
    store = AppTaskResourceStore.openStandalone(databasePath, "fixture");
  }

  let resolveDone!: () => void;
  let rejectDone!: (error: unknown) => void;
  const done = new Promise<void>((resolve, reject) => {
    resolveDone = resolve;
    rejectDone = reject;
  });
  const controller = new AppTaskController({
    maxConcurrent: 1,
    onError: (_taskId, error) => { controller.close(); rejectDone(error); },
    reconcile: async () => {
      const claim = claimObservedAppTask(context(), { taskId: "owner", appAgent: "owner", handler: "agent" });
      if (claim.kind !== "claimed") throw new Error(`Owner did not claim: ${claim.kind}`);
      if (scenario.childOpen) {
        const returned = readAppTaskReconciliationEvents(store, claim).items.find(
          ({ event }) => event.data.childTaskId === "measurement",
        )?.event.data;
        const accepted = returned?.acceptedResult as
          { state: string; result: { evidence: Scenario["evidence"] } } | undefined;
        if (returned?.resultAttemptId !== originalAttemptId || accepted?.state !== "converged") {
          throw new Error("Executor context did not supply the exact accepted child outcome");
        }
        evidence = accepted.result.evidence;
      }
      const run = await runDirectAgent({
        agentName: "fixture-judge",
        task: JSON.stringify({
          ask: scenario.ask,
          evidence: evidence.map((item) => item.fact),
          ...(hostContract
            ? {
                appId: "fixture",
                taskId: "owner",
                generation: claim.generation,
                outcome: scenario.ask,
                acceptance: ["Answer from evidence; do not claim unsupported success"],
                events: readAppTaskReconciliationEvents(store, claim),
                context:
                  "Isolated fixture. Existing App policy authorizes a give-up decision when the ask explicitly allows it. No real service is affected.",
              }
            : {}),
        }),
        projectRoot: root,
        workRoot: root,
        agentsRoot,
        sharedRoot: join(root, "shared"),
        outputRoot,
        models,
        outputSchema: hostContract ? taskAgentResultSchema : decisionSchema,
        timeoutMs: 90_000,
        sessionId: scenario.id,
      });
      const hostAdmission =
        hostContract && run.status === "done"
          ? admitTaskReconcileResult(run.structuredResult, { allowNeedsAgent: false })
          : undefined;
      const hostResult = hostAdmission?.ok ? hostAdmission.result : undefined;
      const valid =
        run.status === "done" && (hostContract ? Boolean(hostResult) : Check(decisionSchema, run.structuredResult));
      const decision: Decision | undefined = hostResult
        ? {
            decision: hostResult.state === "converged" ? "answer" : hostResult.state === "stopped" ? "give-up" : "wait",
            response: hostResult.response ?? hostResult.summary,
            reason: hostResult.summary,
          }
        : valid
          ? (run.structuredResult as Decision)
          : undefined;
      // Retain the evidence given to this judgment. Correlation is a code responsibility;
      // this records considered evidence, not a claim that every fact was cited or verified.
      const evidenceReferences = evidence.map((item) => item.id);
      let settlement: unknown;
      if (!decision) {
        settlement = failAppTaskAttempt(context(), claim, "Model trial returned invalid or unsupported judgment");
      } else if (decision.decision === "answer") {
        settlement = completeAppTask(
          context(),
          claim,
          hostResult ?? {
            summary: decision.reason,
            response: decision.response,
            result: decision,
            evidence: evidenceReferences,
          },
        );
      } else if (decision.decision === "give-up") {
        settlement = stopAppTask(
          context(),
          claim,
          hostResult ?? {
            summary: decision.reason,
            response: decision.response,
            result: decision,
            evidence: evidenceReferences,
          },
        );
      }
      // Delegate/ask/wait judgments are recorded for inspection only here.
      // The common-loop harness exercises typed delegation through real App admission.
      const attemptedTools = run.messages.flatMap((message) =>
        message.role === "assistant"
          ? message.content.flatMap((part) => (part.type === "toolCall" ? [part.name] : []))
          : [],
      );
      const usage = run.messages.flatMap((message) => (message.role === "assistant" ? [message.usage] : []));
      const acceptedState = store.readAttempt(claim.attemptId)?.acceptedResult?.state;
      const settlementPass = decision?.decision === "answer"
        ? acceptedState === "converged"
        : decision?.decision === "give-up"
          ? acceptedState === "stopped"
          : undefined; // Delegate/ask/wait cases only measure judgment here.
      const item = {
        scenario: scenario.id,
        model,
        contract: hostContract ? "host" : "experimental-judgment",
        status: run.status,
        valid,
        expectedDecision: scenario.acceptable,
        decisionPass: Boolean(decision && scenario.acceptable.includes(decision.decision)),
        settlementPass,
        decision,
        durationMs: run.durationMs,
        attemptedTools,
        usage,
        settlement,
        acceptedState,
        sourcePhase: store.readTask("owner")?.status.phase,
        childStillOpen: scenario.childOpen ? Boolean(store.readTask("measurement")) : undefined,
        originalAttemptId,
        databasePath,
        // Raw errors/transcripts remain local; do not publish provider details.
        ...(run.error ? { executionFailed: true } : {}),
      };
      report.push(item);
      writeFileSync(join(outputRoot, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
      console.log(
        JSON.stringify({
          scenario: item.scenario,
          decision: decision?.decision,
          decisionPass: item.decisionPass,
          settlementPass: item.settlementPass,
          acceptedState: item.acceptedState,
          durationMs: item.durationMs,
        }),
      );
      resolveDone();
    },
  });
  try {
    controller.enqueue("owner");
    controller.enqueue("owner"); // Duplicate wake coalesces before claiming.
    await done;
  } finally {
    controller.close();
    await controller.whenDrained();
    store.close();
  }
}
if (report.some((item) => !item.decisionPass || item.settlementPass === false)) process.exitCode = 1;
