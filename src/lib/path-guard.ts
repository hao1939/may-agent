/**
 * Path Guard — C7.1 Hallucinated Path Enforcement.
 *
 * Validates bash commands to reject references to /home/ paths,
 * which are hallucinated in the container environment (actual root: /app).
 *
 * Integration: Call `validateBashCommand()` before executing any bash
 * tool invocation.
 *
 * Uses only Node.js built-in modules — no external dependencies.
 */

// ── Interfaces ────────────────────────────────────────────────────────

export interface PathValidationResult {
  valid: boolean;
  /** The offending path segments found (empty if valid). */
  offendingPaths: string[];
  /** Human-readable error message (present only when valid === false). */
  error?: string;
}

// ── Constants ─────────────────────────────────────────────────────────

/**
 * Patterns that indicate hallucinated paths.
 * Matches /home/user, /home/ubuntu, /home/agent, etc.
 * Also catches ~ expansion references in explicit paths.
 */
const HALLUCINATED_PATH_PATTERNS = [
  /\/home\/\w+/g,
  /~\/(?!\.)/g, // ~/something (but not standalone ~)
];

/**
 * Allowlist: patterns that look like /home/ but are legitimate.
 * E.g., grep searching for the string "/home/", or echo/printf.
 */
const ALLOWLIST_PATTERNS = [
  /grep\s+.*\/home\//,     // Searching for /home/ in grep
  /echo\s+["'].*\/home\//, // Echoing a string containing /home/
  /printf\s+.*\/home\//,   // Printf with /home/
  /sed\s+.*\/home\//,      // Sed replacement containing /home/
];

// ── Public API ────────────────────────────────────────────────────────

/**
 * Validate a bash command for hallucinated /home/ paths.
 *
 * @param command  The bash command string to validate.
 * @returns PathValidationResult — check `.valid` before executing.
 */
export function validateBashCommand(command: string): PathValidationResult {
  // Check allowlist first — some commands legitimately reference /home/
  for (const allow of ALLOWLIST_PATTERNS) {
    if (allow.test(command)) {
      return { valid: true, offendingPaths: [] };
    }
  }

  const offendingPaths: string[] = [];

  for (const pattern of HALLUCINATED_PATH_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(command)) !== null) {
      offendingPaths.push(match[0]);
    }
  }

  if (offendingPaths.length === 0) {
    return { valid: true, offendingPaths: [] };
  }

  // Deduplicate
  const unique = [...new Set(offendingPaths)];

  return {
    valid: false,
    offendingPaths: unique,
    error:
      `C7.1 Hallucinated Path: Your command references ${unique.map(p => `'${p}'`).join(", ")} ` +
      `which does not exist in this environment. The project root is /app. ` +
      `Use relative paths or /app/... instead of /home/... paths.`,
  };
}

/**
 * Convenience wrapper that throws on validation failure.
 * Call in the bash tool handler before executing the command.
 *
 * @param command The bash command to validate.
 * @throws Error with C7.1 message if hallucinated paths detected.
 */
export function enforceNoHallucinatedPaths(command: string): void {
  const result = validateBashCommand(command);
  if (!result.valid) {
    throw new Error(result.error);
  }
}
