import type { AppArgs } from "./app-args.js";
import { runStatusMode } from "./modes/command.js";

/**
 * Run client-only control modes before daemon lifecycle ownership is created.
 * These commands inspect or contact an existing instance; they must never
 * overwrite that instance's identity record when they exit.
 */
export async function runRequestedControlExitMode(opts: {
  appArgs: AppArgs;
  persistDir: string;
}): Promise<number | null> {
  if (opts.appArgs.statusMode) {
    await runStatusMode({ persistDir: opts.persistDir, notify: opts.appArgs.notify });
    return 0;
  }

  return null;
}

export async function runRequestedExitMode(opts: {
  appArgs: AppArgs;
}): Promise<void> {
  const {
    consoleEnabled,
    cronEnabled,
    socketEnabled,
    telegramEnabled,
    webEnabled,
  } = opts.appArgs;

  if (
    !consoleEnabled &&
    !cronEnabled &&
    !webEnabled &&
    !socketEnabled &&
    !telegramEnabled
  ) {
    console.error(
      "Error: need --chat, --status, --emit, --web, --socket, --telegram, or --cron.",
    );
    process.exit(1);
  }
}
