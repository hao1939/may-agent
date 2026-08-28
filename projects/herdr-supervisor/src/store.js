import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const STATE_VERSION = 1;

export function defaultStatePath(env = process.env) {
  if (env.HERDR_SUPERVISOR_STATE) return env.HERDR_SUPERVISOR_STATE;
  const root = env.XDG_STATE_HOME || join(homedir(), ".local", "state");
  return join(root, "herdr-supervisor", "bindings.json");
}

export function emptyState() {
  return { version: STATE_VERSION, workers: [] };
}

function validateBinding(binding) {
  if (!binding || typeof binding !== "object") throw new Error("invalid worker binding");
  for (const field of ["paneId", "terminalId", "goal"]) {
    if (typeof binding[field] !== "string" || !binding[field].trim()) {
      throw new Error(`worker binding requires ${field}`);
    }
  }
  if (!binding.agentSession || typeof binding.agentSession !== "object") {
    throw new Error("worker binding requires agentSession");
  }
  for (const field of ["source", "agent", "kind", "value"]) {
    if (typeof binding.agentSession[field] !== "string" || !binding.agentSession[field]) {
      throw new Error(`worker binding agentSession requires ${field}`);
    }
  }
  if (!Array.isArray(binding.acceptance) || binding.acceptance.some((item) => typeof item !== "string")) {
    throw new Error("worker binding acceptance must be an array of strings");
  }
  if (binding.nextReviewAt !== undefined && !Number.isFinite(Date.parse(binding.nextReviewAt))) {
    throw new Error("worker binding nextReviewAt must be an ISO timestamp");
  }
}

export async function loadState(path = defaultStatePath()) {
  let parsed;
  try {
    parsed = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return emptyState();
    throw error;
  }
  if (parsed?.version !== STATE_VERSION || !Array.isArray(parsed.workers)) {
    throw new Error(`unsupported supervisor state in ${path}`);
  }
  parsed.workers.forEach(validateBinding);
  return parsed;
}

export async function saveState(state, path = defaultStatePath()) {
  if (state?.version !== STATE_VERSION || !Array.isArray(state.workers)) {
    throw new Error("refusing to save invalid supervisor state");
  }
  state.workers.forEach(validateBinding);
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, path);
}

const updates = new Map();

export async function updateState(change, path = defaultStatePath()) {
  const previous = updates.get(path) || Promise.resolve();
  const update = previous.then(async () => {
    const state = await loadState(path);
    const next = await change(structuredClone(state));
    await saveState(next, path);
    return next;
  });
  updates.set(path, update.catch(() => {}));
  return update;
}
