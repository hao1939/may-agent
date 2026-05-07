export type { SessionStore } from "./persistence.js";
export { SubagentManager, generateId, truncateForPrompt } from "./manager.js";
export type { SubagentManagerOptions, RunOptions } from "./manager.js";
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
export { extractWrittenFiles, extractChangedFiles } from "./workflow-utils.js";
export { summarizeForHandoff, extractHandoff } from "./handoff.js";
export type { HandoffOptions } from "./handoff.js";
export { createCompactionTransform } from "./compaction.js";
export type { CompactionOptions, CompactionInfo } from "./compaction.js";
export { isOverflowError } from "./overflow.js";
export {
  RegistryStore,
  ensureSessionDir,
  appendSessionMessage,
  readSessionMessages,
  sessionDir,
  sessionJsonlPath,
  sessionOutputDir,
  sessionMetaPath,
  readSessionMeta,
  writeSessionMeta,
  loadAllSessionMetas,
  loadAllSessionMetasAsync,
  listActiveSessionIds,
} from "./persistence.js";
export { createBackgroundExecTool } from "./background-exec.js";

export { createCronTool } from "./cron-tool.js";
export type { CronEntry } from "./cron-tool.js";
export { spawnDetachedAgent, readIdentity } from "./detached.js";
export type { InstanceIdentity } from "./detached.js";
export { sendSocketCommand, waitForSocketEvent } from "./socket-client.js";
export type { SocketResponse, SocketEvent } from "./socket-client.js";
export type {
  SubagentDefinition,
  ModelWithApiKey,
  SessionInfo,
  TaskResult,
} from "./types.js";
export type {
  Registry,
  PersistedAgentConfig,
  PersistedSession,
  SessionKind,
} from "./persistence.js";

export type { HandlerContext, HandlerModule } from "./handler-context.js";
// RuntimeCtx is internal — imported directly by workflow-tool.ts and sdk-impl.ts
export { retryWithBackoff } from "./retry-with-backoff.js";
export type { RetryWithBackoffOptions } from "./retry-with-backoff.js";
export { loadAgents, reloadAgents, validateAgentConfig } from "../app/agent-loader.js";
export type { AgentConfig, AgentLoaderOptions, ValidationError } from "../app/agent-loader.js";
export { ApiGate } from "./api-gate.js";
export type { ApiGateConfig, ApiGateStatus } from "./api-gate.js";
