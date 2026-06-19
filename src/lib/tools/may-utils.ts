/**
 * May-agent utility functions — hallucinated path detection, meta-recursion detection.
 */

/**
 * Patterns that match hallucinated project root paths.
 */
const HALLUCINATED_PATH_PATTERNS: RegExp[] = [
  /^(\/home\/[^/]+\/repos\/[^/]+)(\/.*)?$/,
  /^(\/home\/[^/]+\/repo)(\/.*)?$/,
  /^(\/home\/user)(\/.*)?$/,
  /^(\/home\/[^/]+\/[^/]+)(\/.*)?$/,
  /^(\/Users\/[^/]+\/[^/]+)(\/.*)?$/,
  /^(\/app)(\/.*)?$/,
];

/**
 * Extract the relative-path suffix from a hallucinated absolute path.
 */
export function extractHallucinatedRelPath(path: string): string | null {
  for (const pattern of HALLUCINATED_PATH_PATTERNS) {
    const match = path.match(pattern);
    if (match) {
      return match[2] ?? "/";
    }
  }
  return null;
}

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
