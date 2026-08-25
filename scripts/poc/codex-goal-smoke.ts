import { resolve } from "node:path";
import { CodexGoalAppServerClient } from "../../src/app/codex-goal-client.js";
import { admitCodexGoalTaskResult } from "../../src/app/codex-goal-result.js";
import { sampleProcessTreeRssKiB } from "./codex-goal-resources.js";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const cwd = resolve(argument("--cwd") ?? process.cwd());
const existingThreadId = argument("--thread");
const goal = argument("--goal") ?? "Prove that a resumable Codex thread can advance one bounded May Task attempt.";
const prompt =
  argument("--prompt") ??
  "Read package.json and briefly report what the verify command does. Do not edit files. Before answering, run `sleep 3` so the client can test live steering.";
const steering = argument("--steer") ?? "Also state explicitly whether the verify command deploys the application.";
const steerDelayMs = Number(argument("--steer-delay-ms") ?? 750);
const startPausedMs = Number(argument("--start-paused-ms") ?? 0);
const interruptAfterMs = Number(argument("--interrupt-after-ms") ?? 0);
const sandboxArg = argument("--sandbox") ?? "read-only";
if (sandboxArg !== "read-only" && sandboxArg !== "workspace-write" && sandboxArg !== "danger-full-access") {
  throw new Error(`Unsupported --sandbox value ${sandboxArg}`);
}
const sandbox = sandboxArg;

const startedAtMs = performance.now();
const client = CodexGoalAppServerClient.spawn({ cwd });
const activity: Array<{ at: string; method: string }> = [];
let firstActivityAtMs: number | null = null;
let peakProcessTreeRssKiB: number | null = null;
let sampleInFlight = false;
const sampleResources = async () => {
  if (sampleInFlight) return;
  sampleInFlight = true;
  try {
    const rss = await sampleProcessTreeRssKiB(client.diagnostics().processId);
    if (rss !== null) peakProcessTreeRssKiB = Math.max(peakProcessTreeRssKiB ?? 0, rss);
  } finally {
    sampleInFlight = false;
  }
};
const resourceTimer = setInterval(() => void sampleResources(), 250);
resourceTimer.unref();
const unsubscribe = client.onNotification((notification) => {
  firstActivityAtMs ??= performance.now();
  if (
    notification.method === "turn/started" ||
    notification.method === "turn/completed" ||
    notification.method === "thread/status/changed" ||
    notification.method === "item/started" ||
    notification.method === "item/completed"
  ) {
    activity.push({ at: new Date().toISOString(), method: notification.method });
  }
});

function finalAnswer(readResult: unknown): string | null {
  if (!readResult || typeof readResult !== "object") return null;
  const thread = (readResult as { thread?: unknown }).thread;
  if (!thread || typeof thread !== "object") return null;
  const turns = (thread as { turns?: unknown }).turns;
  if (!Array.isArray(turns)) return null;
  for (const turn of [...turns].reverse()) {
    if (!turn || typeof turn !== "object") continue;
    const items = (turn as { items?: unknown }).items;
    if (!Array.isArray(items)) continue;
    for (const item of [...items].reverse()) {
      if (!item || typeof item !== "object") continue;
      const candidate = item as { type?: unknown; phase?: unknown; text?: unknown };
      if (
        candidate.type === "agentMessage" &&
        candidate.phase === "final_answer" &&
        typeof candidate.text === "string"
      ) {
        return candidate.text;
      }
    }
  }
  return null;
}

async function main(): Promise<void> {
  try {
    await client.initialize();
    const initializedAtMs = performance.now();
    const binding = existingThreadId
      ? await client.resumeThread({ threadId: existingThreadId, cwd, sandbox })
      : await client.startThread({ cwd, sandbox });
    const objective = `${goal}\n\nCurrent Task context:\n${prompt}`;
    if (startPausedMs > 0) {
      await client.setGoal({ threadId: binding.threadId, objective, status: "paused" });
      await Bun.sleep(startPausedMs);
    }
    await client.setGoal({ threadId: binding.threadId, objective, status: "active" });
    const turnId = await client.waitForActiveTurn(binding.threadId);

    if (interruptAfterMs > 0) {
      await Bun.sleep(interruptAfterMs);
      await client.setGoal({ threadId: binding.threadId, objective, status: "paused" });
      await client.interrupt({ threadId: binding.threadId, turnId });
      const interrupted = await client.waitForTurn(turnId);
      const thread = await client.readThread(binding.threadId, true);
      await sampleResources();
      process.stdout.write(
        `${JSON.stringify(
          {
            threadId: binding.threadId,
            turnId,
            goalStatus: "paused",
            turnStatus: interrupted.turn.status,
            activity,
            measurements: {
              initializeMs: Math.round(initializedAtMs - startedAtMs),
              firstActivityMs: firstActivityAtMs === null ? null : Math.round(firstActivityAtMs - startedAtMs),
              elapsedMs: Math.round(performance.now() - startedAtMs),
              peakProcessTreeRssKiB,
              protocol: client.diagnostics(),
              threadSnapshotBytes: Buffer.byteLength(JSON.stringify(thread)),
            },
            ...(process.argv.includes("--include-thread") ? { thread } : {}),
          },
          null,
          2,
        )}\n`,
      );
      return;
    }

    await Bun.sleep(steerDelayMs);
    let steeringOutcome: "accepted" | "replay-next-attempt" = "accepted";
    try {
      await client.steer({ threadId: binding.threadId, turnId, message: steering });
    } catch {
      // Exact-turn precondition failure means the durable event must be included
      // in the next May reconciliation attempt rather than guessed onto a new turn.
      steeringOutcome = "replay-next-attempt";
    }
    const terminalGoal = await client.waitForGoal(
      binding.threadId,
      (observation) => observation.goal.status !== "active",
    );
    const terminalTurnId = terminalGoal.turnId ?? turnId;
    const completed = await client.waitForTurn(terminalTurnId);
    const thread = await client.readThread(binding.threadId, true);
    const answer = finalAnswer(thread);
    let structuredResult: unknown = null;
    try {
      structuredResult = answer ? JSON.parse(answer) : null;
    } catch {
      // A non-JSON result is valid for the exploratory smoke, but a production
      // Task adapter would reject it at normal Task result admission.
    }
    const taskResultAdmission = admitCodexGoalTaskResult(answer, {
      allowNeedsAgent: false,
      defaultParentId: argument("--default-parent") ?? "poc-root",
    });
    await sampleResources();
    process.stdout.write(
      `${JSON.stringify(
        {
          threadId: binding.threadId,
          turnId,
          terminalTurnId,
          goalStatus: terminalGoal.goal.status,
          turnStatus: completed.turn.status,
          steeringOutcome,
          activity,
          finalAnswer: answer,
          structuredResult,
          taskResultAdmission,
          measurements: {
            initializeMs: Math.round(initializedAtMs - startedAtMs),
            firstActivityMs: firstActivityAtMs === null ? null : Math.round(firstActivityAtMs - startedAtMs),
            elapsedMs: Math.round(performance.now() - startedAtMs),
            peakProcessTreeRssKiB,
            protocol: client.diagnostics(),
            threadSnapshotBytes: Buffer.byteLength(JSON.stringify(thread)),
            finalAnswerBytes: answer === null ? 0 : Buffer.byteLength(answer),
            rawThreadIncluded: process.argv.includes("--include-thread"),
          },
          ...(process.argv.includes("--include-thread") ? { thread } : {}),
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    clearInterval(resourceTimer);
    unsubscribe();
    await client.stop();
  }
}

await main();
