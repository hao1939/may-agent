import { type TaskExecutor } from "@may-agent/sdk";
import type { AppRegistry, AppRegistrySnapshot } from "../apps/registry.js";
import { type EventBus } from "../events/bus.js";
import type { TaskOutcomeReader } from "../reads/reporting.js";
import { HostCapacity } from "../scheduling/host-capacity.js";
import { type AppTaskDispatch } from "./controller.js";
import type { TaskAgentRunner, TaskConversationRunner, TaskSessionRecovery, TaskWorkflowRunner } from "./execution.js";
import { type AppTaskRuntimeDescriptor } from "./runtime-definition.js";
import type { TaskWorkspaces } from "./workspace.js";

export interface AppTaskRuntimeOptions {
  projectsRoot: string;
  projectRoot: string;
  persistDir?: string;
  agentsRoot?: string;
  sharedRoot?: string;
  agents?: TaskAgentRunner;
  conversations?: TaskConversationRunner;
  sessions?: TaskSessionRecovery;
  bus: EventBus;
  hostCapacity: HostCapacity;
  /**
   * Optional execution boundary for one claimed Task attempt. Production uses
   * an isolated process; tests and explicit single-process tools may omit it.
   * The canonical Task resource remains the scheduling and fencing authority.
   */
  executeAttempt?: (input: { appId: string; taskId: string; dispatch: AppTaskDispatch }) => Promise<string[]>;
  /** Optional process boundary for the startup repair pass. */
  executeRecovery?: () => Promise<void>;
  /** Install descriptors and routing without starting local controllers. */
  installControllers?: boolean;
  /** Limit descriptor preparation to exact Apps in a one-attempt worker. */
  taskAppIds?: readonly string[];
  /** The parent publishes read models; execution workers reuse them. */
  syncReadModels?: boolean;
  /** Optional host adapters selected by Task intent. Built-ins remain replaceable. */
  executors?: Readonly<Record<string, TaskExecutor>>;
  /** Optional workflow implementation, selected by composition. */
  workflows?: TaskWorkflowRunner;
  /** Optional worktree implementation; required only by worktree-backed attempts. */
  workspaces?: TaskWorkspaces;
  /** Optional projection; canonical Task reads remain available without it. */
  readOutcomes?: TaskOutcomeReader;
  appRegistry?: AppRegistry;
  /** Prospective canonical generation used during one coordinated reload. */
  appRegistrySnapshot?: AppRegistrySnapshot;
  /** Final synchronous publication step inside the atomic generation boundary. */
  afterCommit?: (result: { installed: AppTaskRuntimeDescriptor[] }) => void;
  /** Do not execute queued App work until daemon startup has fenced sessions. */
  startAfter?: PromiseLike<void>;
}
