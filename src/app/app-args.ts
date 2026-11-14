import { interfaceBinding, type InterfaceBinding } from "@may-agent/control";
import { parseEmitMode } from "./modes/emit.js";

export interface AppArgs {
  cronEnabled: boolean;
  telegramEnabled: boolean;
  consoleEnabled: boolean;
  socketEnabled: boolean;
  webEnabled: boolean;
  quietConsole: boolean;
  statusMode: boolean;
  emitMode: ReturnType<typeof parseEmitMode>;
  dryRun: boolean;
  humanInterface: InterfaceBinding;
  webOnlyMode: boolean;
  notify: boolean;
  /** Private parent-to-child payload for one isolated Task attempt. */
  taskWorkerRequest?: string;
  /** Private one-shot Task recovery worker. */
  taskRecoveryWorker: boolean;
  /** Pinned definition generation for private recovery/admission workers. */
  taskWorkerSource?: string;
  /** Private persistent canonical Task admission worker. */
  taskAdmissionWorker: boolean;
}

export function parseAppArgs(argv: string[] = process.argv, env: NodeJS.ProcessEnv = process.env): AppArgs {
  if (argv.some((arg) => arg === "--run-workflow" || arg.startsWith("--run-workflow="))) {
    throw new Error("--run-workflow has been retired; use `may run <target> [input]` or `run(target, input)` from @may-agent/sdk/standalone");
  }
  const cronEnabled = argv.includes("--cron");
  const telegramEnabled = argv.includes("--telegram");
  const consoleEnabled = argv.includes("--console") || argv.includes("--chat");
  const socketEnabled = argv.includes("--socket");
  const webEnabled = argv.includes("--web");
  const quietConsole = argv.includes("--chat");
  const statusMode = argv.includes("--status");
  const emitMode = parseEmitMode(argv);
  const dryRun = argv.includes("--dry-run");
  const humanInterface = interfaceBinding(env, parseInterfaceAgent(argv));
  const taskWorkerIndex = argv.indexOf("--task-worker-once");
  const taskWorkerRequest = taskWorkerIndex >= 0 ? argv[taskWorkerIndex + 1] : undefined;
  const taskRecoveryWorker = argv.includes("--task-recovery-once");
  const sourceIndex = argv.indexOf("--task-worker-source");
  const taskWorkerSource = sourceIndex >= 0 ? argv[sourceIndex + 1] : undefined;
  if (sourceIndex >= 0 && (!taskWorkerSource || taskWorkerSource.startsWith("--"))) {
    throw new Error("--task-worker-source requires one source payload");
  }
  const taskAdmissionWorker = argv.includes("--task-admission-worker");
  if (taskWorkerIndex >= 0 && !taskWorkerRequest) {
    throw new Error("--task-worker-once requires one request payload");
  }

  return {
    cronEnabled,
    telegramEnabled,
    consoleEnabled,
    socketEnabled,
    webEnabled,
    quietConsole,
    statusMode,
    emitMode,
    dryRun,
    humanInterface,
    webOnlyMode:
      webEnabled &&
      !consoleEnabled &&
      !cronEnabled &&
      !socketEnabled &&
      !telegramEnabled &&
      !statusMode,
    notify: argv.includes("--notify"),
    ...(taskWorkerRequest ? { taskWorkerRequest } : {}),
    taskRecoveryWorker,
    ...(taskWorkerSource ? { taskWorkerSource } : {}),
    taskAdmissionWorker,
  };
}

function parseInterfaceAgent(argv: string[]): string | undefined {
  const eqArg = argv.find((a) => a.startsWith("--agent="));
  const idx = argv.indexOf("--agent");
  if (!eqArg && idx === -1) return undefined;
  const agent = (eqArg ? eqArg.slice("--agent=".length) : argv[idx + 1])?.trim();
  if (!agent || agent.startsWith("--")) throw new Error("--agent requires an agent name");
  return agent;
}
