/**
 * path-guard — Validates bash commands and file paths against safety rules.
 */

export interface PathValidationResult {
  valid: boolean;
  reason?: string;
}

const BLOCKED_PATTERNS = [
  /\/home\//,
  /\/root\//,
  /\/etc\/shadow/,
  /\/etc\/passwd/,
  /rm\s+-rf\s+\//,
];

export function validateBashCommand(command: string): PathValidationResult {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(command)) {
      return { valid: false, reason: `Command matches blocked pattern: ${pattern}` };
    }
  }
  return { valid: true };
}

export function enforceNoHallucinatedPaths(paths: string[]): PathValidationResult {
  for (const p of paths) {
    if (/^\/home\//.test(p) || /^\/root\//.test(p) || /^\/tmp\/hallucinated/.test(p)) {
      return { valid: false, reason: `Suspicious path: ${p}` };
    }
  }
  return { valid: true };
}
