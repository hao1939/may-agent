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
