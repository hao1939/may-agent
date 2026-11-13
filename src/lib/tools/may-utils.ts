/**
 * May-agent utility functions — meta-recursion detection.
 */

/**
 * Returns true if the shell command looks like it would recursively
 * start the agent runtime.
 */
export function isMetaRecursionCommand(command: string): boolean {
  if (/\bsupervisorctl\s+start\s+may-agent-restarter\b/.test(command)) return false;
  const patterns = [
    /\bmay-agent\b/,
    /\bnode\s+.*dist\/cli/,
    /\bnpx\s+may-agent\b/,
    /\bts-node\s+.*src\/cli/,
    /\btsx\s+.*src\/cli/,
    /\bbun\s+src\/app\/(may|launcher)\.ts\b/,
    /\bsupervisorctl\b/, // process control belongs to runtime.restart.requested / may-agent-restarter
  ];
  return patterns.some((p) => p.test(command));
}
