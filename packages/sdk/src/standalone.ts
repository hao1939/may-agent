/**
 * `@may-agent/sdk/standalone` — Self-contained standalone Agent & Workflow Runtime.
 *
 * Canonical public API:
 *   - `run(target, input, options?)` / `run(options)` — execute any prompt agent (`alex`),
 *     code procedure (`tech-lead/verified-coder`), or CLI executor (`codex`/`claude`).
 *   - `listTargets(options?)` — list admitted callable prompt, code, and CLI targets.
 *   - `createModelRegistry()` — build the provider model map from environment variables.
 */

export {
  DEFAULT_DIRECT_WORKFLOW_MAX_CONCURRENT_CALLS,
  DEFAULT_DIRECT_WORKFLOW_MAX_DEPTH,
  DEFAULT_STANDALONE_LIST_TIMEOUT_MS,
  defaultDirectToolDenials,
  inferWorkspaceRoot,
  listStandaloneTargets,
  listTargets,
  prepareDirectAgentExecution,
  resolveDirectToolPolicy,
  run,
  runDirect,
  runDirectAgent,
  runDirectWorkflow,
  type AgentExecutionManifest,
  type DirectAgentFixtureHandler,
  type DirectAgentRunOptions,
  type DirectAgentRunResult,
  type DirectRunOptions,
  type DirectRunResult,
  type DirectWorkflowRunOptions,
  type DirectWorkflowRunResult,
  type DiscoveredTargetSummary,
  type RunOptions,
  type RunResult,
  type StandaloneRunOptions,
  type TargetSummary,
  type ToolDenial,
} from "./runtime/app/standalone.js";

export {
  createModelRegistry,
  type ModelRegistry,
  type ModelWithFallback,
} from "./runtime/app/model-registry.js";

export {
  listRuntimeAgentDirectories,
  resolveRuntimeAgentDirectory,
  type AgentDirectory,
} from "./runtime/app/loader/agent-discovery.js";

export {
  readAgentConfigFile,
  validateAgentConfig,
  type AgentConfig,
  type ValidationError,
} from "./runtime/app/loader/agent-config.js";

export type {
  FinishResult,
  InstabilityMetrics,
  ModelWithApiKey,
  SubagentDefinition,
  TaskResult,
  ToolContext,
  ToolFactory,
} from "./runtime/lib/types.js";

export {
  WorkflowAllowanceExhaustedError,
  WorkflowUnconfirmedCleanupError,
  WorkflowValidationError,
  createWorkflowAllowance,
  normalizeWorkflowContribution,
  resolveCallable,
  resolveCallableTarget,
  runWorkflowInvocation,
  runWorkflowTest,
  type NormalizedWorkflowContribution,
  type PreparedCatalog,
  type PreparedDefinition,
  type PreparedTarget,
  type PreparedTargetCatalog,
  type ScriptedAgentCallContext,
  type ScriptedAgentFixture,
  type ScriptedCallContext,
  type ScriptedStepResponse,
  type ScriptedTargetFixture,
  type ScriptedWorkflowCallContext,
  type ScriptedWorkflowFixture,
  type WorkflowCleanupStatus,
  type WorkflowExecutableModule,
  type WorkflowExecutionAllowance,
  type WorkflowKernelBindings,
  type WorkflowKernelOutcome,
  type WorkflowKernelStepControl,
  type WorkflowLogEntry,
  type WorkflowRunReport,
  type WorkflowStepInvocationResult,
  type WorkflowStepTrace,
  type WorkflowTestOptions,
  type WorkflowTestRunResult,
} from "./testing.js";
