import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { AgentContextPreparer } from "@may-agent/sdk/app";
import { importRuntimeModule } from "../../lib/runtime-import.js";
import { discoverAgentSkills, type SkillCatalog } from "../../lib/skills.js";
import type { ModelWithApiKey, SubagentDefinition, ToolFactory } from "../../lib/manager-utils.js";
/**
 * Tool preset registry.
 *
 * The allowlist validates agent definitions. The loader integration test checks
 * wiring by building these presets through the real loader.
 * A preset in VALID_TOOL_PRESETS must either have a buildTools() case or be
 * removed from agent.json/docs.
 */

export const VALID_TOOL_PRESETS = new Set([
  "coding",
  "read-only",
  "agents",
  "finish",
  "cli-delegation",
  "query_db",
]);

export type AgentConfigDiagnosticSink = {
  emit(event: Record<string, unknown>): void;
};

export interface AgentConfig {
  name: string;
  description: string;
  domain: string;
  model: string; // key into models map
  tools: string[]; // preset names: "coding", "agents", "finish", etc.
  /** Enable automatic context compaction for long-running sessions. */
  compaction?: boolean;
  /** @experimental Agent-local synchronous preparer module. Omit for the full brief. */
  contextPreparation?: string;
}

export interface ValidationError {
  agent: string;
  field: string;
  message: string;
}

const REQUIRED_FIELDS: (keyof AgentConfig)[] = ["name", "description", "domain", "model", "tools"];

export function validateAgentConfig(
  config: AgentConfig,
  models: Record<string, ModelWithApiKey>,
  _agentsRoot: string,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const name = config.name || "<unnamed>";

  if (
    config.contextPreparation !== undefined &&
    (typeof config.contextPreparation !== "string" || !config.contextPreparation.trim())
  ) {
    errors.push({ agent: name, field: "contextPreparation", message: "Expected a non-empty module path" });
  }

  for (const field of REQUIRED_FIELDS) {
    if (!config[field]) {
      errors.push({ agent: name, field, message: `Missing required field "${field}"` });
    }
  }

  if (config.model && !models[config.model]) {
    errors.push({ agent: name, field: "model", message: `Unknown model "${config.model}"` });
  }

  if (config.tools) {
    if (!Array.isArray(config.tools)) {
      errors.push({ agent: name, field: "tools", message: `"tools" must be an array` });
    } else {
      for (const preset of config.tools) {
        if (!VALID_TOOL_PRESETS.has(preset)) {
          errors.push({ agent: name, field: "tools", message: `Unknown tool preset "${preset}"` });
        }
      }
    }
  }

  return errors;
}

/** Read an agent definition without reporting through hosted infrastructure. */
export function readAgentConfigFile(agentDir: string): AgentConfig | null {
  const configPath = resolve(agentDir, "agent.json");
  if (!existsSync(configPath)) return null;
  const raw = readFileSync(configPath, "utf-8");
  const config = JSON.parse(raw) as AgentConfig & { disabled?: boolean };
  return config.disabled ? null : config;
}

export function loadAgentConfig(agentDir: string, bus: AgentConfigDiagnosticSink): AgentConfig | null {
  const configPath = resolve(agentDir, "agent.json");

  try {
    return readAgentConfigFile(agentDir);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    bus.emit({ type: "info", message: `[loader] Failed to parse ${configPath}: ${msg}` });
    bus.emit({
      type: "agent.config_invalid",
      source: "loader",
      owner: "system:host",
      urgency: "immediate",
      data: {
        agent: agentDir.split(/[\\/]/).pop() || "<unknown>",
        count: 1,
        message: `Failed to parse ${configPath}: ${msg}`,
        priority: "P0",
      },
    });
    return null;
  }
}

export interface AgentDirectory {
  /** Directory basename; the configured agent name can be different. */
  name: string;
  dir: string;
  agentsRoot: string;
  projectId?: string;
  projectDir?: string;
  /** Canonical installation-relative folder, supplied by discovery rather than guessed from the name. */
  relativeDir: string;
}

function listAgentDirectoriesInRoot(
  agentsRoot: string,
  project?: { projectId: string; projectDir: string; relativeAgentsRoot: string },
): AgentDirectory[] {
  if (!existsSync(agentsRoot)) return [];
  const agents: AgentDirectory[] = [];
  for (const entry of readdirSync(agentsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name === "shared") continue;
    if (entry.name.startsWith("_") || entry.name.startsWith(".")) continue;
    const dir = resolve(agentsRoot, entry.name);
    if (!existsSync(resolve(dir, "agent.json"))) continue;
    agents.push({
      name: entry.name,
      dir,
      agentsRoot: resolve(agentsRoot),
      projectId: project?.projectId,
      projectDir: project?.projectDir,
      relativeDir: `${project?.relativeAgentsRoot ?? "agents"}/${entry.name}`,
    });
  }
  return agents;
}

export function listAgentDirectories(agentsRoot: string): AgentDirectory[] {
  return listAgentDirectoriesInRoot(resolve(agentsRoot));
}

export function listProjectAgentDirectories(
  projectsRoot: string,
  canonicalProjectsRoot = projectsRoot,
  appDirectories?: readonly string[],
): AgentDirectory[] {
  if (!existsSync(projectsRoot)) return [];
  const agents: AgentDirectory[] = [];
  for (const entry of readdirSync(projectsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith("_") || entry.name.startsWith(".")) continue;

    if (entry.name.endsWith(".app")) {
      if (
        appDirectories
          ? !appDirectories.includes(entry.name)
          : existsSync(resolve(canonicalProjectsRoot, entry.name, ".disabled"))
      )
        continue;
      const appDir = resolve(projectsRoot, entry.name);
      const projectId = entry.name.slice(0, -".app".length);
      const domainDir = resolve(projectsRoot, projectId);
      const projectDir = existsSync(domainDir) ? domainDir : appDir;
      const hasAppFrame = existsSync(resolve(appDir, "app.ts"));
      if (!hasAppFrame) continue;
      const agentsRoot = resolve(appDir, "agents");
      if (!existsSync(agentsRoot)) continue;
      agents.push(
        ...listAgentDirectoriesInRoot(agentsRoot, {
          projectId,
          projectDir,
          relativeAgentsRoot: `projects/${entry.name}/agents`,
        }),
      );
      continue;
    }

    const projectDir = resolve(projectsRoot, entry.name);
    const hasProjectFrame = existsSync(resolve(projectDir, "project.md"));
    if (!hasProjectFrame) continue;
    const agentsRoot = resolve(projectDir, "agents");
    if (!existsSync(agentsRoot)) continue;
    agents.push(
      ...listAgentDirectoriesInRoot(agentsRoot, {
        projectId: entry.name,
        projectDir,
        relativeAgentsRoot: `projects/${entry.name}/agents`,
      }),
    );
  }
  return agents;
}

export function listRuntimeAgentDirectories(
  agentsRoot: string,
  projectsRoot?: string,
  canonicalProjectsRoot = projectsRoot,
  appDirectories?: readonly string[],
): AgentDirectory[] {
  return [
    ...listAgentDirectories(agentsRoot),
    ...(projectsRoot ? listProjectAgentDirectories(projectsRoot, canonicalProjectsRoot, appDirectories) : []),
  ];
}

function configuredNameForDirectory(agentDir: AgentDirectory): string | null {
  const configPath = resolve(agentDir.dir, "agent.json");
  if (!existsSync(configPath)) return null;

  try {
    const config = JSON.parse(readFileSync(configPath, "utf-8")) as { name?: string; disabled?: boolean };
    if (config.disabled) return null;
    return config.name ?? agentDir.name;
  } catch {
    return agentDir.name;
  }
}

export function listConfiguredAgentNames(
  agentsRoot: string,
  projectsRoot?: string,
  canonicalProjectsRoot = projectsRoot,
  appDirectories?: readonly string[],
): string[] {
  const names = new Set<string>();
  for (const agentDir of listRuntimeAgentDirectories(agentsRoot, projectsRoot, canonicalProjectsRoot, appDirectories)) {
    const name = configuredNameForDirectory(agentDir);
    if (name) names.add(name);
  }
  return [...names].sort();
}

export function resolveRuntimeAgentDirectory(
  agentsRoot: string,
  agentName: string,
  projectsRoot?: string,
): AgentDirectory | null {
  let selected: AgentDirectory | null = null;
  for (const agentDir of listRuntimeAgentDirectories(agentsRoot, projectsRoot)) {
    if (configuredNameForDirectory(agentDir) !== agentName) continue;
    if (!selected || (!selected.projectId && agentDir.projectId)) {
      selected = agentDir;
    }
  }
  return selected;
}

export function agentProjectRoot(agentDir: AgentDirectory, fallbackProjectRoot: string): string {
  return agentDir.projectDir ?? fallbackProjectRoot;
}

export function agentsRootForAgentDir(agentDir: AgentDirectory): string {
  return agentDir.agentsRoot ?? dirname(agentDir.dir);
}

export type AgentLocalToolLoaderOptions = {
  projectRoot: string;
  persistDir: string;
  onNotice?: (message: string) => void;
  onLoaded?: (toolName: string) => void;
};

function isRuntimeToolModule(file: string): boolean {
  if (!file.endsWith(".ts") && !file.endsWith(".js")) return false;
  return !file.endsWith(".d.ts") && !/\.(?:test|spec)\.(?:ts|js)$/.test(file);
}

/** Load agent-local tool factories without depending on EventBus or the daemon. */
export async function loadAgentLocalTools(
  agentName: string,
  agentDir: string,
  options: AgentLocalToolLoaderOptions,
): Promise<AgentTool[]> {
  const toolsDir = resolve(agentDir, "tools");
  if (!existsSync(toolsDir)) return [];

  const tools: AgentTool[] = [];
  const entries = readdirSync(toolsDir).filter(isRuntimeToolModule).sort();

  for (const file of entries) {
    const filePath = resolve(toolsDir, file);
    try {
      const module = await importRuntimeModule<{ default?: ToolFactory }>(filePath);
      if (typeof module.default !== "function") {
        options.onNotice?.(`Skipping ${agentName}/tools/${file}: expected a default tool factory`);
        continue;
      }
      const tool = await module.default({
        projectRoot: options.projectRoot,
        agentRoot: agentDir,
        persistDir: options.persistDir,
      });
      if (!tool || typeof tool.name !== "string" || !tool.name.trim()) {
        options.onNotice?.(`Skipping ${agentName}/tools/${file}: factory returned no named tool`);
        continue;
      }
      tools.push(tool as AgentTool);
      options.onLoaded?.(tool.name);
    } catch (error) {
      options.onNotice?.(
        `Failed to load ${agentName}/tools/${file}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return tools;
}

export type AgentDefinitionOptions = {
  config: AgentConfig;
  source: AgentDirectory;
  model: ModelWithApiKey;
  tools: AgentTool[];
  projectRoot: string;
  sharedRoot: string;
  globalAgentsRoot: string;
  appLocal?: boolean;
  /** Optional pre-read system instructions captured at catalog snapshot time. */
  systemPrompt?: string;
  /** Optional pre-read AGENTS.md identity text captured at catalog snapshot time. */
  identityText?: string;
  /** Optional pre-read shared/common-sense.md text captured at catalog snapshot time. */
  sharedPromptText?: string;
  /** Optional pre-discovered skill catalog captured at catalog snapshot time. */
  skillCatalog?: SkillCatalog;
};

function inside(root: string, path: string): boolean {
  const rel = relative(root, path);
  return rel === "" || (!isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`));
}

/** Build the agent-visible definition shared by direct, Gym, and hosted runs. */
export async function buildAgentDefinition(options: AgentDefinitionOptions): Promise<SubagentDefinition> {
  const { config, source } = options;
  let contextPreparation: AgentContextPreparer | undefined;
  let contextPreparationSource: SubagentDefinition["contextPreparationSource"];
  if (config.contextPreparation !== undefined) {
    const entrypoint = resolve(source.dir, config.contextPreparation);
    if (
      isAbsolute(config.contextPreparation) ||
      !inside(source.dir, entrypoint) ||
      !inside(realpathSync(source.dir), realpathSync(entrypoint))
    ) {
      throw new Error("contextPreparation must stay inside the agent directory (relative path, no escaping symlinks)");
    }
    const entryHash = createHash("sha256").update(readFileSync(entrypoint)).digest("hex");
    const module = await importRuntimeModule<{ default?: unknown }>(entrypoint, { entryContentHash: entryHash });
    if (typeof module.default !== "function") {
      throw new Error("contextPreparation must default-export a function");
    }
    contextPreparation = module.default as AgentContextPreparer;
    contextPreparationSource = {
      path: relative(source.dir, entrypoint).split(sep).join("/"),
      entryHash,
    };
  }
  const knowledgeDir = join(source.dir, "knowledge");
  const workspace = join(source.dir, "workspace");
  const appLocal =
    options.appLocal ?? Boolean(source.projectId || resolve(source.agentsRoot) !== resolve(options.globalAgentsRoot));
  const skillCatalog =
    options.skillCatalog ??
    (await discoverAgentSkills({
      agentDir: source.dir,
      appLocal,
      globalAgentDir: resolve(options.globalAgentsRoot, config.name),
      sharedRoot: options.sharedRoot,
    }));
  return {
    name: config.name,
    description: config.description,
    domain: config.domain,
    model: options.model,
    tools: options.tools,
    ...(options.systemPrompt !== undefined ? { systemPrompt: options.systemPrompt } : {}),
    ...(options.identityText !== undefined ? { identityText: options.identityText } : {}),
    ...(options.sharedPromptText !== undefined ? { sharedPromptText: options.sharedPromptText } : {}),
    agentDir: source.dir,
    agentRelativeDir: source.relativeDir,
    knowledgeDir: existsSync(knowledgeDir) ? knowledgeDir : undefined,
    workspace: existsSync(workspace) ? workspace : undefined,
    projectRoot: options.projectRoot,
    sharedRoot: options.sharedRoot,
    appLocal,
    projectId: source.projectId,
    apiKey: options.model.apiKey,
    compaction: config.compaction,
    contextPreparation,
    contextPreparationSource,
    skillCatalog,
  };
}
