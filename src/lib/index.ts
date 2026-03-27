export type { SessionStore } from './persistence.js';
export { SubagentManager, generateId, truncateForPrompt } from "./manager.js";
export type { SubagentManagerOptions, RunOptions } from "./manager.js";
// Session recovery (Ambulance Protocol — P62)
export { classifyError } from "./classify-error.js";
export type { ErrorClass } from "./classify-error.js";
// Agent growth core logic
export { forkAgent, promoteAgent, discardAgent, listLabAgents } from "./growth.js";
export type { GrowthConfig, ForkResult, PromoteResult } from "./growth.js";
// Core coding tools (synced from pi-coding-agent)
export {
  createReadTool,
  createBashTool,
  createEditTool,
  createWriteTool,
  createCodingTools,
  createAgentGrowthTools,
} from "./tools/index.js";
export type {
  ReadToolOptions,
  BashToolOptions,
  EditToolOptions,
  WriteToolOptions,
  CodingToolsOptions,
  AgentGrowthToolOptions,
} from "./tools/index.js";
export {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  formatSize,
  truncateHead,
  truncateTail,
  truncateLine,
} from "./tools/index.js";
export type { TruncationResult, TruncationOptions } from "./tools/index.js";
export { resolveToCwd, resolveReadPath, expandPath } from "./tools/index.js";
// May-agent-specific tools
export { createHealthCheckTool } from "./tools/index.js";
export { createSystemStatusTool } from "./tools/index.js";
export type { HealthReport } from "./tools/index.js";
export { createFinishTool } from "./tools/index.js";
export { createCheckpointTool, readCheckpoints, readLatestCheckpoint } from "./tools/index.js";
export type { FinishToolOptions } from "./tools/index.js";
export { resolveHallucinatedPath, extractHallucinatedRelPath, isMetaRecursionCommand } from "./tools/index.js";
export { createScrapeTool } from "./scrape.js";
export type { ScrapeToolOptions } from "./scrape.js";
export { createWorkflowTool } from "./workflow-tool.js";
export type { WorkflowToolOptions, WorkflowTool } from "./workflow-tool.js";
export { WorkflowInterrupted } from "./workflow.js";
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
} from "./workflow.js";
export { summarizeForHandoff, extractHandoff } from "./handoff.js";
export type { HandoffOptions, HandoffData } from "./handoff.js";
export { createCompactionTransform } from "./compaction.js";
export type { CompactionOptions, CompactionInfo } from "./compaction.js";
export {
  evaluateTask,
  findUnevaluatedChildren,
  extractFailureChains,
  extractUsage,
  formatFailureChains,
  getAgentScoreSummary,
  writeSkippedEvaluations,
  writeHeuristicEvaluations,
} from "./evaluator.js";
export type {
  EvaluateTaskOptions,
  TaskEvaluationResult,
  AgentScores,
  ChildSessionInfo,
  UsageSummary,
  FailureChain,
  FailureStep,
  AgentScoreSummary,
} from "./evaluator.js";
export { isOverflowError, extractProgress, writeProgressFile } from "./overflow.js";
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
  readSessionMetaAsync,
  listActiveSessionIdsAsync,
  listArchivedSessionIdsAsync,
  memoryPath,
  appendMemoryEntry,
  readMemoryEntries,
  historyDir,
  archiveSession,
  restoreSessionFromArchive,
  saveWorkflowRun,
  readWorkflowRun,
  listWorkflowRuns,
  workflowRunDir,
  workflowRunPath,
  listActiveSessionIds,
  listArchivedSessionIds,
} from "./persistence.js";
export { createBackgroundExecTool } from "./background-exec.js";
export type { BackgroundExecToolOptions } from "./background-exec.js";
export { createSocketWatchTool } from "./socket-watch.js";
export type { SocketWatchToolOptions } from "./socket-watch.js";
export { createClaudeCodeTool, createGeminiCliTool, createCodexTool, truncateOutput, stripAnsi, spawnCliAgent } from "./cli-agents.js";
export type { CliAgentToolOptions, GeminiCliToolOptions, CodexToolOptions } from "./cli-agents.js";
export { createCronTool } from "./cron-tool.js";
export type { CronToolOptions, CronEntry } from "./cron-tool.js";
export { spawnDetachedAgent, readIdentity } from "./detached.js";
export type { SpawnDetachedOpts, InstanceIdentity } from "./detached.js";
export { sendSocketCommand, waitForSocketEvent } from "./socket-client.js";
export type { SocketResponse, SocketEvent } from "./socket-client.js";
export type {
  SubagentDefinition,
  ModelWithApiKey,
  SessionInfo,
  SessionTreeNode,
  ManagerHealthReport,
  HealthActiveSession,
  AuditHealthOptions,
  AuditHealthReport,
  ReconcileReport,
  TaskResult,
} from "./types.js";
export type {
  Registry,
  PersistedAgentConfig,
  PersistedSession,
  SessionKind,
  MemoryEntry,
  WorkflowRun,
  WorkflowStep,
} from "./persistence.js";

export type { HandlerContext, HandlerModule } from "./handler-context.js";
export { retryWithBackoff } from "./retry-with-backoff.js";
export type { RetryWithBackoffOptions } from "./retry-with-backoff.js";
export { learnFromSession } from "./context-learn.js";
export type { ContextLearnOptions } from "./context-learn.js";
export { loadAgents, reloadAgents, validateAgentConfig } from "../app/agent-loader.js";
export type { AgentConfig, AgentLoaderOptions, LoadResult, ValidationError } from "../app/agent-loader.js";
