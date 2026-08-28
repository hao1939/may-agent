import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { HerdrClient } from "./src/herdr-client.js";
import { loadState, updateState } from "./src/store.js";
import {
  findAgent,
  formatWorker,
  identityMismatch,
  liveWorker,
  registerBinding,
  removeBinding,
  reviewMessage,
  shouldWake,
} from "./src/supervision.js";

const Pane = Type.String({ description: "Exact Herdr pane ID, for example w1:p2" });
const client = new HerdrClient();
type SupervisorMode = "observe" | "dry-run" | "live";

function text(value: string, isError = false) {
  return { content: [{ type: "text" as const, text: value }], isError };
}

export default function herdrSupervisor(pi: ExtensionAPI) {
  let stopSubscription: undefined | (() => void);
  let reconnectTimer: undefined | ReturnType<typeof setTimeout>;
  let shuttingDown = false;
  let reconnectDelay = 250;

  pi.registerFlag("supervisor-mode", {
    description: "Supervision authority: observe, dry-run, or live",
    type: "string",
    default: process.env.HERDR_SUPERVISOR_MODE || "observe",
  });

  function mode(): SupervisorMode {
    const value = pi.getFlag("supervisor-mode");
    return value === "live" || value === "dry-run" ? value : "observe";
  }

  async function status(paneId?: string) {
    const [state, snapshot] = await Promise.all([loadState(), client.snapshot()]);
    const bindings = paneId ? state.workers.filter((worker) => worker.paneId === paneId) : state.workers;
    if (!bindings.length) return paneId ? `${paneId} is not supervised.` : "No supervised workers.";
    return bindings.map((binding) => formatWorker(liveWorker(binding, snapshot))).join("\n\n");
  }

  async function handleSignal(paneId: string) {
    const [state, snapshot] = await Promise.all([loadState(), client.snapshot()]);
    const binding = state.workers.find((worker) => worker.paneId === paneId);
    if (!binding) return;
    const agent = findAgent(snapshot, paneId);
    const decision = shouldWake(binding, agent);
    if (!decision.wake || binding.lastNoticeKey === decision.key) return;
    await updateState((next) => {
      const current = next.workers.find((worker) => worker.paneId === paneId);
      if (current) {
        current.lastNoticeKey = decision.key;
        if (decision.sequence !== undefined) current.lastObservedStateChangeSeq = decision.sequence;
      }
      return next;
    });
    const currentMode = mode();
    pi.sendMessage(
      {
        customType: "herdr-supervisor-review",
        content: `${reviewMessage(binding, agent, decision.reason)}\n\nSupervisor mode: ${currentMode}.`,
        display: true,
      },
      { triggerTurn: currentMode !== "observe", deliverAs: "followUp" },
    );
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
    );
    reconnectDelay = 250;
  }

  async function register(paneId: string, goal: string, acceptance: string[]) {
    const snapshot = await client.snapshot();
    const agent = findAgent(snapshot, paneId);
    if (!agent) throw new Error(`no observable agent in ${paneId}`);
    let binding;
    await updateState((state) => {
      binding = registerBinding(state, agent, goal, acceptance);
      return state;
    });
    await connectObserver();
    return binding!;
  }

  pi.registerTool({
    name: "supervisor_register",
    label: "Supervise worker",
    description: "Bind one explicit goal and its acceptance criteria to an existing Herdr worker. Reusing the pane updates that binding rather than creating another unit of work.",
    parameters: Type.Object({
      pane_id: Pane,
      goal: Type.String({ description: "The outcome the worker must achieve" }),
      acceptance: Type.Array(Type.String(), { description: "Concrete evidence required before accepting the goal" }),
    }),
    executionMode: "sequential",
    async execute(_id, params) {
      try {
        const binding = await register(params.pane_id, params.goal, params.acceptance);
        return text(`Now supervising ${binding.agentSession.agent} in ${binding.paneId}.\nGoal: ${binding.goal}`);
      } catch (error) { return text(`Could not register worker: ${error.message}`, true); }
    },
  });

  pi.registerTool({
    name: "supervisor_status",
    label: "Supervised workers",
    description: "Show supervised goals against fresh Herdr worker state.",
    parameters: Type.Object({ pane_id: Type.Optional(Pane) }),
    executionMode: "parallel",
    async execute(_id, params) {
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
      try {
        const [state, snapshot] = await Promise.all([loadState(), client.snapshot()]);
        const binding = state.workers.find((worker) => worker.paneId === params.pane_id);
        if (!binding) return text(`${params.pane_id} is not supervised.`, true);
        const agent = findAgent(snapshot, params.pane_id);
        const mismatch = identityMismatch(binding, agent);
        if (mismatch) return text(`Refusing to observe as the registered worker: ${mismatch}.`, true);
        const result = await client.readAgent(params.pane_id, params.lines || 80);
        await updateState((next) => {
          const current = next.workers.find((worker) => worker.paneId === params.pane_id);
          if (current) current.lastReviewStateChangeSeq = Number(agent.state_change_seq || 0);
          return next;
        });
        return text(`Goal: ${binding.goal}\nHerdr state: ${agent.agent_status}\n\nRecent worker output:\n${result.read.text}`);
      } catch (error) { return text(`Could not observe worker: ${error.message}`, true); }
    },
  });

  pi.registerTool({
    name: "supervisor_steer",
    label: "Steer worker",
    description: "Send one goal-aware instruction to the same supervised worker after rechecking its identity. Use when current evidence shows a useful next action.",
    parameters: Type.Object({ pane_id: Pane, message: Type.String({ minLength: 1 }) }),
    executionMode: "sequential",
    async execute(_id, params) {
      try {
        const [state, snapshot] = await Promise.all([loadState(), client.snapshot()]);
        const binding = state.workers.find((worker) => worker.paneId === params.pane_id);
        if (!binding) return text(`${params.pane_id} is not supervised.`, true);
        const mismatch = identityMismatch(binding, findAgent(snapshot, params.pane_id));
        if (mismatch) return text(`Refusing to steer: ${mismatch}.`, true);
        if (mode() !== "live") {
          return text(`${mode()} mode: would steer ${params.pane_id}: ${params.message.trim()}`);
        }
        await client.promptAgent(params.pane_id, params.message.trim());
        return text(`Steered ${params.pane_id}: ${params.message.trim()}`);
      } catch (error) { return text(`Could not steer worker: ${error.message}`, true); }
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
      if (mode() !== "live") {
        return text(`${mode()} mode: evidence supports accepting ${params.pane_id}, but its goal binding remains active.\n${params.summary}`);
      }
      let removed = false;
      await updateState((state) => {
        removed = removeBinding(state, params.pane_id);
        return state;
      });
      await connectObserver();
      if (!removed) return text(`${params.pane_id} is not supervised.`, true);
      return text(`Goal accepted for ${params.pane_id}.\n${params.summary}\nEvidence:\n${params.evidence.map((item) => `- ${item}`).join("\n")}`);
    },
  });

  pi.registerTool({
    name: "supervisor_stop",
    label: "Stop supervision",
    description: "Stop supervising a worker only when the human explicitly asks. This does not stop the worker.",
    parameters: Type.Object({ pane_id: Pane }),
    executionMode: "sequential",
    async execute(_id, params) {
      let removed = false;
      await updateState((state) => {
        removed = removeBinding(state, params.pane_id);
        return state;
      });
      await connectObserver();
      return text(removed ? `Stopped supervising ${params.pane_id}. The worker was not stopped.` : `${params.pane_id} is not supervised.`);
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
      ctx.ui.notify(removed ? `Stopped supervising ${paneId}.` : `${paneId} was not supervised.`, "info");
    },
  });

  pi.on("before_agent_start", (event) => ({
    systemPrompt: `${event.systemPrompt}\n\nYou supervise Herdr workers pursuing explicit goals. Herdr owns live worker state; goal bindings define what you judge. On a supervision event, inspect the exact worker, compare evidence with the goal, and act: leave healthy work alone, steer the same worker when more can be done, ask the human only for a real decision, or finish only with convincing evidence. Never treat idle, blocked, done, or a completed turn as goal completion. In observe mode, report signals without starting a model turn. In dry-run mode, decide but worker actions are only displayed. Only live mode applies worker actions. Do not create another worker or goal unless the human asks. Use plain language.`,
  }));

  pi.on("session_start", async (_event, ctx) => {
    shuttingDown = false;
    await connectObserver();
    const state = await loadState();
    ctx.ui.setStatus("herdr-supervisor", state.workers.length ? `supervising ${state.workers.length}` : undefined);
    const snapshot = await client.snapshot();
    for (const binding of state.workers) {
      const agent = findAgent(snapshot, binding.paneId);
      const decision = shouldWake(binding, agent);
      if (decision.wake && binding.lastNoticeKey !== decision.key) void handleSignal(binding.paneId);
    }
  });

  pi.on("session_shutdown", () => {
    shuttingDown = true;
    stopSubscription?.();
    if (reconnectTimer) clearTimeout(reconnectTimer);
  });
}
