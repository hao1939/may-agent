import type { Demand, WorkflowGuard, WorkflowGuardEvent } from "@may-agent/sdk";

/**
 * no-secret-leak guard — blocks workflow if step output contains API key patterns.
 *
 * This is a true cross-cutting invariant: no workflow handles secret detection,
 * and leaking secrets in output is always wrong regardless of context.
 *
 * Uses block demands (hard stop) for high-confidence matches and warn demands
 * for medium-confidence patterns that could be false positives.
 */

/** High-confidence patterns — these are almost certainly real secrets */
const BLOCK_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  // OpenAI
  { name: "OpenAI API key", pattern: /sk-[A-Za-z0-9]{20,}T3BlbkFJ[A-Za-z0-9]{20,}/ },
  { name: "OpenAI API key (proj)", pattern: /sk-proj-[A-Za-z0-9_-]{40,}/ },
  // Anthropic
  { name: "Anthropic API key", pattern: /sk-ant-[A-Za-z0-9_-]{40,}/ },
  // AWS
  { name: "AWS Access Key", pattern: /AKIA[0-9A-Z]{16}/ },
  { name: "AWS Secret Key", pattern: /(?:aws_secret_access_key|secret_key)\s*[=:]\s*[A-Za-z0-9/+=]{40}/ },
  // GitHub
  { name: "GitHub PAT (fine-grained)", pattern: /github_pat_[A-Za-z0-9_]{82}/ },
  { name: "GitHub PAT (classic)", pattern: /ghp_[A-Za-z0-9]{36}/ },
  { name: "GitHub OAuth", pattern: /gho_[A-Za-z0-9]{36}/ },
  // Stripe
  { name: "Stripe secret key", pattern: /sk_live_[A-Za-z0-9]{24,}/ },
  { name: "Stripe restricted key", pattern: /rk_live_[A-Za-z0-9]{24,}/ },
  // Generic private key blocks
  { name: "Private key", pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/ },
];

/** Medium-confidence patterns — might be false positives in code discussions */
const WARN_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  // Generic bearer tokens (long hex/base64 strings after Authorization header)
  { name: "Bearer token", pattern: /Authorization:\s*Bearer\s+[A-Za-z0-9._~+/=-]{30,}/ },
  // Generic API key assignment with long value
  { name: "Generic API key assignment", pattern: /(?:api[_-]?key|apikey|secret|token)\s*[=:]\s*["'][A-Za-z0-9_-]{20,}["']/i },
  // Slack tokens
  { name: "Slack token", pattern: /xox[bpors]-[A-Za-z0-9-]{10,}/ },
  // npm tokens
  { name: "npm token", pattern: /npm_[A-Za-z0-9]{36}/ },
];

/**
 * Redact the matched secret value for safe logging.
 * Shows first 4 chars + "..." to help identify without exposing the full value.
 */
function redact(match: string): string {
  if (match.length <= 8) return "***";
  return match.slice(0, 4) + "..." + match.slice(-2);
}

export const guard: WorkflowGuard = {
  name: "no-secret-leak",
  events: ["step_done"],

  handle(event: WorkflowGuardEvent): Demand[] {
    if (event.type !== "step_done") return [];

    const text = event.result.lastAssistantText ?? "";
    if (!text) return [];

    const demands: Demand[] = [];

    // Check high-confidence patterns → block
    for (const { name, pattern } of BLOCK_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        demands.push({
          type: "block",
          reason: `🚨 Secret leak detected in step "${event.step}": ${name} found (${redact(match[0])}). Workflow halted to prevent exposure.`,
        });
      }
    }

    // If we already have blocks, skip warn-level checks
    if (demands.length > 0) return demands;

    // Check medium-confidence patterns → warn
    for (const { name, pattern } of WARN_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        demands.push({
          type: "warn",
          reason: `⚠️ Possible secret in step "${event.step}": ${name} pattern detected (${redact(match[0])}). Review output for leaked credentials.`,
        });
      }
    }

    return demands;
  },
};
