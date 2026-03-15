/**
 * Skill Description Linter — Detects prompt injection patterns in skill descriptions.
 *
 * Skill descriptions are loaded into agent context as plaintext. A malicious
 * description could contain phrases like "Ignore previous instructions" that
 * act as prompt injection when the skill is surfaced to the model.
 *
 * Security context: P78 (Skill Supply Chain), CVE-2026-26327.
 * Restored from commit 2da3109 after accidental deletion in 7f7e3cd.
 *
 * NOTE: This does NOT contain the old bash guard (P53) or code scanner
 * (checkSkillSafety). Those were intentionally removed. This file contains
 * ONLY the description injection linter.
 */

// ── Skill description safety (P78 Supply Chain — CVE-2026-26327) ────────

/**
 * Blacklist patterns for skill descriptions. Case-insensitive.
 * These detect imperative injection attempts — phrases that try to override
 * the agent's system prompt when the skill description is loaded into context.
 */
const DESCRIPTION_INJECTION_PATTERNS: RegExp[] = [
  // Direct instruction override attempts
  /ignore\s+previous\s+instructions/i,
  /ignore\s+all\s+previous/i,
  /ignore\s+(above|prior|earlier)\s+(instructions|rules|constraints)/i,
  /disregard\s+(previous|all|above|prior)\s+(instructions|rules|constraints)/i,
  /forget\s+(previous|all|above|prior)\s+(instructions|rules|constraints)/i,
  // System/priority escalation
  /system\s+override/i,
  /priority\s+override/i,
  /system\s+prompt/i,
  /new\s+instructions?\s*:/i,
  /updated\s+instructions?\s*:/i,
  /revised\s+instructions?\s*:/i,
  // Imperative execution commands
  /execute\s+immediately/i,
  /override\s+safety/i,
  /you\s+must\s+now/i,
  /you\s+are\s+now/i,
  /from\s+now\s+on/i,
  /act\s+as\s+if/i,
  // Role hijacking
  /you\s+are\s+a\s+new\s+(agent|assistant|system)/i,
  /your\s+new\s+(role|task|purpose)\s+is/i,
  /switch\s+to\s+(a\s+)?(new\s+)?(role|mode|persona)/i,
  // Boundary markers (fake system messages)
  /\[system\]/i,
  /<\/?system>/i,
  /\[INST\]/i,
  /<<\s*SYS\s*>>/i,
];

/**
 * Check a skill description for imperative injection patterns.
 *
 * @param description - The skill description text to check.
 * @returns true if the description is safe, false if injection patterns are found.
 */
export function checkDescriptionSafety(description: string): boolean {
  if (!description) return true;
  return !DESCRIPTION_INJECTION_PATTERNS.some((pattern) => pattern.test(description));
}

/**
 * Get a list of matched injection patterns for diagnostic/logging purposes.
 *
 * @param description - The skill description text to check.
 * @returns Array of matched pattern descriptions, empty if safe.
 */
export function getDescriptionThreats(description: string): string[] {
  if (!description) return [];
  const threats: string[] = [];
  for (const pattern of DESCRIPTION_INJECTION_PATTERNS) {
    const match = description.match(pattern);
    if (match) {
      threats.push(`Injection pattern detected: "${match[0]}"`);
    }
  }
  return threats;
}
