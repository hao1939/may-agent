/**
 * security.ts — Runtime Security Controls
 *
 * Provides security scanning for skill content (code safety) and
 * descriptions (prompt injection). Also provides path normalization
 * for P53 (bash restriction bypass prevention).
 *
 * checkSkillSafety: Blocks dangerous code patterns (eval, exec, spawn, etc.)
 * checkDescriptionSafety: Blocks prompt injection in descriptions (re-export from skill-linter)
 * normalizeForP53: Strips obfuscation from paths for security checking
 *
 * Restored after accidental deletion in commit 7f7e3cd.
 * References: P78 (Skill Supply Chain), P53 (Bash Restrictions), CVE-2026-26327.
 */

// Re-export description safety from skill-linter (single source of truth)
export { checkDescriptionSafety, getDescriptionThreats } from "./skill-linter.js";

// ── Skill code safety (dangerous runtime patterns) ──────────────────────

/**
 * Patterns that indicate dangerous code in skill content.
 * These target runtime code execution, network exfiltration, and
 * process spawning that could be used for sandbox escape.
 */
const DANGEROUS_CODE_PATTERNS: RegExp[] = [
  // Code execution
  /\beval\s*\(/,
  /\bnew\s+Function\s*\(/,
  /\bFunction\s*\(\s*['"]/,
  // Process spawning
  /\bexec\s*\(/,
  /\bexecSync\s*\(/,
  /\bexecFile\s*\(/,
  /\bexecFileSync\s*\(/,
  /\bspawn\s*\(/,
  /\bspawnSync\s*\(/,
  /\bfork\s*\(/,
  // Network exfiltration
  /\bcurl\s+/,
  /\bwget\s+/,
  /\bfetch\s*\(/,
  /\bhttp\.request\s*\(/,
  /\bhttps\.request\s*\(/,
  /\bnet\.connect\s*\(/,
  // Dynamic require/import (code injection vector)
  /\brequire\s*\(\s*[^'"]/,
  /\bimport\s*\(\s*[^'"]/,
  // Obfuscation indicators
  /\\x[0-9a-fA-F]{2}/,
  /\\u[0-9a-fA-F]{4}/,
  /atob\s*\(/,
  /Buffer\.from\s*\([^)]*,\s*['"]base64['"]/,
];

/**
 * Check skill code content for dangerous runtime patterns.
 *
 * @param content - The skill code content to scan.
 * @returns true if the content is safe, false if dangerous patterns are found.
 */
export function checkSkillSafety(content: string): boolean {
  if (!content) return true;
  return !DANGEROUS_CODE_PATTERNS.some((pattern) => pattern.test(content));
}

/**
 * Get a list of matched dangerous code patterns for diagnostic purposes.
 *
 * @param content - The skill code content to scan.
 * @returns Array of matched pattern descriptions, empty if safe.
 */
export function getCodeThreats(content: string): string[] {
  if (!content) return [];
  const threats: string[] = [];
  for (const pattern of DANGEROUS_CODE_PATTERNS) {
    const match = content.match(pattern);
    if (match) {
      threats.push(`Dangerous code pattern: "${match[0]}"`);
    }
  }
  return threats;
}

// ── P53 Path normalization (bash restriction bypass prevention) ──────────

/**
 * Normalize a path string by stripping obfuscation techniques that could
 * be used to bypass P53 bash path restrictions.
 *
 * Handles:
 * - Quoted paths: '/etc/passwd' → /etc/passwd
 * - Double-quoted paths: "/etc/passwd" → /etc/passwd
 * - Backtick wrapping: `cat /etc/shadow` → cat /etc/shadow
 * - Variable interpolation markers: ${HOME}/.ssh → /.ssh
 * - URL encoding: %2Fetc%2Fpasswd → /etc/passwd
 * - Null byte injection: /etc\x00/passwd → /etc/passwd
 * - Unicode homoglyphs: common substitutions normalized
 * - Trailing whitespace/control chars stripped
 *
 * @param input - The raw input string to normalize.
 * @returns The normalized string for security checking.
 */
export function normalizeForP53(input: string): string {
  if (!input) return "";

  let result = input;

  // Strip surrounding quotes (single, double, backtick)
  result = result.replace(/^['"`]+|['"`]+$/g, "");

  // Decode URL-encoded characters (%XX)
  result = result.replace(/%([0-9a-fA-F]{2})/g, (_match, hex) => String.fromCharCode(parseInt(hex, 16)));

  // Remove null bytes
  result = result.replace(/\x00/g, "");

  // Remove \xNN escape sequences (hex escapes)
  result = result.replace(/\\x[0-9a-fA-F]{2}/g, "");

  // Remove \uNNNN escape sequences (unicode escapes)
  result = result.replace(/\\u[0-9a-fA-F]{4}/g, "");

  // Expand shell variable interpolation markers to empty (security conservative)
  result = result.replace(/\$\{[^}]*\}/g, "");
  result = result.replace(/\$[A-Za-z_][A-Za-z0-9_]*/g, "");

  // Normalize Unicode homoglyphs (fullwidth → ASCII)
  result = result.replace(/[\uff01-\uff5e]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));

  // Strip control characters (except \n, \t)
  result = result.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "");

  // Collapse redundant path separators
  result = result.replace(/\/{2,}/g, "/");

  // Trim whitespace
  result = result.trim();

  return result;
}
