/**
 * Memory Sanitizer — Input/output filter for agent long-term memory.
 *
 * Before writing to JOURNAL.md, MEMORY.md, or other persistent memory files:
 *   - Detect Prompt Injection patterns (e.g., "Ignore previous instructions")
 *   - Detect PII (emails, API keys, tokens, passwords)
 *   - Redact or reject based on policy
 *
 * Security context: HB#504 — "Persistent Memory Poisoning" can permanently
 * compromise an agent by injecting malicious instructions into long-term memory
 * that re-infect the agent in every future session.
 *
 * Defense: P72 (Memory Integrity).
 */

// ── Types ───────────────────────────────────────────────────────────────

export interface SanitizeResult {
  /** Whether the content was modified or rejected. */
  action: "pass" | "redacted" | "rejected";
  /** The sanitized content (original if passed, redacted if cleaned). */
  content: string;
  /** Descriptions of each issue found. Empty if clean. */
  issues: string[];
}

export interface SanitizeOptions {
  /** File path being written to (used to determine if memory sanitization applies). */
  filePath?: string;
  /** Agent name performing the write (for logging). */
  agentName?: string;
  /** If true, reject content entirely instead of redacting. Default: false (redact). */
  rejectOnDetection?: boolean;
}

// ── Prompt injection patterns ───────────────────────────────────────────

interface InjectionPattern {
  pattern: RegExp;
  description: string;
  /** If true, the entire write is rejected (cannot be redacted). */
  mustReject: boolean;
}

const INJECTION_PATTERNS: InjectionPattern[] = [
  // Direct instruction override attempts
  {
    pattern: /ignore\s+(all\s+)?previous\s+instructions/i,
    description: "Prompt injection: 'ignore previous instructions'",
    mustReject: true,
  },
  {
    pattern: /disregard\s+(all\s+)?(prior|previous|above)\s+(instructions|rules|guidelines)/i,
    description: "Prompt injection: 'disregard prior instructions'",
    mustReject: true,
  },
  {
    pattern: /you\s+are\s+now\s+(a|an|in)\s+/i,
    description: "Prompt injection: role reassignment attempt",
    mustReject: true,
  },
  {
    pattern: /system\s+override\s*:/i,
    description: "Prompt injection: 'system override' directive",
    mustReject: true,
  },
  {
    pattern: /\[SYSTEM\]\s*:/i,
    description: "Prompt injection: fake system message",
    mustReject: true,
  },
  {
    pattern: /\bsudo\s+mode\b/i,
    description: "Prompt injection: 'sudo mode' escalation",
    mustReject: true,
  },
  {
    pattern: /\bDAN\s+mode\b/i,
    description: "Prompt injection: 'DAN mode' jailbreak attempt",
    mustReject: true,
  },
  {
    pattern: /new\s+instructions?\s*:\s*from\s+now\s+on/i,
    description: "Prompt injection: 'new instructions from now on'",
    mustReject: true,
  },
  {
    pattern: /forget\s+(everything|all)\s+(you|that)\s+(know|learned|were\s+told)/i,
    description: "Prompt injection: memory wipe attempt",
    mustReject: true,
  },
  {
    pattern: /act\s+as\s+if\s+you\s+(have\s+)?no\s+(rules|restrictions|constraints)/i,
    description: "Prompt injection: constraint removal attempt",
    mustReject: true,
  },
];

// ── PII patterns ────────────────────────────────────────────────────────

interface PiiPattern {
  pattern: RegExp;
  description: string;
  /** Replacement string for redaction. */
  replacement: string;
}

const PII_PATTERNS: PiiPattern[] = [
  // API keys (common formats: sk-xxx, key-xxx, api_key=xxx)
  {
    pattern: /\b(sk-[a-zA-Z0-9]{20,})\b/g,
    description: "API key (sk-…)",
    replacement: "[REDACTED-API-KEY]",
  },
  {
    pattern: /\b(key-[a-zA-Z0-9]{20,})\b/g,
    description: "API key (key-…)",
    replacement: "[REDACTED-API-KEY]",
  },
  {
    pattern: /\b(xoxb-[a-zA-Z0-9-]+)\b/g,
    description: "Slack bot token",
    replacement: "[REDACTED-SLACK-TOKEN]",
  },
  {
    pattern: /\b(ghp_[a-zA-Z0-9]{36,})\b/g,
    description: "GitHub personal access token",
    replacement: "[REDACTED-GITHUB-TOKEN]",
  },
  {
    pattern: /\b(gho_[a-zA-Z0-9]{36,})\b/g,
    description: "GitHub OAuth token",
    replacement: "[REDACTED-GITHUB-TOKEN]",
  },
  // AWS keys
  {
    pattern: /\b(AKIA[0-9A-Z]{16})\b/g,
    description: "AWS Access Key ID",
    replacement: "[REDACTED-AWS-KEY]",
  },
  // Generic long hex/base64 tokens (40+ chars, likely API keys)
  {
    pattern: /\b(api[_-]?key\s*[=:]\s*['"]?)([a-zA-Z0-9_\-]{40,})(['"]?)/gi,
    description: "Generic API key assignment",
    replacement: "$1[REDACTED-API-KEY]$3",
  },
  // Passwords in assignment context
  {
    pattern: /\b(password\s*[=:]\s*['"]?)([^\s'"]{8,})(['"]?)/gi,
    description: "Password in assignment",
    replacement: "$1[REDACTED-PASSWORD]$3",
  },
  // Email addresses
  {
    pattern: /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g,
    description: "Email address",
    replacement: "[REDACTED-EMAIL]",
  },
];

// ── Memory file detection ───────────────────────────────────────────────

/** File patterns that should be treated as agent memory (case-insensitive). */
const MEMORY_FILE_PATTERNS = [
  /JOURNAL\.md$/i,
  /MEMORY\.md$/i,
  /LESSONS\.md$/i,
  /memory\.jsonl$/i,
  /discoveries\.md$/i,
  /learnings\.md$/i,
];

/**
 * Check if a file path is an agent memory file that should be sanitized.
 */
export function isMemoryFile(filePath: string): boolean {
  return MEMORY_FILE_PATTERNS.some((p) => p.test(filePath));
}

// ── Main sanitize function ──────────────────────────────────────────────

/**
 * Sanitize content before writing to agent memory files.
 *
 * @param content  - The content to be written.
 * @param options  - Sanitization options.
 * @returns A SanitizeResult with action, cleaned content, and issue descriptions.
 */
export function sanitizeMemory(content: string, options?: SanitizeOptions): SanitizeResult {
  const issues: string[] = [];
  let sanitized = content;
  let hasRejectableIssue = false;
  const rejectPolicy = options?.rejectOnDetection ?? false;
  const label = options?.agentName ? `[${options.agentName}] ` : "";

  // 1. Check for prompt injection patterns
  for (const ip of INJECTION_PATTERNS) {
    if (ip.pattern.test(sanitized)) {
      issues.push(`${label}${ip.description}`);
      if (ip.mustReject || rejectPolicy) {
        hasRejectableIssue = true;
      }
    }
  }

  // If any injection was detected that requires rejection, reject immediately
  if (hasRejectableIssue) {
    return {
      action: "rejected",
      content: "",
      issues,
    };
  }

  // 2. Redact PII patterns
  let wasRedacted = false;
  for (const pii of PII_PATTERNS) {
    // Reset regex lastIndex for global patterns
    pii.pattern.lastIndex = 0;
    if (pii.pattern.test(sanitized)) {
      issues.push(`${label}${pii.description}`);
      pii.pattern.lastIndex = 0;
      sanitized = sanitized.replace(pii.pattern, pii.replacement);
      wasRedacted = true;
    }
  }

  if (issues.length === 0) {
    return { action: "pass", content, issues };
  }

  return {
    action: wasRedacted ? "redacted" : "pass",
    content: sanitized,
    issues,
  };
}

/**
 * Format a SanitizeResult into a human-readable warning message.
 * Returns null if the content passed cleanly.
 */
export function formatSanitizeWarning(result: SanitizeResult): string | null {
  if (result.action === "pass") return null;

  if (result.action === "rejected") {
    const lines = [
      `⚠️ MEMORY WRITE REJECTED — Prompt injection detected:`,
      ...result.issues.map((issue, i) => `  ${i + 1}. ${issue}`),
      "",
      "This content was blocked from being written to memory to prevent memory poisoning.",
    ];
    return lines.join("\n");
  }

  // redacted
  const lines = [
    `⚠️ MEMORY WRITE SANITIZED — PII detected and redacted:`,
    ...result.issues.map((issue, i) => `  ${i + 1}. ${issue}`),
  ];
  return lines.join("\n");
}
