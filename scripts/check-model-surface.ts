#!/usr/bin/env bun
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";

const root = process.cwd();
const sharedRoot = join(root, "shared");
const globalAgentsRoot = join(root, "agents");
const projectsRoot = join(root, "projects");
const executionInstructionsPath = join(root, "projects", "may-agent", "src", "lib", "execution-instructions.md");

const DEFAULT_CATALOG_CHARS = 8_000;
const MAX_EXPLICIT_SKILL_BYTES = 64 * 1024;
const DEFAULT_SYSTEM_PROMPT_BUDGET = 38_000;
const AGENT_SYSTEM_PROMPT_BUDGETS: Readonly<Record<string, number>> = {
  may: 38_000,
  alex: 36_000,
  evaluator: 38_000,
  scout: 36_000,
  bob: 31_000,
  "tech-lead": 28_000,
  gym: 28_000,
  judge: 27_000,
};

const BANNED_SURFACE_PATTERNS: ReadonlyArray<{ pattern: RegExp; message: string }> = [
  { pattern: /\btasks\.resolve\b/, message: "retired tasks.resolve reference in active prompt/skill" },
  { pattern: /\btask subscriptions?\b/i, message: "retired task subscription reference in active prompt/skill" },
  { pattern: /\bcron\.json\b/, message: "retired cron.json reference in active prompt/skill" },
  { pattern: /\bresult\.conversation\b/, message: "retired result.conversation reference in active prompt/skill" },
  { pattern: /projects\/alex\.app\/generated\/agent-feedback/, message: "nonexistent generated/agent-feedback startup check" },
];

type SkillScope = "app-agent" | "agent" | "shared";
type DiscoveredSkill = { name: string; description: string; filePath: string; scope: SkillScope };

const errors: string[] = [];

function inside(parent: string, target: string): boolean {
  const rel = relative(parent, target);
  return rel === "" || (!isAbsolute(rel) && rel !== ".." && !rel.startsWith("../"));
}

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function parseSkillFrontmatter(filePath: string): { name?: string; description?: string; error?: string } {
  const raw = readFileSync(filePath, "utf8");
  if (!raw.startsWith("---\n")) return { error: "missing YAML frontmatter" };
  const end = raw.indexOf("\n---", 4);
  if (end < 0) return { error: "unterminated YAML frontmatter" };
  const lines = raw.slice(4, end).split("\n");
  let name: string | undefined;
  let description = "";
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    const nameMatch = line.match(/^name:\s*(.+)$/);
    if (nameMatch) {
      name = nameMatch[1]!.trim().replace(/^["']|["']$/g, "");
      continue;
    }
    const descMatch = line.match(/^description:\s*(.*)$/);
    if (descMatch) {
      const first = descMatch[1]!.trim();
      if (first === ">" || first === "|") {
        const folded: string[] = [];
        while (index + 1 < lines.length && /^\s+/.test(lines[index + 1]!)) {
          folded.push(lines[++index]!.trim());
        }
        description = folded.join(" ");
      } else {
        description = first.replace(/^["']|["']$/g, "");
      }
    }
  }
  return { name, description };
}

function resolveSkillRoots(skillsDir: string): string[] {
  const roots = [skillsDir];
  const pathsFile = join(skillsDir, "paths.json");
  if (!existsSync(pathsFile)) return roots;
  const parsed = JSON.parse(readFileSync(pathsFile, "utf8")) as { paths?: unknown };
  if (Array.isArray(parsed.paths)) {
    for (const item of parsed.paths) {
      if (typeof item === "string" && item.trim()) roots.push(resolve(skillsDir, item.trim()));
    }
  }
  return roots;
}

function discoverSkillsForAgent(agentDir: string, agentName: string, appLocal: boolean): DiscoveredSkill[] {
  const roots: Array<{ path: string; scope: SkillScope; priority: number }> = [
    { path: join(agentDir, "skills"), scope: appLocal ? "app-agent" : "agent", priority: 1 },
    ...(appLocal ? [{ path: join(globalAgentsRoot, agentName, "skills"), scope: "agent" as const, priority: 2 }] : []),
    { path: join(sharedRoot, "skills"), scope: "shared", priority: 3 },
  ].flatMap((entry) => resolveSkillRoots(entry.path).map((path) => ({ ...entry, path })));
  const trustedRoots = roots.map((entry) => entry.path);
  const byName = new Map<string, { skill: DiscoveredSkill; priority: number }>();

  for (const source of roots) {
    if (!existsSync(source.path)) continue;
    for (const entry of readdirSync(source.path, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.name === "archive") continue;
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
      const skillFile = join(source.path, entry.name, "SKILL.md");
      if (!existsSync(skillFile)) continue;
      const canonicalPath = realpathSync(skillFile);
      if (!trustedRoots.some((trusted) => inside(trusted, canonicalPath))) {
        errors.push(`${relative(root, skillFile)}: canonical path escapes trusted skill roots`);
        continue;
      }
      if (statSync(canonicalPath).size > MAX_EXPLICIT_SKILL_BYTES) {
        errors.push(`${relative(root, canonicalPath)}: exceeds ${MAX_EXPLICIT_SKILL_BYTES}-byte limit`);
        continue;
      }
      const parsed = parseSkillFrontmatter(canonicalPath);
      if (parsed.error || !parsed.name || !parsed.description) {
        errors.push(`${relative(root, canonicalPath)}: ${parsed.error ?? "missing name or description"}`);
        continue;
      }
      if (parsed.name !== basename(dirname(skillFile))) {
        errors.push(`${relative(root, canonicalPath)}: name "${parsed.name}" does not match folder "${basename(dirname(skillFile))}"`);
        continue;
      }
      const prev = byName.get(parsed.name);
      if (!prev || source.priority < prev.priority) {
        byName.set(parsed.name, {
          priority: source.priority,
          skill: { name: parsed.name, description: parsed.description, filePath: canonicalPath, scope: source.scope },
        });
      }
    }
  }
  const priorities: Record<SkillScope, number> = { "app-agent": 1, agent: 2, shared: 3 };
  return [...byName.values()]
    .map((entry) => entry.skill)
    .sort((a, b) => priorities[a.scope] - priorities[b.scope] || a.name.localeCompare(b.name));
}

function formatCatalogXml(skills: DiscoveredSkill[]): string {
  if (skills.length === 0) return "";
  const header = [
    "The following skills provide specialized instructions for specific tasks.",
    "Use the read tool to load a skill's file when the task matches its description.",
    "When a skill file references a relative path, resolve it against the skill directory (parent of SKILL.md / dirname of the path) and use that absolute path in tool commands.",
    "",
    "<available_skills>",
  ];
  const entries = skills.flatMap((skill) => [
    "  <skill>",
    `    <name>${escapeXml(skill.name)}</name>`,
    `    <description>${escapeXml(skill.description.slice(0, 240))}</description>`,
    `    <location>${escapeXml(skill.filePath)}</location>`,
    "  </skill>",
  ]);
  return [...header, ...entries, "</available_skills>"].join("\n");
}

function activePromptFiles(): string[] {
  const found = [join(sharedRoot, "common-sense.md")];
  const ignored = new Set([".git", ".state", "archive", "retired-maintenance", "node_modules", "worktrees", "tmp", "artifacts"]);
  const walk = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (ignored.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "AGENTS.md" || entry.name === "SKILL.md") found.push(full);
    }
  };
  walk(globalAgentsRoot);
  walk(projectsRoot);
  walk(join(sharedRoot, "skills"));
  return [...new Set(found)].sort();
}

for (const file of activePromptFiles()) {
  const rel = relative(root, file);
  const text = readFileSync(file, "utf8");
  for (const rule of BANNED_SURFACE_PATTERNS) {
    if (rule.pattern.test(text)) errors.push(`${rel}: ${rule.message}`);
  }
  for (const match of text.matchAll(/(?:`|\()(\/app\/[A-Za-z0-9_./-]+)(?:`|#|\))/g)) {
    const target = match[1]!;
    if (target.includes("<") || target.endsWith("/")) continue;
    if (!existsSync(target)) errors.push(`${rel}: broken absolute path reference ${target}`);
  }
}

const agentSources: Array<{ dir: string; appLocal: boolean }> = [];
if (existsSync(globalAgentsRoot)) {
  for (const entry of readdirSync(globalAgentsRoot, { withFileTypes: true })) {
    if (entry.isDirectory() && existsSync(join(globalAgentsRoot, entry.name, "agent.json"))) {
      agentSources.push({ dir: join(globalAgentsRoot, entry.name), appLocal: false });
    }
  }
}
if (existsSync(projectsRoot)) {
  for (const appEntry of readdirSync(projectsRoot, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!appEntry.isDirectory() || !appEntry.name.endsWith(".app")) continue;
    if (existsSync(join(projectsRoot, appEntry.name, ".disabled"))) continue;
    const appAgentsDir = join(projectsRoot, appEntry.name, "agents");
    if (!existsSync(appAgentsDir)) continue;
    for (const agentEntry of readdirSync(appAgentsDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (agentEntry.isDirectory() && existsSync(join(appAgentsDir, agentEntry.name, "agent.json"))) {
        agentSources.push({ dir: join(appAgentsDir, agentEntry.name), appLocal: true });
      }
    }
  }
}

const commonSense = readFileSync(join(sharedRoot, "common-sense.md"), "utf8").trim();
const execInstructions = existsSync(executionInstructionsPath)
  ? readFileSync(executionInstructionsPath, "utf8").trim()
  : "";

for (const source of agentSources) {
  const config = JSON.parse(readFileSync(join(source.dir, "agent.json"), "utf8")) as { name?: string };
  const name = config.name ?? basename(source.dir);
  const skills = discoverSkillsForAgent(source.dir, name, source.appLocal);
  const selected: DiscoveredSkill[] = [];
  const omitted: string[] = [];
  for (const skill of skills) {
    if (formatCatalogXml([...selected, skill]).length <= DEFAULT_CATALOG_CHARS) selected.push(skill);
    else omitted.push(skill.name);
  }
  if (omitted.length > 0) {
    errors.push(`${name} (${relative(root, source.dir)}): skill catalog overflow omitted [${omitted.join(", ")}]`);
  }
  const agentsMdPath = join(source.dir, "AGENTS.md");
  const agentsMd = existsSync(agentsMdPath) ? readFileSync(agentsMdPath, "utf8").trim() : "";
  const catalogXml = formatCatalogXml(selected);
  const runtimeWrapperEstimate = 750;
  const systemPromptChars =
    `<system_instructions>\n${[commonSense, agentsMd, catalogXml].filter(Boolean).join("\n\n")}\n</system_instructions>\n\n<execution_instructions>\n${execInstructions}\n</execution_instructions>`.length +
    runtimeWrapperEstimate;
  const budget = AGENT_SYSTEM_PROMPT_BUDGETS[name] ?? DEFAULT_SYSTEM_PROMPT_BUDGET;
  if (systemPromptChars > budget) {
    errors.push(
      `${name} (${relative(root, source.dir)}): systemPrompt length ${systemPromptChars} exceeds budget ${budget}`,
    );
  }
}

for (const error of errors) console.error(`ERROR ${error}`);
console.log(`Model surface check: ${errors.length} error(s) across ${agentSources.length} agent(s)`);
if (errors.length > 0) process.exitCode = 1;
