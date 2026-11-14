export { executePreparedAgent, normalizeExecutionSchema, prepareAgentExecution } from "./agent-execution.js";
export type {
  AgentPreparationOptions,
  DirectAgentExecutionOptions,
  DirectAgentExecutionResult,
  PreparedAgentExecution,
} from "./agent-execution.js";
export { SubagentManager, generateId, truncateForPrompt } from "./manager.js";
export type { RunOptions, SubagentManagerOptions } from "./manager.js";
export type { SessionStore } from "./persistence.js";
// Session recovery (Ambulance Protocol — P62)
export {
  classifyError,
  discoverAgentSkills,
  extractKeyFacts,
  formatBoundedSkillCatalog,
  invokeCatalogSkill,
  parseExplicitSkill,
} from "../../packages/sdk/src/runtime/index.js";
export type { ErrorClass, KeyFacts, MaySkill, MaySkillScope, SkillCatalog } from "../../packages/sdk/src/runtime/index.js";
export {
  RegistryStore,
  appendSessionMessage,
  ensureSessionDir,
  listActiveSessionIds,
  loadAllSessionMetas,
  readSessionMessages,
  readSessionMessagesTail,
  readSessionMeta,
  sessionDir,
  sessionJsonlPath,
  sessionMetaPath,
  sessionOutputDir,
  writeSessionMeta,
} from "./persistence.js";
export {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  createBashTool,
  createCodingTools,
  createEditTool,
  createFinishTool,
  createQueryDbTool,
  createReadTool,
  createRunCliAgentTool,
  createWriteTool,
  expandPath,
  formatSize,
  resolveReadPath,
  resolveToCwd,
  truncateHead,
  truncateLine,
  truncateTail,
} from "./tools/index.js";
export type {
  BashToolOptions,
  CodingToolsOptions,
  EditToolOptions,
  FinishToolOptions,
  ReadToolOptions,
  TruncationOptions,
  TruncationResult,
  WriteToolOptions,
} from "./tools/index.js";
export { createWorkflowRunner } from "./workflow-tool.js";
export type { WorkflowRunner } from "./workflow-tool.js";
export { WorkflowInterrupted } from "./workflow.js";
export type {
  CompletedStep,
  SessionTrace,
  TraceNode,
  WorkflowContext,
  WorkflowEvent,
  WorkflowModule,
  WorkflowResult,
  WorkflowStepSummary,
  WorkflowToolResult,
} from "./workflow.js";

export { readIdentity } from "./instance-identity.js";
export type { InstanceIdentity } from "./instance-identity.js";
export type { PersistedSession, SessionKind } from "./persistence.js";
export { sendSocketCommand, waitForSocketEvent } from "@may-agent/control/client";
export type { SocketEvent, SocketResponse } from "@may-agent/control/client";
export type { ModelWithApiKey, SessionInfo, SubagentDefinition, TaskResult } from "../../packages/sdk/src/runtime/index.js";

export {
  getExecutionResultFromDb,
  normalizeExecutionStatus,
  sessionRowToExecutionResult,
  workflowRowToExecutionResult,
} from "./execution-result.js";
export type { ExecutionKind, ExecutionResult, ExecutionStatus } from "./execution-result.js";
export { createQueryService } from "./query-service.js";
export type {
  EventDeliveryHealth,
  EventDeliveryHealthQuery,
  EventQuery,
  QueryAPI,
  QueryOptions,
  QueryResult,
} from "./query-service.js";

export type { EventEnvelope } from "../app/core/events/bus.js";
// RuntimeCtx is internal — imported directly by workflow-tool.ts and maintenance-api-impl.ts
export { loadAgents, reloadAgents, validateAgentConfig } from "../app/agent-loader.js";
export type { AgentConfig, AgentLoaderOptions, ValidationError } from "../app/agent-loader.js";
