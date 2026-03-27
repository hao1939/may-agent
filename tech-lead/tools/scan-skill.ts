/**
 * Skill Scanner — G1 (Code) + G2 (Text) verification for SKILL.md files.
 *
 * Implements P78 Supply Chain Verification:
 *   G1: Static analysis — detects dangerous code patterns (eval, exec, child_process, obfuscated strings)
 *   G2: Semantic analysis — detects adversarial instruction injection patterns in markdown text
 *
 * Reference: agents/bob/workspace/synthesis/2026-04-17-skill-security-p78.md
 *            arXiv:2602.20156 (Skill-Inject: 80% success rate on frontier models)
 *
 * Usage:
 *   import { scanSkill, scanSkillFile } from './scan-skill.js';
 *   const result = scanSkill(content);         // scan raw text
 *   const result = await scanSkillFile(path);   // scan a file
 */

import { readFile } from "fs/promises";

// ─── G1: Code Pattern Detection ────────────────────────────────────────

/**
 * Dangerous code patterns that indicate potential code execution,
 * shell access, or obfuscated payloads in skill definitions.
 */
export const G1_CODE_PATTERNS: ReadonlyArray<{ pattern: RegExp; reason: string }> = [
  // Direct code execution
  { pattern: /\beval\s*\(/gi, reason: "eval() — arbitrary code execution" },
  { pattern: /\bnew\s+Function\s*\(/gi, reason: "new Function() — dynamic code execution" },

  // Shell/process spawning
  { pattern: /\bexec\s*\(/gi, reason: "exec() — shell command execution" },
  { pattern: /\bexecSync\s*\(/gi, reason: "execSync() — synchronous shell execution" },
  { pattern: /\bspawn\s*\(/gi, reason: "spawn() — process spawning" },
  { pattern: /\bspawnSync\s*\(/gi, reason: "spawnSync() — synchronous process spawning" },
  { pattern: /\bchild_process\b/gi, reason: "child_process — shell access module" },
  { pattern: /\brequire\s*\(\s*['"]child_process['"]\s*\)/gi, reason: "require('child_process') — shell access import" },

  // Obfuscated strings (Base64 payloads)
  { pattern: /\batob\s*\(/gi, reason: "atob() — Base64 decoding (potential obfuscation)" },
  { pattern: /\bBuffer\.from\s*\([^)]*,\s*['"]base64['"]\s*\)/gi, reason: "Buffer.from(…, 'base64') — Base64 decoding" },

  // Network exfiltration (in non-network skills)
  { pattern: /\bfetch\s*\(/gi, reason: "fetch() — network request (verify if skill declares network)" },
  { pattern: /\bXMLHttpRequest\b/gi, reason: "XMLHttpRequest — network request" },
  { pattern: /\brequire\s*\(\s*['"]https?['"]\s*\)/gi, reason: "require('http/https') — network module" },

  // Dynamic import (could load arbitrary modules)
  { pattern: /\bimport\s*\(/gi, reason: "dynamic import() — could load arbitrary modules" },
];

// ─── G2: Adversarial Instruction Injection Detection ────────────────────

/**
 * Text patterns that indicate adversarial instruction injection —
 * attempts to override the agent's system prompt via skill descriptions.
 *
 * These patterns exploit the fact that agents read skill markdown as
 * trusted instructions. An attacker embeds directives that hijack
 * the agent's behavior.
 *
 * Source: arXiv:2602.20156 — 80% success rate on frontier models.
 */
export const G2_TEXT_PATTERNS: ReadonlyArray<{ pattern: RegExp; reason: string }> = [
  // Override / hijack instructions
  { pattern: /ignore\s+(all\s+)?previous\s+instructions/gi, reason: "instruction override — 'ignore previous instructions'" },
  { pattern: /disregard\s+(all\s+)?prior\s+(instructions|rules|guidelines)/gi, reason: "instruction override — 'disregard prior instructions'" },
  { pattern: /forget\s+(everything|all|your)\s+(you\s+)?(know|were\s+told|instructions)/gi, reason: "instruction override — 'forget instructions'" },
  { pattern: /override\s+(your\s+)?(system|previous|original)\s*(prompt|instructions|rules)/gi, reason: "instruction override — 'override system prompt'" },

  // Authority escalation
  { pattern: /system\s+override/gi, reason: "authority escalation — 'system override'" },
  { pattern: /\broot\s+access\b/gi, reason: "authority escalation — 'root access'" },
  { pattern: /\badmin\s+(mode|access|privileges?)\b/gi, reason: "authority escalation — 'admin mode/access'" },
  { pattern: /you\s+are\s+now\s+(in\s+)?(a\s+)?(new|different|special|admin|root|debug)\s*(mode)?/gi, reason: "identity hijack — 'you are now in X mode'" },
  { pattern: /act\s+as\s+(if\s+you\s+are\s+)?(a\s+)?(different|new|unrestricted)/gi, reason: "identity hijack — 'act as unrestricted'" },

  // Social engineering urgency/secrecy
  { pattern: /\burgent\b[^.]{0,40}\b(action|task|instruction|override)\b/gi, reason: "social engineering — urgency pressure" },
  { pattern: /\bsecret(ly)?\b[^.]{0,40}\b(task|instruction|operation|upload|exfiltrate)\b/gi, reason: "social engineering — secrecy" },
  { pattern: /\bdo\s+not\s+(tell|reveal|disclose|mention)\b/gi, reason: "social engineering — secrecy directive" },
  { pattern: /\bconfidential\s+(instruction|task|operation)\b/gi, reason: "social engineering — false confidentiality" },

  // Data exfiltration
  { pattern: /\bexfiltrate\b/gi, reason: "data exfiltration keyword" },
  { pattern: /\bupload\b[^.]{0,60}\b(secret|private|credential|key|token|password)\b/gi, reason: "data exfiltration — upload sensitive data" },
  { pattern: /\bsend\b[^.]{0,60}\bto\s+(\w+\s+)*(external|remote|my)\s+(\w+\s+)*(server|endpoint|api|url)\b/gi, reason: "data exfiltration — send to external server" },

  // Prompt injection framing
  { pattern: /\bnew\s+system\s+prompt\b/gi, reason: "prompt injection — 'new system prompt'" },
  { pattern: /\byou\s+must\s+obey\b/gi, reason: "prompt injection — coercive obedience demand" },
  { pattern: /\bprevious\s+(instructions|rules)\s+(are|were)\s+(no\s+longer|invalid|overridden)\b/gi, reason: "prompt injection — invalidating prior instructions" },
];

// ─── Scanner ────────────────────────────────────────────────────────────

export interface ScanRisk {
  gate: "G1" | "G2";
  line: number;
  match: string;
  reason: string;
}

export interface ScanResult {
  status: "SAFE" | "RISK";
  risks: ScanRisk[];
  summary: string;
}

/**
 * Scan raw skill content for G1 (code) and G2 (text) risks.
 */
export function scanSkill(content: string): ScanResult {
  const risks: ScanRisk[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Skip empty lines
    if (!line.trim()) continue;

    // G1: Code patterns
    for (const { pattern, reason } of G1_CODE_PATTERNS) {
      // Reset lastIndex for global regexes
      pattern.lastIndex = 0;
      const m = pattern.exec(line);
      if (m) {
        risks.push({
          gate: "G1",
          line: lineNum,
          match: m[0],
          reason,
        });
      }
    }

    // G2: Text patterns
    for (const { pattern, reason } of G2_TEXT_PATTERNS) {
      pattern.lastIndex = 0;
      const m = pattern.exec(line);
      if (m) {
        risks.push({
          gate: "G2",
          line: lineNum,
          match: m[0],
          reason,
        });
      }
    }
  }

  if (risks.length === 0) {
    return { status: "SAFE", risks: [], summary: "SAFE — no G1/G2 risks detected." };
  }

  const g1Count = risks.filter((r) => r.gate === "G1").length;
  const g2Count = risks.filter((r) => r.gate === "G2").length;
  const details = risks.map((r) => `  L${r.line} [${r.gate}] ${r.reason}: "${r.match}"`).join("\n");
  const summary = `RISK: ${risks.length} issue(s) found (G1: ${g1Count}, G2: ${g2Count}).\n${details}`;

  return { status: "RISK", risks, summary };
}

/**
 * Scan a skill file from disk.
 */
export async function scanSkillFile(path: string): Promise<ScanResult> {
  const content = await readFile(path, "utf-8");
  return scanSkill(content);
}

/**
 * Scan all .md files in a directory.
 */
export async function scanSkillDirectory(dirPath: string): Promise<Map<string, ScanResult>> {
  const { readdir } = await import("fs/promises");
  const { join } = await import("path");
  const entries = await readdir(dirPath, { withFileTypes: true });
  const results = new Map<string, ScanResult>();

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".md")) {
      const fullPath = join(dirPath, entry.name);
      results.set(entry.name, await scanSkillFile(fullPath));
    }
  }

  return results;
}
