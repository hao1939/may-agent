/**
 * May-agent utility functions — hallucinated path resolution, meta-recursion detection.
 */

import { join } from "node:path";

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
 * Resolve a hallucinated absolute path to the actual project root.
 */
export function resolveHallucinatedPath(path: string, projectRoot: string): string {
  for (const pattern of HALLUCINATED_PATH_PATTERNS) {
    const match = path.match(pattern);
    if (match) {
      const [, , relativePart] = match;
      if (relativePart) {
        return join(projectRoot, relativePart);
      }
      return projectRoot;
    }
  }
  return path;
}

/**
 * Returns true if the shell command looks like it would recursively
 * start the agent runtime.
 */
export function isMetaRecursionCommand(command: string): boolean {
  const patterns = [
    /\bmay-agent\b/,
    /\bnode\s+.*dist\/cli/,
    /\bnpx\s+may-agent\b/,
    /\bts-node\s+.*src\/cli/,
    /\btsx\s+.*src\/cli/,
  ];
  return patterns.some(p => p.test(command));
}
