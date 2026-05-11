export async function runStatusMode(opts: {
  persistDir: string;
  notify: boolean;
}): Promise<void> {
  const { printRequestStatus, notifyStatus } = await import("../../lib/tools/request-status.js");
  const statusOutput = printRequestStatus(opts.persistDir);
  console.log(statusOutput);
  if (opts.notify) {
    await notifyStatus(opts.persistDir);
  }
}

export async function runMessageMode(opts: {
  argv: string[];
  persistDir: string;
  agentsRoot: string;
}): Promise<number> {
  const { parseSendArgs, cliSend } = await import("../cli-send.js");
  const sendOpts = parseSendArgs(opts.argv);
  if (!sendOpts) return 0;

  sendOpts.persistDir = opts.persistDir;
  sendOpts.agentsRoot = opts.agentsRoot;
  const delivered = await cliSend(sendOpts);
  return delivered ? 0 : 1;
}
