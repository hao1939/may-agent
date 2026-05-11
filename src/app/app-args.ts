import { existsSync, readFileSync } from "node:fs";
import { parseEmitMode } from "./modes/emit.js";
import { parseOneshotTimeoutMinutes } from "./modes/oneshot.js";
import { parseRunWorkflowMode } from "./modes/run-workflow.js";

export interface AppArgs {
  cronEnabled: boolean;
  telegramEnabled: boolean;
  consoleEnabled: boolean;
  socketEnabled: boolean;
  webEnabled: boolean;
  chatMode: boolean;
  oneshotMode: boolean;
  statusMode: boolean;
  messageMode: boolean;
  emitMode: ReturnType<typeof parseEmitMode>;
  runWorkflow: ReturnType<typeof parseRunWorkflowMode>;
  dryRun: boolean;
  initialTask: string | null;
  interfaceAgent: string;
  webOnlyMode: boolean;
  oneshotTimeoutMinutes: number;
  notify: boolean;
  envSessionId?: string;
  envParentSessionId?: string;
  envParentAgent?: string;
}

export function parseAppArgs(argv: string[] = process.argv, env: NodeJS.ProcessEnv = process.env): AppArgs {
  const cronEnabled = argv.includes("--cron");
  const telegramEnabled = argv.includes("--telegram");
  const consoleEnabled = argv.includes("--console") || argv.includes("--chat");
  const socketEnabled = argv.includes("--socket");
  const webEnabled = argv.includes("--web");
  const chatMode = argv.includes("--chat");
  const oneshotMode = argv.includes("--oneshot");
  const statusMode = argv.includes("--status");
  const messageMode = argv.includes("--message");
  const emitMode = parseEmitMode(argv);
  const runWorkflow = parseRunWorkflowMode(argv);
  const dryRun = argv.includes("--dry-run");
  const initialTask = parseInitialTask(argv);
  const interfaceAgent = parseInterfaceAgent(argv, env);

  return {
    cronEnabled,
    telegramEnabled,
    consoleEnabled,
    socketEnabled,
    webEnabled,
    chatMode,
    oneshotMode,
    statusMode,
    messageMode,
    emitMode,
    runWorkflow,
    dryRun,
    initialTask,
    interfaceAgent,
    webOnlyMode: webEnabled
      && !chatMode
      && !cronEnabled
      && !socketEnabled
      && !telegramEnabled
      && !oneshotMode
      && !statusMode
      && !messageMode
      && !runWorkflow
      && !initialTask,
    oneshotTimeoutMinutes: parseOneshotTimeoutMinutes(argv),
    notify: argv.includes("--notify"),
    envSessionId: env.SESSION_ID || undefined,
    envParentSessionId: env.PARENT_SESSION_ID || undefined,
    envParentAgent: env.PARENT_AGENT || undefined,
  };
}

function parseInitialTask(argv: string[]): string | null {
  const idx = argv.indexOf("--task");
  if (idx !== -1 && argv[idx + 1]) return argv[idx + 1];

  const fileIdx = argv.indexOf("--task-file");
  if (fileIdx !== -1 && argv[fileIdx + 1]) {
    const taskFile = argv[fileIdx + 1];
    if (existsSync(taskFile)) return readFileSync(taskFile, "utf-8").trim();
    throw new Error(`Task file not found: ${taskFile}`);
  }

  return null;
}

function parseInterfaceAgent(argv: string[], env: NodeJS.ProcessEnv): string {
  const eqArg = argv.find((a) => a.startsWith("--agent="));
  if (eqArg) return eqArg.split("=")[1]!;

  const idx = argv.indexOf("--agent");
  if (idx !== -1 && argv[idx + 1]) return argv[idx + 1];

  return env.AGENT || "may";
}
