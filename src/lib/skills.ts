import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import {
  formatSkillInvocation,
  formatSkillsForSystemPrompt,
  loadSourcedSkills,
  NodeExecutionEnv,
  type Skill,
} from "@earendil-works/pi-agent-core/node";

export type MaySkillScope = "app-agent" | "agent" | "shared";

export interface MaySkill extends Skill {
  scope: MaySkillScope;
  contentHash: string;
  canonicalPath: string;
}

export interface SkillCatalog {
  readonly skills: ReadonlyMap<string, MaySkill>;
  readonly diagnostics: readonly string[];
  readonly omittedFromPrompt: readonly string[];
}

export interface SkillActivationRule {
  skill: string;
  pattern: string;
}

interface SkillSource {
  scope: MaySkillScope;
  packagePath: string;
  priority: number;
}

const MAX_EXPLICIT_SKILL_BYTES = 64 * 1024;
const DEFAULT_CATALOG_CHARS = 8_000;

function inside(root: string, path: string): boolean {
  const rel = relative(root, path);
  return rel === "" || (!isAbsolute(rel) && rel !== ".." && !rel.startsWith("../"));
}

function immediateSkillPackages(root: string | undefined, scope: MaySkillScope, priority: number): SkillSource[] {
  if (!root || !existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith(".") && entry.name !== "archive")
    .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
    .map((entry) => ({ scope, priority, packagePath: join(root, entry.name) }))
    .filter((source) => existsSync(join(source.packagePath, "SKILL.md")));
}

export async function discoverAgentSkills(opts: {
  agentDir: string;
  appLocal?: boolean;
  globalAgentDir?: string;
  sharedRoot?: string;
}): Promise<SkillCatalog> {
  const addressedRoots = [
    {
      path: join(opts.agentDir, "skills"),
      scope: opts.appLocal ? ("app-agent" as const) : ("agent" as const),
      priority: 1,
    },
    ...(opts.appLocal && opts.globalAgentDir
      ? [{ path: join(opts.globalAgentDir, "skills"), scope: "agent" as const, priority: 2 }]
      : []),
    ...(opts.sharedRoot ? [{ path: join(opts.sharedRoot, "skills"), scope: "shared" as const, priority: 3 }] : []),
  ];
  const trustedRoots = addressedRoots.filter((root) => existsSync(root.path)).map((root) => realpathSync(root.path));
  const sources = addressedRoots.flatMap((root) => immediateSkillPackages(root.path, root.scope, root.priority));
  const env = new NodeExecutionEnv({ cwd: opts.agentDir });
  const loaded = await loadSourcedSkills(
    env,
    sources.map((source) => ({ path: source.packagePath, source })),
  );
  const diagnostics = loaded.diagnostics.map(
    (diagnostic) => `${diagnostic.source.scope}:${diagnostic.path}: ${diagnostic.message}`,
  );
  const invalidPackages = new Set(loaded.diagnostics.map((diagnostic) => diagnostic.source.packagePath));
  const grouped = new Map<string, MaySkill[]>();

  for (const item of loaded.skills) {
    if (invalidPackages.has(item.source.packagePath)) continue;
    let canonicalPath: string;
    try {
      canonicalPath = realpathSync(item.skill.filePath);
    } catch (err) {
      diagnostics.push(
        `${item.source.scope}:${item.skill.filePath}: canonical path failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      continue;
    }
    if (!trustedRoots.some((root) => inside(root, canonicalPath))) {
      diagnostics.push(`${item.source.scope}:${item.skill.filePath}: canonical path escapes trusted skill roots`);
      continue;
    }
    if (statSync(canonicalPath).size > MAX_EXPLICIT_SKILL_BYTES) {
      diagnostics.push(
        `${item.source.scope}:${item.skill.filePath}: skill body exceeds ${MAX_EXPLICIT_SKILL_BYTES} bytes`,
      );
      continue;
    }
    const skill: MaySkill = {
      ...item.skill,
      scope: item.source.scope,
      canonicalPath,
      contentHash: createHash("sha256").update(readFileSync(canonicalPath)).digest("hex"),
    };
    const matches = grouped.get(skill.name) ?? [];
    matches.push(skill);
    grouped.set(skill.name, matches);
  }

  const skills = new Map<string, MaySkill>();
  for (const [name, matches] of grouped) {
    const bestPriority = Math.min(
      ...matches.map((match) => sources.find((source) => source.scope === match.scope)?.priority ?? 99),
    );
    const winners = matches.filter(
      (match) => (sources.find((source) => source.scope === match.scope)?.priority ?? 99) === bestPriority,
    );
    if (winners.length > 1) {
      diagnostics.push(
        `Ambiguous ${winners[0].scope} skill name "${name}": ${winners.map((skill) => skill.filePath).join(", ")}`,
      );
      continue;
    }
    skills.set(name, winners[0]);
  }

  return Object.freeze({
    skills,
    diagnostics: Object.freeze(diagnostics),
    omittedFromPrompt: Object.freeze([]),
  });
}

export function formatBoundedSkillCatalog(
  catalog: SkillCatalog,
  maxChars = DEFAULT_CATALOG_CHARS,
): { text: string; omitted: string[] } {
  const ordered = [...catalog.skills.values()].sort((a, b) => {
    const priorities: Record<MaySkillScope, number> = { "app-agent": 1, agent: 2, shared: 3 };
    return priorities[a.scope] - priorities[b.scope] || a.name.localeCompare(b.name);
  });
  const selected: MaySkill[] = [];
  const omitted: string[] = [];
  for (const skill of ordered) {
    const compact = { ...skill, description: skill.description.slice(0, 240) };
    const candidate = formatSkillsForSystemPrompt([...selected, compact]);
    if (candidate.length <= maxChars) selected.push(compact);
    else omitted.push(skill.name);
  }
  return { text: formatSkillsForSystemPrompt(selected), omitted };
}

export function invokeCatalogSkill(
  catalog: SkillCatalog | undefined,
  name: string,
  task: string,
): {
  prompt: string;
  skill: MaySkill;
} {
  const skill = catalog?.skills.get(name);
  if (!skill) throw new Error(`Skill "${name}" is not available for this agent`);
  if (Buffer.byteLength(skill.content, "utf8") > MAX_EXPLICIT_SKILL_BYTES) {
    throw new Error(`Skill "${name}" exceeds the ${MAX_EXPLICIT_SKILL_BYTES}-byte activation limit`);
  }
  return { prompt: formatSkillInvocation(skill, task), skill };
}

export function matchSkillActivationRule(
  rules: readonly SkillActivationRule[] | undefined,
  task: string,
): SkillActivationRule | undefined {
  if (!rules?.length) return undefined;
  return rules.find((rule) => new RegExp(rule.pattern, "i").test(task));
}

export function parseExplicitSkill(text: string): { skill?: string; task: string } {
  const match = text.match(/^\$([a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?)(?:\s+|$)([\s\S]*)$/);
  if (!match) return { task: text };
  return { skill: match[1], task: match[2].trim() };
}
