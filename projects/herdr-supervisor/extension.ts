import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { HerdrClient } from "./src/herdr-client.js";
import { formatObservation, observeWorker } from "./src/observation.js";
import { ReviewTurnFence } from "./src/review-turn.js";
import { loadState, updateState } from "./src/store.js";
import {
  findAgent,
  findPane,
  formatWorker,
  DEFAULT_REVIEW_INTERVAL_MS,
  dueBindings,
  identityMismatch,
  liveWorker,
  nextReviewDelay,
  registerBinding,
  recoveryRequest,
  removeBinding,
  reviewMessage,
  shouldWake,
} from "./src/supervision.js";

const Pane = Type.String({ description: "Exact Herdr pane ID, for example w1:p2" });
const client = new HerdrClient();
const supervisorTools = [
  "supervisor_status",
  "supervisor_observe",
  "supervisor_steer",
  "supervisor_ask_human",
  "supervisor_recover",
  "supervisor_finish",
];
type SupervisorMode = "observe" | "dry-run" | "live";
type ReviewSignal = { force: boolean; reason: string; key: string };

function text(value: string, isError = false) {
  return { content: [{ type: "text" as const, text: value }], isError };
}

export default function herdrSupervisor(pi: ExtensionAPI) {
  let stopSubscription: undefined | (() => void);
  let reconnectTimer: undefined | ReturnType<typeof setTimeout>;
  let reviewTimer: undefined | ReturnType<typeof setTimeout>;
  const pendingSignals = new Map<string, ReviewSignal | undefined>();
  let preparingReviewPane: string | undefined;
  let activeReviewPane: string | undefined;
  let reviewPumpRunning = false;
  let shuttingDown = false;
  let reconnectDelay = 250;
  const reviewTurn = new ReviewTurnFence();

  pi.registerFlag("supervisor-mode", {
    description: "Supervision authority: observe, dry-run, or live",
    type: "string",
    default: process.env.HERDR_SUPERVISOR_MODE || "observe",
  });

  pi.registerFlag("supervisor-review-ms", {
    description: "Time without a supervision review before a stale-progress check",
    type: "string",
    default: process.env.HERDR_SUPERVISOR_REVIEW_MS || String(DEFAULT_REVIEW_INTERVAL_MS),
  });

  function mode(): SupervisorMode {
    const value = pi.getFlag("supervisor-mode");
    return value === "live" || value === "dry-run" ? value : "observe";
  }

  function reviewIntervalMs() {
    const value = Number(pi.getFlag("supervisor-review-ms"));
    return Number.isFinite(value) && value >= 1000 ? value : DEFAULT_REVIEW_INTERVAL_MS;
  }

  async function armReviewTimer() {
    if (reviewTimer) clearTimeout(reviewTimer);
    reviewTimer = undefined;
    if (shuttingDown) return;
    const state = await loadState();
    const waiting = state.workers.filter(
      (worker) => !pendingSignals.has(worker.paneId)
        && preparingReviewPane !== worker.paneId
        && activeReviewPane !== worker.paneId,
    );
    const delay = nextReviewDelay(waiting);
    if (delay === undefined) return;
    reviewTimer = setTimeout(() => {
      reviewTimer = undefined;
      void reviewDueWorkers();
    }, Math.min(delay, 2_147_483_647));
    reviewTimer.unref?.();
  }

  async function reviewDueWorkers() {
    const state = await loadState();
    const due = dueBindings(state.workers.filter(
      (worker) => !pendingSignals.has(worker.paneId)
        && preparingReviewPane !== worker.paneId
        && activeReviewPane !== worker.paneId,
    ));
    if (due.length) {
      const nextReviewAt = new Date(Date.now() + reviewIntervalMs()).toISOString();
      const panes = new Set(due.map((binding) => binding.paneId));
      await updateState((next) => {
        for (const binding of next.workers) {
          if (panes.has(binding.paneId)) binding.nextReviewAt = nextReviewAt;
        }
        return next;
      });
    }
    try {
      for (const binding of due) {
        handleSignal(binding.paneId, {
          force: true,
          reason: "review deadline elapsed",
          key: `deadline:${binding.nextReviewAt || "recovery"}`,
        });
      }
    } finally {
      await armReviewTimer();
    }
  }

  async function status(paneId?: string) {
    const [state, snapshot] = await Promise.all([loadState(), client.snapshot()]);
    const bindings = paneId ? state.workers.filter((worker) => worker.paneId === paneId) : state.workers;
    if (!bindings.length) return paneId ? `${paneId} is not supervised.` : "No supervised workers.";
    return bindings.map((binding) => formatWorker(liveWorker(binding, snapshot))).join("\n\n");
  }

  function handleSignal(paneId: string, signal?: ReviewSignal) {
    if (!pendingSignals.has(paneId) || signal?.force) pendingSignals.set(paneId, signal);
    void drainSignals();
  }

  async function reconsiderCurrentBindings() {
    const [state, snapshot] = await Promise.all([loadState(), client.snapshot()]);
    for (const binding of state.workers) {
      const decision = shouldWake(
        binding,
        findAgent(snapshot, binding.paneId),
        findPane(snapshot, binding.paneId),
      );
      if (decision.wake && binding.lastNoticeKey !== decision.key) handleSignal(binding.paneId);
    }
  }

  async function drainSignals() {
    if (shuttingDown || reviewPumpRunning || activeReviewPane) return;
    reviewPumpRunning = true;
    try {
      while (!shuttingDown && !activeReviewPane && pendingSignals.size) {
        const next = pendingSignals.entries().next().value as [string, ReviewSignal | undefined];
        const [paneId, signal] = next;
        pendingSignals.delete(paneId);
        preparingReviewPane = paneId;
        try {
          await handleSignalOnce(paneId, signal);
        } finally {
          preparingReviewPane = undefined;
        }
      }
    } finally {
      reviewPumpRunning = false;
      if (!shuttingDown && !activeReviewPane && pendingSignals.size) void drainSignals();
    }
  }

  async function handleSignalOnce(
    paneId: string,
    signal?: ReviewSignal,
  ) {
    const [state, snapshot] = await Promise.all([loadState(), client.snapshot()]);
    const binding = state.workers.find((worker) => worker.paneId === paneId);
    if (!binding) return;
    const agent = findAgent(snapshot, paneId);
    const pane = findPane(snapshot, paneId);
    const currentDecision = shouldWake(binding, agent, pane);
    const decision = signal?.force && !identityMismatch(binding, agent, pane)
      ? {
          wake: true,
          reason: signal.reason,
          sequence: agent ? Number(agent.state_change_seq || 0) : undefined,
          key: signal.key,
        }
      : currentDecision;
    if (!decision.wake || binding.lastNoticeKey === decision.key) return;
    await updateState((next) => {
      const current = next.workers.find((worker) => worker.paneId === paneId);
      if (current) {
        current.lastNoticeKey = decision.key;
        current.nextReviewAt = new Date(Date.now() + reviewIntervalMs()).toISOString();
        if (decision.sequence !== undefined) current.lastObservedStateChangeSeq = decision.sequence;
      }
      return next;
    });
    const currentMode = mode();
    if (currentMode !== "observe") {
      activeReviewPane = paneId;
      reviewTurn.begin(paneId);
    }
    pi.sendMessage(
      {
        customType: "herdr-supervisor-review",
        content: `${reviewMessage(binding, agent, decision.reason)}\n\nSupervisor mode: ${currentMode}.`,
        display: true,
      },
      { triggerTurn: currentMode !== "observe", deliverAs: "followUp" },
    );
    if (!signal?.force) await armReviewTimer();
  }

  async function connectObserver() {
    stopSubscription?.();
    stopSubscription = undefined;
    if (shuttingDown) return;
    const state = await loadState();
    if (!state.workers.length) return;
    const subscriptions = state.workers.flatMap((worker) => [
      { type: "pane.agent_status_changed", pane_id: worker.paneId },
      { type: "pane.exited", pane_id: worker.paneId },
    ]);
    stopSubscription = client.subscribe(
      subscriptions,
      (event) => {
        const paneId = event?.data?.pane_id;
        if (typeof paneId === "string") void handleSignal(paneId);
      },
      () => {
        stopSubscription = undefined;
        if (shuttingDown || reconnectTimer) return;
        reconnectTimer = setTimeout(() => {
          reconnectTimer = undefined;
          void connectObserver();
        }, reconnectDelay);
        reconnectTimer.unref?.();
        reconnectDelay = Math.min(reconnectDelay * 2, 5000);
      },
      () => {
        reconnectDelay = 250;
        void reconsiderCurrentBindings().catch(() => armReviewTimer());
      },
    );
  }

  async function register(paneId: string, goal: string, acceptance: string[]) {
    const snapshot = await client.snapshot();
    const agent = findAgent(snapshot, paneId);
    if (!agent) throw new Error(`no observable agent in ${paneId}`);
    let binding;
    await updateState((state) => {
      binding = registerBinding(state, agent, goal, acceptance, new Date(), reviewIntervalMs());
      return state;
    });
    await connectObserver();
    await armReviewTimer();
    if (shouldWake(binding!, agent, findPane(snapshot, paneId)).wake) void handleSignal(binding!.paneId);
    return binding!;
  }

  pi.registerTool({
    name: "supervisor_status",
    label: "Supervised workers",
    description: "Show supervised goals against fresh Herdr worker state.",
    parameters: Type.Object({ pane_id: Type.Optional(Pane) }),
    executionMode: "parallel",
    async execute(_id, params) {
      const fenceError = reviewTurn.guard(params.pane_id);
      if (fenceError) return text(fenceError, true);
      if (activeReviewPane && !params.pane_id) {
        return text(`This review is scoped to ${activeReviewPane}. Use supervisor_observe for that exact worker.`, true);
      }
      try { return text(await status(params.pane_id)); }
      catch (error) { return text(`Could not read supervisor status: ${error.message}`, true); }
    },
  });

  pi.registerTool({
    name: "supervisor_observe",
    label: "Review worker",
    description: "Read bounded current output from one supervised worker after validating its exact terminal and native agent-session identity.",
    parameters: Type.Object({ pane_id: Pane, lines: Type.Optional(Type.Integer({ minimum: 10, maximum: 200 })) }),
    executionMode: "parallel",
    async execute(_id, params) {
      const fenceError = reviewTurn.beginObservation(params.pane_id);
      if (fenceError) return text(fenceError, true);
      let observed = false;
      try {
        const [state, snapshot] = await Promise.all([loadState(), client.snapshot()]);
        const binding = state.workers.find((worker) => worker.paneId === params.pane_id);
        if (!binding) return text(`${params.pane_id} is not supervised.`, true);
        const agent = findAgent(snapshot, params.pane_id);
        const mismatch = identityMismatch(binding, agent, findPane(snapshot, params.pane_id));
        if (mismatch) {
          // Establishing that the registered identity is gone is the complete,
          // safe observation for this turn. No replacement output is exposed.
          observed = true;
          return text(`Refusing to observe as the registered worker: ${mismatch}.`, true);
        }
        const observation = await observeWorker(binding, client, {
          terminalLines: params.lines || 40,
          fallbackWhenEmpty: agent.agent_status === "blocked" || agent.agent_status === "unknown",
        });
        await updateState((next) => {
          const current = next.workers.find((worker) => worker.paneId === params.pane_id);
          if (current) {
            current.lastReviewStateChangeSeq = Number(agent.state_change_seq || 0);
            current.nextReviewAt = new Date(Date.now() + reviewIntervalMs()).toISOString();
            if (observation.cursor) current.observationCursor = observation.cursor;
          }
          return next;
        });
        await armReviewTimer();
        observed = true;
        return text(`Goal: ${binding.goal}\nHerdr state: ${agent.agent_status}\n\n${formatObservation(observation)}`);
      } catch (error) { return text(`Could not observe worker: ${error.message}`, true); }
      finally { reviewTurn.finishObservation(observed); }
    },
  });

  pi.registerTool({
    name: "supervisor_steer",
    label: "Steer worker",
    description: "Send one goal-aware instruction to the same supervised worker after rechecking its identity. Use when current evidence shows a useful next action.",
    parameters: Type.Object({ pane_id: Pane, message: Type.String({ minLength: 1 }) }),
    executionMode: "sequential",
    async execute(_id, params) {
      const fenceError = reviewTurn.guardDecision(params.pane_id);
      if (fenceError) return text(fenceError, true);
      try {
        const [state, snapshot] = await Promise.all([loadState(), client.snapshot()]);
        const binding = state.workers.find((worker) => worker.paneId === params.pane_id);
        if (!binding) return text(`${params.pane_id} is not supervised.`, true);
        const mismatch = identityMismatch(
          binding,
          findAgent(snapshot, params.pane_id),
          findPane(snapshot, params.pane_id),
        );
        if (mismatch) return text(`Refusing to steer: ${mismatch}.`, true);
        if (mode() !== "live") {
          reviewTurn.close(params.pane_id);
          return text(`${mode()} mode: would steer ${params.pane_id}: ${params.message.trim()}\n\nEnd this supervisor turn now. Wait for Herdr's next worker event; do not poll.`);
        }
        await client.promptAgent(params.pane_id, params.message.trim());
        reviewTurn.close(params.pane_id);
        return text(`Steered ${params.pane_id}: ${params.message.trim()}\n\nEnd this supervisor turn now. Wait for Herdr's next worker event; do not poll.`);
      } catch (error) { return text(`Could not steer worker: ${error.message}`, true); }
    },
  });

  pi.registerTool({
    name: "supervisor_ask_human",
    label: "Ask for a decision",
    description: "Ask the human one concrete question when their authority or missing information is required. This ends the review turn without prompting the worker.",
    parameters: Type.Object({ pane_id: Pane, question: Type.String({ minLength: 1 }) }),
    executionMode: "sequential",
    async execute(_id, params) {
      const fenceError = reviewTurn.guardDecision(params.pane_id);
      if (fenceError) return text(fenceError, true);
      reviewTurn.close(params.pane_id);
      return text(`Needs your input for ${params.pane_id}:\n${params.question.trim()}\n\nEnd this supervisor turn now. Wait for the human's answer; do not prompt or poll the worker.`);
    },
  });

  pi.registerTool({
    name: "supervisor_recover",
    label: "Resume worker",
    description: "Resume the exact registered native agent session in the same terminal after its process exits, then send one goal-aware continuation message. Refuses changed panes, replacement agents, and unsupported session identities.",
    parameters: Type.Object({
      pane_id: Pane,
      message: Type.String({ minLength: 1 }),
    }),
    executionMode: "sequential",
    async execute(_id, params) {
      const fenceError = reviewTurn.guardDecision(params.pane_id);
      if (fenceError) return text(fenceError, true);
      try {
        const [state, snapshot] = await Promise.all([loadState(), client.snapshot()]);
        const binding = state.workers.find((worker) => worker.paneId === params.pane_id);
        if (!binding) return text(`${params.pane_id} is not supervised.`, true);
        const request = recoveryRequest(binding, snapshot);
        if (mode() !== "live") {
          reviewTurn.close(params.pane_id);
          return text(`${mode()} mode: would resume the exact ${binding.agentSession.agent} session in ${params.pane_id} and send: ${params.message.trim()}\n\nEnd this supervisor turn now. Wait for Herdr's next worker event; do not poll.`);
        }
        const resumed = await client.startAndWaitAgent(request);
        const mismatch = identityMismatch(binding, resumed, resumed);
        if (mismatch) return text(`Refusing to prompt recovered worker: ${mismatch}.`, true);
        await client.promptAgent(params.pane_id, params.message.trim());
        reviewTurn.close(params.pane_id);
        return text(`Resumed the exact ${binding.agentSession.agent} session in ${params.pane_id} and asked it to continue.\n\nEnd this supervisor turn now. Wait for Herdr's next worker event; do not poll.`);
      } catch (error) { return text(`Could not recover worker: ${error.message}`, true); }
    },
  });

  pi.registerTool({
    name: "supervisor_finish",
    label: "Accept worker goal",
    description: "Stop supervision after the worker's goal meets every acceptance criterion. Evidence is required; an idle or done agent state is not evidence.",
    parameters: Type.Object({
      pane_id: Pane,
      summary: Type.String({ minLength: 1 }),
      evidence: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
    }),
    executionMode: "sequential",
    async execute(_id, params) {
      const fenceError = reviewTurn.guardDecision(params.pane_id);
      if (fenceError) return text(fenceError, true);
      if (mode() !== "live") {
        reviewTurn.close(params.pane_id);
        return text(`${mode()} mode: evidence supports accepting ${params.pane_id}, but its goal binding remains active.\n${params.summary}\n\nEnd this supervisor turn now. Wait for Herdr's next worker event; do not poll.`);
      }
      let removed = false;
      await updateState((state) => {
        removed = removeBinding(state, params.pane_id);
        return state;
      });
      await connectObserver();
      await armReviewTimer();
      if (!removed) return text(`${params.pane_id} is not supervised.`, true);
      reviewTurn.close(params.pane_id);
      return text(`Goal accepted for ${params.pane_id}.\n${params.summary}\nEvidence:\n${params.evidence.map((item) => `- ${item}`).join("\n")}\n\nEnd this supervisor turn now. Wait for Herdr's next worker event; do not poll.`);
    },
  });

  pi.registerCommand("supervise", {
    description: "Supervise an existing pane: /supervise <pane> <goal>",
    async handler(args, ctx) {
      const [paneId, ...goalParts] = args.trim().split(/\s+/);
      const goal = goalParts.join(" ");
      if (!paneId || !goal) return ctx.ui.notify("Usage: /supervise <pane> <goal>", "warning");
      try {
        const binding = await register(paneId, goal, []);
        ctx.ui.notify(`Supervising ${binding.paneId}: ${binding.goal}`, "info");
      } catch (error) { ctx.ui.notify(error.message, "error"); }
    },
  });

  pi.registerCommand("supervised", {
    description: "Show supervised workers and goals",
    async handler(_args, ctx) {
      try { ctx.ui.notify(await status(), "info"); }
      catch (error) { ctx.ui.notify(error.message, "error"); }
    },
  });

  pi.registerCommand("unsupervise", {
    description: "Stop supervising a pane without stopping it",
    async handler(args, ctx) {
      const paneId = args.trim();
      if (!paneId) return ctx.ui.notify("Usage: /unsupervise <pane>", "warning");
      let removed = false;
      await updateState((state) => {
        removed = removeBinding(state, paneId);
        return state;
      });
      await connectObserver();
      await armReviewTimer();
      ctx.ui.notify(removed ? `Stopped supervising ${paneId}.` : `${paneId} was not supervised.`, "info");
    },
  });

  pi.on("before_agent_start", (event) => ({
    systemPrompt: `${event.systemPrompt}\n\nYou supervise Herdr workers pursuing explicit goals. Herdr owns live worker state; goal bindings define what you judge. The current worker-review request defines the subject of that turn; use relevant shared history, but use only that worker's evidence to judge its goal. Evidence about a worker must come through supervisor_observe; never inspect or modify its workspace directly. On a supervision event, observe the exact worker once, compare that evidence with the existing goal, then leave healthy work alone, call supervisor_steer when more can be done, call supervisor_ask_human only for a real human decision, call supervisor_recover only when the same terminal remains but its exact registered process exited, or call supervisor_finish only with convincing evidence. If observation reports a replacement identity or missing pane, never steer or recover it; ask the human one concrete question if their decision is needed. When a human decision is required, ask one concrete question with supervisor_ask_human and end the turn; do not prompt a worker merely to keep waiting. When the human answers, steer the same worker once and wait for its next event. Do not register, replace, or stop a goal during an event review; those are explicit human commands. Never treat idle, blocked, done, or a completed turn as goal completion. In observe mode, report signals without starting a model turn. In dry-run mode, decide through the same supervisor tool, whose result only displays the proposed action. Only live mode applies worker actions. Do not create another worker or goal. Use plain language.`,
  }));

  pi.on("session_start", async (_event, ctx) => {
    // This Pi session is a supervisor, not a second implementation worker.
    pi.setActiveTools(supervisorTools);
    shuttingDown = false;
    await connectObserver();
    await armReviewTimer();
    const state = await loadState();
    ctx.ui.setStatus("herdr-supervisor", state.workers.length ? `supervising ${state.workers.length}` : undefined);
  });

  pi.on("agent_settled", async () => {
    const reviewedPane = activeReviewPane;
    activeReviewPane = undefined;
    reviewTurn.end();
    if (reviewedPane) {
      const nextReviewAt = new Date(Date.now() + reviewIntervalMs()).toISOString();
      await updateState((state) => {
        for (const binding of state.workers) {
          if (binding.paneId === reviewedPane) binding.nextReviewAt = nextReviewAt;
        }
        return state;
      });
    }
    await drainSignals();
    await armReviewTimer();
  });

  pi.on("session_shutdown", () => {
    shuttingDown = true;
    stopSubscription?.();
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (reviewTimer) clearTimeout(reviewTimer);
    pendingSignals.clear();
    preparingReviewPane = undefined;
    activeReviewPane = undefined;
    reviewTurn.end();
  });
}
