import type { AgentTool } from "@earendil-works/pi-agent-core";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { discoverAgentSkills } from "../../lib/skills.js";
import type { ModelWithApiKey, SubagentDefinition } from "../../lib/types.js";
import type { AgentConfig } from "./agent-config.js";
import type { AgentDirectory } from "./agent-discovery.js";

export type AgentDefinitionOptions = {
  config: AgentConfig;
  source: AgentDirectory;
  model: ModelWithApiKey;
  tools: AgentTool[];
  projectRoot: string;
  sharedRoot: string;
  globalAgentsRoot: string;
  appLocal?: boolean;
};

/** Build the agent-visible definition shared by direct, Gym, and hosted runs. */
export async function buildAgentDefinition(options: AgentDefinitionOptions): Promise<SubagentDefinition> {
  const { config, source } = options;
  const knowledgeDir = join(source.dir, "knowledge");
  const workspace = join(source.dir, "workspace");
  const appLocal =
    options.appLocal ?? Boolean(source.projectId || resolve(source.agentsRoot) !== resolve(options.globalAgentsRoot));
  const skillCatalog = await discoverAgentSkills({
    agentDir: source.dir,
    appLocal,
    globalAgentDir: resolve(options.globalAgentsRoot, config.name),
    sharedRoot: options.sharedRoot,
  });
  return {
    name: config.name,
    description: config.description,
    domain: config.domain,
    model: options.model,
    tools: options.tools,
    agentDir: source.dir,
    agentRelativeDir: source.relativeDir,
    knowledgeDir: existsSync(knowledgeDir) ? knowledgeDir : undefined,
    workspace: existsSync(workspace) ? workspace : undefined,
    projectRoot: options.projectRoot,
    sharedRoot: options.sharedRoot,
    appLocal,
    projectId: source.projectId,
    apiKey: options.model.apiKey,
    memoryLimit: config.memoryLimit,
    compaction: config.compaction,
    contextFiles: config.context_files?.map((file) => resolve(source.dir, file)),
    skillCatalog,
  };
}
