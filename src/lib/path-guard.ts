/**
 * Path Guard — prevents hallucinated paths (C7.1).
 *
 * Validates that bash commands and file paths don't reference
 * non-existent directories like /home/, /Users/, /root/ etc.
 * The project root is /app — all valid paths start there.
 */

export interface PathValidationResult {
  valid: boolean;
  reason?: string;
  hallucinatedPaths?: string[];
}

const HALLUCINATED_PREFIXES = [
  "/home/",
  "/Users/",
  "/root/",
  "/var/home/",
  "/tmp/project/",
];

/**
 * Validate a bash command for hallucinated paths.
 */
export function validateBashCommand(command: string): PathValidationResult {
  const found: string[] = [];
  for (const prefix of HALLUCINATED_PREFIXES) {
    if (command.includes(prefix)) {
      // Extract the full path
      const regex = new RegExp(`(${prefix.replace("/", "\\/")}[^\\s"']+)`, "g");
      const matches = command.match(regex);
      if (matches) found.push(...matches);
    }
  }

  if (found.length > 0) {
    return {
      valid: false,
      reason: `Command contains hallucinated path(s): ${found.join(", ")}. The project root is /app.`,
      hallucinatedPaths: found,
    };
  }

  return { valid: true };
}

/**
 * Check a list of file paths for hallucinated entries.
 */
export function enforceNoHallucinatedPaths(paths: string[]): PathValidationResult {
  const hallucinated: string[] = [];

  for (const p of paths) {
    for (const prefix of HALLUCINATED_PREFIXES) {
      if (p.startsWith(prefix)) {
        hallucinated.push(p);
        break;
      }
    }
  }

  if (hallucinated.length > 0) {
    return {
      valid: false,
      reason: `Hallucinated paths detected: ${hallucinated.join(", ")}. Use /app as project root.`,
      hallucinatedPaths: hallucinated,
    };
  }

  return { valid: true };
}
