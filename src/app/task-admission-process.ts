import { spawn } from "node:child_process";
import { resolve } from "node:path";
import type { AppEventAdmissionCommand } from "./app-event-admission-store.js";
import { AppRegistry } from "./app-registry.js";
import { DefinitionSourceReleaseStore } from "./app-source-release.js";
import { admitStandaloneCanonicalAppTaskEvent, standaloneAppTaskAdmissionDescriptors } from "./app-task-runtime.js";
import type { AgentEvent } from "./event-bus.js";
import { isBundled } from "./bundle-mode.js";

export type TaskAdmissionProcessResult = {
  taskIds: string[];
  supersededSessionIds: string[];
};

type Request = { id: number; command: AppEventAdmissionCommand; event: AgentEvent };
type Response = ({ id: number; ok: true } & TaskAdmissionProcessResult) | { id: number; ok: false; error: string };

function invocation(): { command: string; args: string[] } {
  if (isBundled()) return { command: process.execPath, args: [] };
  const entry = process.argv[1];
  if (!entry || entry === "binary-entry.ts") throw new Error("Cannot resolve Task admission worker entrypoint");
  return { command: process.execPath, args: [resolve(entry)] };
}

/** One persistent process for canonical Task mutations produced by Event routing. */
export function createTaskAdmissionProcess(
  input: {
    onExit?(error: Error): void;
  } = {},
): {
  dispatch(command: AppEventAdmissionCommand, event: AgentEvent): Promise<TaskAdmissionProcessResult>;
  close(): void;
} {
  const target = invocation();
  const child = spawn(target.command, [...target.args, "--task-admission-worker"], {
    cwd: process.cwd(),
    env: { ...process.env, MAY_TASK_ATTEMPT_CHILD: "1" },
    stdio: ["ignore", "inherit", "inherit", "ipc"],
    serialization: "json",
  });
  let nextId = 1;
  let closed = false;
  const pending = new Map<number, { resolve(value: TaskAdmissionProcessResult): void; reject(error: Error): void }>();
  const fail = (error: Error) => {
    if (closed) return;
    closed = true;
    for (const request of pending.values()) request.reject(error);
    pending.clear();
    if (child.connected) child.disconnect();
    child.kill("SIGTERM");
    input.onExit?.(error);
  };
  child.on("message", (message) => {
    if (!message || typeof message !== "object" || !Number.isSafeInteger((message as Response).id)) {
      fail(new Error("Invalid Task admission worker response"));
      return;
    }
    const response = message as Response;
    const request = pending.get(response.id);
    if (!request) return;
    pending.delete(response.id);
    if (response.ok)
      request.resolve({ taskIds: response.taskIds, supersededSessionIds: response.supersededSessionIds });
    else request.reject(new Error(response.error));
  });
  child.once("error", (error) => fail(error));
  child.once("disconnect", () => fail(new Error("Task admission worker is unavailable")));
  child.once("exit", (code, signal) => {
    fail(new Error(`Task admission worker exited with ${signal ? `signal ${signal}` : `code ${code}`}`));
  });
  return {
    dispatch(command, event) {
      if (closed || !child.connected) return Promise.reject(new Error("Task admission worker is unavailable"));
      const id = nextId++;
      return new Promise((resolveRequest, reject) => {
        pending.set(id, { resolve: resolveRequest, reject });
        child.send({ id, command, event } satisfies Request, (error: Error | null) => {
          if (!error) return;
          fail(new Error(`Task admission worker is unavailable: ${error.message}`));
        });
      });
    },
    close() {
      if (closed) return;
      closed = true;
      if (child.connected) child.disconnect();
      for (const request of pending.values()) request.reject(new Error("Task admission worker closed"));
      pending.clear();
    },
  };
}

/** Private long-lived worker entry. Requests are deliberately serialized here. */
export async function runTaskAdmissionWorker(input: {
  projectRoot: string;
  projectsRoot: string;
  persistDir: string;
}): Promise<void> {
  if (process.env.MAY_TASK_ATTEMPT_CHILD !== "1") throw new Error("Task admission worker mode is private");
  const parentEnded = !process.connected
    ? Promise.resolve()
    : new Promise<void>((resolveDone) => process.once("disconnect", resolveDone));
  const releases = new DefinitionSourceReleaseStore(input.projectRoot, input.persistDir);
  const source = releases.ensureCurrent();
  const registry = new AppRegistry(source.projectsRoot, input.projectsRoot);
  await registry.reload();
  const descriptors = standaloneAppTaskAdmissionDescriptors({
    persistDir: input.persistDir,
    projectsRoot: source.projectsRoot,
    entries: registry.snapshot().entries,
  });
  const reply = (response: Response) =>
    new Promise<void>((resolveSent, reject) => {
      if (!process.send || !process.connected) return reject(new Error("Task admission worker IPC is unavailable"));
      process.send(response, (error: Error | null) => (error ? reject(error) : resolveSent()));
    });
  let chain = Promise.resolve();
  process.on("message", (message) => {
    chain = chain
      .then(async () => {
        let request: Request;
        let response: Response;
        try {
          request = message as Request;
          const descriptor = descriptors.get(request.command.appId);
          if (!descriptor) throw new Error(`App ${request.command.appId} has no loaded Task admission state`);
          const result = admitStandaloneCanonicalAppTaskEvent({
            descriptor,
            event: request.event,
            intent: request.command.kind === "task" ? request.command.intent : null,
            ...(request.command.kind === "exact-task" ? { targetedTaskId: request.command.targetedTaskId } : {}),
            conditionTaskIds: request.command.conditionTaskIds,
          });
          response = {
            id: request.id,
            ok: true,
            taskIds: result.taskIds,
            supersededSessionIds: result.supersededSessionIds,
          };
        } catch (error) {
          const id = typeof request! === "object" && Number.isSafeInteger(request!.id) ? request!.id : 0;
          response = { id, ok: false, error: error instanceof Error ? error.message : String(error) };
        }
        await reply(response);
      })
      .catch(() => {
        // Requests were admitted durably before dispatch. Lost IPC ends this
        // private worker; the existing admission recovery retries those identities.
        process.exit(1);
      });
  });
  await parentEnded;
  await chain;
}
