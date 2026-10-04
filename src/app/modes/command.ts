import type { InterfaceBinding } from "@may-agent/control";

export async function runStatusMode(opts: {
  persistDir: string;
  notify: boolean;
}): Promise<void> {
  const { printSystemStatus, notifyStatus } = await import("../../lib/tools/system-dashboard.js");
  const statusOutput = printSystemStatus(opts.persistDir);
  console.log(statusOutput);
  if (opts.notify) {
    await notifyStatus(opts.persistDir);
  }
}

export async function runMessageMode(opts: {
  argv: string[];
  socketPath: string;
  interface: InterfaceBinding;
}): Promise<number> {
  const { parseSendArgs, cliSend } = await import("../cli-send.js");
  const sendOpts = parseSendArgs(opts.argv);
  if (!sendOpts) return 0;

  const delivered = await cliSend({ ...sendOpts, socketPath: opts.socketPath, interface: opts.interface });
  return delivered ? 0 : 1;
}
