export const DEFAULT_REVIEW_INTERVAL_MS = 10 * 60 * 1000;

export function findAgent(snapshot, paneId) {
  return snapshot?.agents?.find((agent) => agent.pane_id === paneId);
}

export function captureIdentity(agent) {
  if (!agent?.pane_id || !agent?.terminal_id || !agent?.agent_session) {
    throw new Error("the pane does not contain an observable agent session");
  }
  return {
    paneId: agent.pane_id,
    terminalId: agent.terminal_id,
    agentSession: { ...agent.agent_session },
  };
}

export function identityMismatch(binding, agent) {
  if (!agent) return "worker pane is no longer present";
  if (agent.terminal_id !== binding.terminalId) return "pane now refers to a different terminal";
  const expected = binding.agentSession;
  const actual = agent.agent_session;
  if (!actual) return "worker has no native agent-session identity";
  for (const field of ["source", "agent", "kind", "value"]) {
    if (actual[field] !== expected[field]) return `worker ${field} changed`;
  }
  return undefined;
}

export function registerBinding(
  state,
  agent,
  goal,
  acceptance = [],
  now = new Date(),
  reviewAfterMs = DEFAULT_REVIEW_INTERVAL_MS,
) {
  const identity = captureIdentity(agent);
  const normalizedGoal = goal.trim();
  const normalizedAcceptance = acceptance.map((item) => item.trim()).filter(Boolean);
  if (!normalizedGoal) throw new Error("goal must not be empty");
  const existing = state.workers.find((worker) => worker.paneId === identity.paneId);
  const binding = {
    ...identity,
    goal: normalizedGoal,
    acceptance: normalizedAcceptance,
    registeredAt: existing?.registeredAt || now.toISOString(),
    nextReviewAt: new Date(now.getTime() + reviewAfterMs).toISOString(),
    lastObservedStateChangeSeq: Number(agent.state_change_seq || 0),
    lastReviewStateChangeSeq: 0,
  };
  state.workers = [...state.workers.filter((worker) => worker.paneId !== identity.paneId), binding];
  return binding;
}

export function dueBindings(workers, now = new Date()) {
  const timestamp = now.getTime();
  return workers.filter((worker) => {
    const deadline = Date.parse(worker.nextReviewAt || "");
    return !Number.isFinite(deadline) || deadline <= timestamp;
  });
}

export function nextReviewDelay(workers, now = new Date()) {
  if (!workers.length) return undefined;
  const timestamp = now.getTime();
  const deadlines = workers.map((worker) => Date.parse(worker.nextReviewAt || ""));
  if (deadlines.some((deadline) => !Number.isFinite(deadline))) return 0;
  return Math.max(0, Math.min(...deadlines) - timestamp);
}

export function removeBinding(state, paneId) {
  const before = state.workers.length;
  state.workers = state.workers.filter((worker) => worker.paneId !== paneId);
  return before !== state.workers.length;
}

export function liveWorker(binding, snapshot) {
  const agent = findAgent(snapshot, binding.paneId);
  return {
    binding,
    agent,
    mismatch: identityMismatch(binding, agent),
  };
}

export function shouldWake(binding, agent) {
  const mismatch = identityMismatch(binding, agent);
  if (mismatch) return { wake: true, reason: mismatch, sequence: undefined, key: `identity:${mismatch}` };
  const sequence = Number(agent.state_change_seq || 0);
  if (sequence <= Number(binding.lastReviewStateChangeSeq || 0)) {
    return { wake: false, reason: "transition already reviewed", sequence, key: `state:${sequence}` };
  }
  if (agent.agent_status === "working") {
    return { wake: false, reason: "worker is working", sequence, key: `state:${sequence}:working` };
  }
  return {
    wake: true,
    reason: `worker is ${agent.agent_status}`,
    sequence,
    key: `state:${sequence}:${agent.agent_status}`,
  };
}

export function formatWorker({ binding, agent, mismatch }) {
  const state = mismatch ? "identity changed" : agent.agent_status;
  const name = `${binding.agentSession.agent} ${binding.paneId}`;
  const lines = [`${name} · ${state}`, `  Goal: ${binding.goal}`];
  if (binding.acceptance.length) lines.push(`  Accept when: ${binding.acceptance.join("; ")}`);
  if (mismatch) lines.push(`  Needs you: ${mismatch}; supervision is paused`);
  else if (agent.agent_status === "working") lines.push("  Next: review when the worker settles or blocks");
  else lines.push(`  Next: supervisor should review current evidence`);
  return lines.join("\n");
}

export function reviewMessage(binding, agent, reason) {
  const criteria = binding.acceptance.length
    ? binding.acceptance.map((item) => `- ${item}`).join("\n")
    : "- The stated goal is fully achieved with convincing evidence.";
  return `Worker review · ${binding.agentSession.agent} ${binding.paneId}\n\nThis turn concerns this worker and goal. Use relevant earlier supervisor history when helpful, but do not carry another worker's facts into this decision.\n\nGoal\n  ${binding.goal}\n\nWhy review now\n  ${reason}; Herdr reports ${agent?.agent_status || "missing"}.\n\nAccept when\n${criteria}\n\nReview\n  Observe this exact worker, then decide the smallest useful next action for this goal.`;
}
