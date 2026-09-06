import { spawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { createInterface } from "node:readline";
import { resolve } from "node:path";
import type { Duplex } from "node:stream";
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
    stdio: ["pipe", "inherit", "inherit", "pipe"],
  });
  const channel = child.stdio[3] as Duplex | null;
  if (!channel) throw new Error("Task admission worker channel is unavailable");
  let nextId = 1;
  let closed = false;
  const pending = new Map<number, { resolve(value: TaskAdmissionProcessResult): void; reject(error: Error): void }>();
  const fail = (error: Error) => {
    if (closed) return;
    closed = true;
    for (const request of pending.values()) request.reject(error);
    pending.clear();
    input.onExit?.(error);
  };
  createInterface({ input: channel }).on("line", (line) => {
    let response: Response;
    try {
      response = JSON.parse(line) as Response;
    } catch (error) {
      fail(
        new Error(`Invalid Task admission worker response: ${error instanceof Error ? error.message : String(error)}`),
      );
      return;
    }
    const request = pending.get(response.id);
    if (!request) return;
    pending.delete(response.id);
    if (response.ok)
      request.resolve({ taskIds: response.taskIds, supersededSessionIds: response.supersededSessionIds });
    else request.reject(new Error(response.error));
  });
  child.once("error", (error) => fail(error));
  child.once("exit", (code, signal) => {
    fail(new Error(`Task admission worker exited with ${signal ? `signal ${signal}` : `code ${code}`}`));
  });
  return {
    dispatch(command, event) {
      if (closed || !channel.writable) return Promise.reject(new Error("Task admission worker is unavailable"));
      const id = nextId++;
      return new Promise((resolveRequest, reject) => {
        pending.set(id, { resolve: resolveRequest, reject });
        channel.write(`${JSON.stringify({ id, command, event } satisfies Request)}\n`, (error?: Error | null) => {
          if (!error) return;
          pending.delete(id);
          reject(error);
        });
      });
    },
    close() {
      if (closed) return;
      closed = true;
      channel.end();
      child.stdin?.end();
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
  const parentEnded = process.stdin.readableEnded
    ? Promise.resolve()
    : new Promise<void>((resolveDone) => process.stdin.once("end", resolveDone));
  process.stdin.resume();
  const releases = new DefinitionSourceReleaseStore(input.projectRoot, input.persistDir);
  const source = releases.ensureCurrent();
  const registry = new AppRegistry(source.projectsRoot, input.projectsRoot);
  await registry.reload();
  const descriptors = standaloneAppTaskAdmissionDescriptors({
    persistDir: input.persistDir,
    projectsRoot: source.projectsRoot,
    entries: registry.snapshot().entries,
  });
  const channel = createReadStream("", { fd: 3, autoClose: false });
  const output = createWriteStream("", { fd: 3, autoClose: false });
  let chain = Promise.resolve();
  createInterface({ input: channel }).on("line", (line) => {
    chain = chain.then(async () => {
      let request: Request;
      try {
        request = JSON.parse(line) as Request;
        const descriptor = descriptors.get(request.command.appId);
        if (!descriptor) throw new Error(`App ${request.command.appId} has no loaded Task admission state`);
        const result = admitStandaloneCanonicalAppTaskEvent({
          descriptor,
          event: request.event,
          intent: request.command.kind === "task" ? request.command.intent : null,
          ...(request.command.kind === "exact-task" ? { targetedTaskId: request.command.targetedTaskId } : {}),
          conditionTaskIds: request.command.conditionTaskIds,
        });
        output.write(
          `${JSON.stringify({ id: request.id, ok: true, taskIds: result.taskIds, supersededSessionIds: result.supersededSessionIds } satisfies Response)}\n`,
        );
      } catch (error) {
        const id = typeof request! === "object" && Number.isSafeInteger(request!.id) ? request!.id : 0;
        output.write(
          `${JSON.stringify({ id, ok: false, error: error instanceof Error ? error.message : String(error) } satisfies Response)}\n`,
        );
      }
    });
  });
  await parentEnded;
  await chain;
}
