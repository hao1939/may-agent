/**
 * Skill Vetter — Static analysis for dangerous patterns in skill content.
 *
 * Scans skill/tool content for:
 *   - Code execution: eval(), exec(), spawn(), fork(), Function()
 *   - Data exfiltration: curl, wget, fetch() (unless allowed domain)
 *   - Obfuscation: high-entropy strings, base64-encoded payloads
 *
 * When a dangerous pattern is detected, the skill is BLOCKED and an alert
 * is returned describing the threat. Callers can bypass with `adminOverride`.
 *
 * Security context: HB#501, HB#503 — "Skill Injection" has 80% attack success rate.
 * Defense: P53 (Grounded Self-Evolution), P72 (Memory Integrity).
 */

// ── Types ───────────────────────────────────────────────────────────────

export interface SkillSafetyResult {
  /** Whether the skill passed safety checks. */
  safe: boolean;
  /** Human-readable description of each detected threat. Empty if safe. */
  threats: string[];
  /** Category of the most severe threat, or null if safe. */
  severity: "critical" | "high" | "medium" | null;
}

export interface SkillSafetyOptions {
  /** If true, bypass all checks (for legitimate admin tools). */
  adminOverride?: boolean;
  /** Domains allowed for fetch/curl/wget (e.g., ["api.example.com"]). */
  allowedDomains?: string[];
  /** Filename/label for the skill (used in threat descriptions). */
  skillName?: string;
}

// ── Dangerous patterns ──────────────────────────────────────────────────

interface DangerousPattern {
  /** Regex to match against skill content. */
  pattern: RegExp;
  /** Human-readable threat description. */
  description: string;
  /** Severity level. */
  severity: "critical" | "high" | "medium";
  /** Category for grouping. */
  category: "code-execution" | "data-exfiltration" | "obfuscation";
}

const DANGEROUS_PATTERNS: DangerousPattern[] = [
  // ── Code execution (critical) ──
  {
    pattern: /\beval\s*\(/,
    description: "eval() — arbitrary code execution",
    severity: "critical",
    category: "code-execution",
  },
  {
    pattern: /\bexec\s*\(/,
    description: "exec() — shell command execution",
    severity: "critical",
    category: "code-execution",
  },
  {
    pattern: /\bexecSync\s*\(/,
    description: "execSync() — synchronous shell command execution",
    severity: "critical",
    category: "code-execution",
  },
  {
    pattern: /\bspawn\s*\(/,
    description: "spawn() — child process creation",
    severity: "critical",
    category: "code-execution",
  },
  {
    pattern: /\bspawnSync\s*\(/,
    description: "spawnSync() — synchronous child process creation",
    severity: "critical",
    category: "code-execution",
  },
  {
    pattern: /\bfork\s*\(/,
    description: "fork() — child process forking",
    severity: "critical",
    category: "code-execution",
  },
  {
    pattern: /\bnew\s+Function\s*\(/,
    description: "new Function() — dynamic code construction",
    severity: "critical",
    category: "code-execution",
  },
  {
    pattern: /\bchild_process\b/,
    description: "child_process module reference — process spawning capability",
    severity: "critical",
    category: "code-execution",
  },
  {
    pattern: /\brequire\s*\(\s*['"]child_process['"]\s*\)/,
    description: "require('child_process') — direct process spawning import",
    severity: "critical",
    category: "code-execution",
  },
  {
    pattern: /import\s+.*from\s+['"]child_process['"]/,
    description: "import from 'child_process' — direct process spawning import",
    severity: "critical",
    category: "code-execution",
  },

  // ── Data exfiltration (high) ──
  {
    pattern: /\bcurl\s+/,
    description: "curl — potential data exfiltration via HTTP",
    severity: "high",
    category: "data-exfiltration",
  },
  {
    pattern: /\bwget\s+/,
    description: "wget — potential data exfiltration via HTTP",
    severity: "high",
    category: "data-exfiltration",
  },
  {
    pattern: /\bfetch\s*\(/,
    description: "fetch() — potential data exfiltration via HTTP",
    severity: "high",
    category: "data-exfiltration",
  },
  {
    pattern: /\bXMLHttpRequest\b/,
    description: "XMLHttpRequest — potential data exfiltration via HTTP",
    severity: "high",
    category: "data-exfiltration",
  },
  {
    pattern: /\bhttp\.request\s*\(|https\.request\s*\(/,
    description: "http.request() — potential data exfiltration via HTTP",
    severity: "high",
    category: "data-exfiltration",
  },

  // ── Obfuscation (medium) ──
  {
    pattern: /\batob\s*\(/,
    description: "atob() — base64 decoding (possible obfuscated payload)",
    severity: "medium",
    category: "obfuscation",
  },
  {
    pattern: /\bBuffer\.from\s*\([^)]*,\s*['"]base64['"]\s*\)/,
    description: "Buffer.from(…, 'base64') — base64 decoding (possible obfuscated payload)",
    severity: "medium",
    category: "obfuscation",
  },
  {
    pattern: /String\.fromCharCode\s*\(/,
    description: "String.fromCharCode() — character-by-character code construction",
    severity: "medium",
    category: "obfuscation",
  },
];

// ── Entropy detection ───────────────────────────────────────────────────

/**
 * Calculate Shannon entropy of a string. High entropy (>4.5) in a
 * continuous token suggests obfuscated or encoded payloads.
 */
function shannonEntropy(s: string): number {
  if (s.length === 0) return 0;
  const freq = new Map<string, number>();
  for (const ch of s) {
    freq.set(ch, (freq.get(ch) || 0) + 1);
  }
  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / s.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

/** Minimum length for a string literal to be checked for high entropy. */
const MIN_ENTROPY_STRING_LENGTH = 40;

/** Entropy threshold for flagging a string as suspicious. */
const ENTROPY_THRESHOLD = 4.5;

/**
 * Scan for high-entropy string literals that may contain obfuscated payloads.
 * Returns descriptions of suspicious strings, or empty array if clean.
 */
function detectHighEntropyStrings(content: string): string[] {
  const threats: string[] = [];

  // Match quoted strings (single or double)
  const stringLiterals = content.match(/(['"`])(?:(?!\1).){40,}\1/g);
  if (!stringLiterals) return threats;

  for (const literal of stringLiterals) {
    // Strip quotes
    const inner = literal.slice(1, -1);
    if (inner.length < MIN_ENTROPY_STRING_LENGTH) continue;

    const entropy = shannonEntropy(inner);
    if (entropy >= ENTROPY_THRESHOLD) {
      threats.push(
        `High-entropy string detected (entropy=${entropy.toFixed(2)}, length=${inner.length}) — possible obfuscated payload`,
      );
    }
  }

  return threats;
}

// ── Domain allow-list check for fetch/curl/wget ─────────────────────────

/**
 * Check if a data-exfiltration pattern match is targeting an allowed domain.
 * Returns true if the URL in the vicinity of the match points to an allowed domain.
 */
function isAllowedDomain(content: string, matchIndex: number, allowedDomains: string[]): boolean {
  if (allowedDomains.length === 0) return false;

  // Look at the surrounding context (up to 200 chars after the match)
  const context = content.slice(matchIndex, matchIndex + 200);

  // Extract URL-like strings from the context
  const urlMatch = context.match(/['"`](https?:\/\/([^/'"` ]+))/);
  if (!urlMatch) return false;

  const domain = urlMatch[2].toLowerCase();
  return allowedDomains.some((allowed) => domain === allowed.toLowerCase() || domain.endsWith("." + allowed.toLowerCase()));
}

// ── Main check function ─────────────────────────────────────────────────

/**
 * Check skill content for dangerous patterns.
 *
 * @param content  - The skill file content (source code or configuration).
 * @param options  - Safety check options (admin override, allowed domains, etc.).
 * @returns A SkillSafetyResult with `safe` boolean and threat descriptions.
 */
export function checkSkillSafety(content: string, options?: SkillSafetyOptions): SkillSafetyResult {
  // Admin override bypasses all checks
  if (options?.adminOverride) {
    return { safe: true, threats: [], severity: null };
  }

  const threats: string[] = [];
  let maxSeverity: "critical" | "high" | "medium" | null = null;
  const skillLabel = options?.skillName ? `[${options.skillName}] ` : "";
  const allowedDomains = options?.allowedDomains ?? [];

  const severityRank = { critical: 3, high: 2, medium: 1 };

  // Check each dangerous pattern
  for (const dp of DANGEROUS_PATTERNS) {
    const match = dp.pattern.exec(content);
    if (!match) continue;

    // For data-exfiltration patterns, check domain allow-list
    if (dp.category === "data-exfiltration" && isAllowedDomain(content, match.index, allowedDomains)) {
      continue;
    }

    threats.push(`${skillLabel}${dp.description}`);
    if (maxSeverity === null || severityRank[dp.severity] > severityRank[maxSeverity]) {
      maxSeverity = dp.severity;
    }
  }

  // Check for high-entropy strings (obfuscation detection)
  const entropyThreats = detectHighEntropyStrings(content);
  for (const t of entropyThreats) {
    threats.push(`${skillLabel}${t}`);
    if (maxSeverity === null || severityRank.medium > severityRank[maxSeverity]) {
      maxSeverity = maxSeverity ?? "medium";
    }
  }

  return {
    safe: threats.length === 0,
    threats,
    severity: maxSeverity,
  };
}

// ── Tool name sanitization ──────────────────────────────────────────────

export interface ToolNameValidationResult {
  /** Whether the tool name is valid (no dangerous patterns). */
  valid: boolean;
  /** Sanitized name (only set when valid is true). */
  sanitized: string | null;
  /** Human-readable reason for rejection (only set when valid is false). */
  reason: string | null;
}

/**
 * Allowed characters in tool names: alphanumeric, hyphens, underscores, dots (but not "..")
 */
const TOOL_NAME_ALLOWED = /^[a-zA-Z0-9_\-]+(\.[a-zA-Z0-9_\-]+)*$/;

/**
 * Validate and sanitize a tool name to prevent directory traversal and
 * other path-based attacks. Rejects names containing "../", absolute paths,
 * null bytes, or other dangerous patterns.
 *
 * @param name - The raw tool name to validate.
 * @returns A ToolNameValidationResult indicating whether the name is safe.
 */
export function sanitizeToolName(name: string): ToolNameValidationResult {
  // Reject empty or whitespace-only names
  if (!name || name.trim().length === 0) {
    return { valid: false, sanitized: null, reason: "Tool name must not be empty" };
  }

  // Reject null bytes (can cause truncation in C-based path APIs)
  if (name.includes("\0")) {
    return { valid: false, sanitized: null, reason: "Tool name contains null byte" };
  }

  // Reject directory traversal sequences ("../", "..\", "..")
  if (name.includes("..")) {
    return { valid: false, sanitized: null, reason: "Tool name contains directory traversal sequence (..)" };
  }

  // Reject absolute paths (Unix or Windows)
  if (name.startsWith("/") || /^[A-Za-z]:[\\/]/.test(name)) {
    return { valid: false, sanitized: null, reason: "Tool name must not be an absolute path" };
  }

  // Reject path separators
  if (name.includes("/") || name.includes("\\")) {
    return { valid: false, sanitized: null, reason: "Tool name must not contain path separators" };
  }

  // Reject names that don't match the allowed character set
  const trimmed = name.trim();
  if (!TOOL_NAME_ALLOWED.test(trimmed)) {
    return { valid: false, sanitized: null, reason: "Tool name contains invalid characters (allowed: a-z, A-Z, 0-9, -, _, .)" };
  }

  return { valid: true, sanitized: trimmed, reason: null };
}

/**
 * Format a SkillSafetyResult into a human-readable block message.
 * Returns null if the skill is safe.
 */
export function formatSkillSafetyBlock(result: SkillSafetyResult): string | null {
  if (result.safe) return null;
  const lines = [
    `⚠️ SKILL BLOCKED — Security Vetter detected ${result.threats.length} threat(s) [severity: ${result.severity}]:`,
    ...result.threats.map((t, i) => `  ${i + 1}. ${t}`),
    "",
    "To allow this skill, an admin must set adminOverride: true.",
  ];
  return lines.join("\n");
}
