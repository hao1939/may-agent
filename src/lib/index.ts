export type { SessionStore } from "./persistence.js";
export { SubagentManager, generateId, truncateForPrompt } from "./manager.js";
export type { SubagentManagerOptions, RunOptions } from "./manager.js";
export { executePreparedAgent, normalizeExecutionSchema, prepareAgentExecution } from "./agent-execution.js";
export type {
  AgentPreparationOptions,
  DirectAgentExecutionOptions,
  DirectAgentExecutionResult,
  PreparedAgentExecution,
} from "./agent-execution.js";
// Session recovery (Ambulance Protocol — P62)
export { classifyError } from "./classify-error.js";
export type { ErrorClass } from "./classify-error.js";
// Core coding tools (synced from pi-coding-agent)
export {
  createReadTool,
  createBashTool,
  createEditTool,
  createWriteTool,
  createCodingTools,
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  formatSize,
  truncateHead,
  truncateTail,
  truncateLine,
  resolveToCwd,
  resolveReadPath,
  expandPath,
  createSystemStatusTool,
  createQueryDbTool,
  createFinishTool,
  createCheckpointTool,
  createRunCliAgentTool,
  readCheckpoints,
  readLatestCheckpoint,
  extractHallucinatedRelPath,
  isMetaRecursionCommand,
} from "./tools/index.js";
export type {
  ReadToolOptions,
  BashToolOptions,
  EditToolOptions,
  WriteToolOptions,
  CodingToolsOptions,
  TruncationResult,
  TruncationOptions,
  FinishToolOptions,
} from "./tools/index.js";
export { createScrapeTool } from "./scrape.js";
export { createWorkflowTool } from "./workflow-tool.js";
export {
  discoverAgentSkills,
  formatBoundedSkillCatalog,
  invokeCatalogSkill,
  parseExplicitSkill,
} from "./skills.js";
export type { MaySkill, MaySkillScope, SkillCatalog } from "./skills.js";
export type { WorkflowTool } from "./workflow-tool.js";
export { WorkflowInterrupted, WorkflowBlocked } from "./workflow.js";
export type {
  WorkflowContext,
  WorkflowResult,
  WorkflowEvent,
  WorkflowModule,
  WorkflowToolResult,
  WorkflowStepSummary,
  CompletedStep,
  TraceNode,
  SessionTrace,
  WorkflowGuard,
  WorkflowGuardEvent,
  Demand,
  GuardModule,
} from "./workflow.js";
export { extractKeyFacts } from "./compaction.js";
export type { KeyFacts } from "./compaction.js";
export { isOverflowError } from "./overflow.js";
export {
  RegistryStore,
  ensureSessionDir,
  appendSessionMessage,
  readSessionMessages,
  readSessionMessagesTail,
  sessionDir,
  sessionJsonlPath,
  sessionOutputDir,
  sessionMetaPath,
  readSessionMeta,
  writeSessionMeta,
  loadAllSessionMetas,
  loadActiveSessionMetas,
  loadAllSessionMetasAsync,
  listActiveSessionIds,
} from "./persistence.js";
export { createBackgroundExecTool } from "./background-exec.js";

export { readIdentity } from "./instance-identity.js";
export type { InstanceIdentity } from "./instance-identity.js";
export { sendSocketCommand, waitForSocketEvent } from "./socket-client.js";
export type { SocketResponse, SocketEvent } from "./socket-client.js";
export type { SubagentDefinition, ModelWithApiKey, SessionInfo, TaskResult } from "./types.js";
export type { Registry, PersistedAgentConfig, PersistedSession, SessionKind } from "./persistence.js";

export { createQueryService } from "./query-service.js";
export type {
  QueryAPI,
  QueryResult,
  QueryOptions,
  SessionQuery,
  EventQuery,
  MetricQuery,
  AlertQuery,
  ProjectQuery,
  WorkflowRunQuery,
  EventDeliveryHealth,
  EventDeliveryHealthQuery,
} from "./query-service.js";
export {
  getExecutionResult,
  getExecutionResultFromDb,
  normalizeExecutionStatus,
  sessionRowToExecutionResult,
  resumeDiagnosticToExecutionResult,
  taskResultToExecutionResult,
  workflowRowToExecutionResult,
  workflowToolResultToExecutionResult,
} from "./execution-result.js";
export type { ExecutionKind, ExecutionResult, ExecutionStatus, ResumeDiagnostic } from "./execution-result.js";

export type { EventEnvelope } from "../app/event-bus.js";
export type { HandlerContext, HandlerModule } from "../app/adapters/maintenance/context.js";
// RuntimeCtx is internal — imported directly by workflow-tool.ts and sdk-impl.ts
export { retryWithBackoff } from "./retry-with-backoff.js";
export type { RetryWithBackoffOptions } from "./retry-with-backoff.js";
export { loadAgents, reloadAgents, validateAgentConfig } from "../app/agent-loader.js";
export type { AgentConfig, AgentLoaderOptions, ValidationError } from "../app/agent-loader.js";
