#!/usr/bin/env node
/**
 * sync-tools-md.ts
 *
 * Synchronizes agent.json tool configs into each agent's TOOLS.md file.
 * Run with: npx tsx scripts/sync-tools-md.ts
 *       or: node scripts/sync-tools-md.mjs  (plain JS version)
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// ── Preset expansions ──────────────────────────────────────────────
const PRESET_MAP: Record<string, string[]> = {
  "coding":           ["read", "write", "edit", "bash"],
  "read-write":       ["read", "write", "edit"],
  "read-only":        ["read"],
  "exec":             ["bash"],
  "exec-readonly":    ["bash"],
  "exec-master":      ["bash"],
  "scrape":           ["scrape_webpage"],
  "agents":           ["agents"],
  "workflow":         ["workflow"],
  "checkpoint":       ["checkpoint"],
  "finish":           ["finish"],
  "cron":             ["cron"],
  "system_status":    ["system_status"],
  "system-status":    ["system_status"],
  "notify":           ["notify"],
  "message-only":     ["notify"],
  "background-exec":  ["bash"],
  "socket-watch":     ["bash"],
  "claude-code":      ["claude_code"],
  "gemini-cli":       ["gemini_cli"],
  "codex":            ["codex_cli"],
};

// ── Resolve project root ───────────────────────────────────────────
const ROOT = resolve(__dirname, "..");
const AGENTS_DIR = join(ROOT, "agents");

const START_MARKER = "<!-- SYNC:TOOLS_START -->";
const END_MARKER   = "<!-- SYNC:TOOLS_END -->";

interface AgentConfig {
  name: string;
  opBudget?: number;
  tools?: string[];
}

function expandTools(presets: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const preset of presets) {
    const expanded = PRESET_MAP[preset];
    if (expanded) {
      for (const tool of expanded) {
        if (!seen.has(tool)) {
          seen.add(tool);
          result.push(tool);
        }
      }
    } else {
      // Unknown preset — pass through as-is
      if (!seen.has(preset)) {
        seen.add(preset);
        result.push(preset);
      }
    }
  }
  return result;
}

function buildBlock(tools: string[], opBudget: number | undefined): string {
  const toolList = tools.map(t => `\`${t}\``).join(", ");
  const budgetLine = opBudget != null
    ? `\n**OpBudget**: ${opBudget} ops per session`
    : "";
  return `${START_MARKER}\n## Available Tools (auto-generated from agent.json)\n${toolList}\n${budgetLine}\n${END_MARKER}`;
}

// ── Main ───────────────────────────────────────────────────────────
const summaries: string[] = [];

const entries = readdirSync(AGENTS_DIR).filter(name => {
  if (name === ".lab") return false;
  const full = join(AGENTS_DIR, name);
  return statSync(full).isDirectory();
});

for (const agentName of entries) {
  const agentDir  = join(AGENTS_DIR, agentName);
  const jsonPath  = join(agentDir, "agent.json");
  const toolsPath = join(agentDir, "TOOLS.md");

  if (!existsSync(jsonPath)) continue;
  if (!existsSync(toolsPath)) continue;   // skip agents without TOOLS.md

  const config: AgentConfig = JSON.parse(readFileSync(jsonPath, "utf-8"));
  const presets  = config.tools ?? [];
  const tools    = expandTools(presets);
  const block    = buildBlock(tools, config.opBudget);

  let content = readFileSync(toolsPath, "utf-8");

  const startIdx = content.indexOf(START_MARKER);
  const endIdx   = content.indexOf(END_MARKER);

  if (startIdx !== -1 && endIdx !== -1) {
    // Replace existing block
    content = content.slice(0, startIdx) + block + content.slice(endIdx + END_MARKER.length);
  } else {
    // Insert at very top
    content = block + "\n\n" + content;
  }

  writeFileSync(toolsPath, content, "utf-8");
  summaries.push(`${agentName} (${tools.length} tools, budget ${config.opBudget ?? "?"})`);
}

console.log(`Synced: ${summaries.join(", ")}`);
