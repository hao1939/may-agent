export interface SessionDef {
  id?: string;
  task: string;
  injected_context?: string;
  environment?: string;
  artifacts_out?: string[];
  artifacts_in_rename?: Record<string, string>;
  timeout?: number;
}

export interface WorkflowScenarioEntry {
  /** Workflow module name under the owning agent's workflows/ directory. */
  workflow: string;
  /** Structured input passed to ctx.input (defaults to task.md text when omitted). */
  input?: unknown;
  /** Optional owning agent override (defaults to ScenarioMeta.agent_type). */
  agent?: string;
}

export interface ScenarioMeta {
  name: string;
  description?: string;
  categories: string[];
  tags: string[];
  tier: "smoke" | "standard" | "full";
  timeout: number;
  agent_type: string;
  workflow: boolean;
  /** Direct workflow execution entry via Host-free runDirectWorkflow. */
  workflow_entry?: WorkflowScenarioEntry;
  /** Expose a sandboxed Host-free `workflow` tool to the agent during the scenario. */
  allow_workflow?: boolean;
  output_contract?: "task-agent-result";
  learn_between_phases?: boolean;
  phase_cleanup?: string[];
  injected_context?: string;
  sessions?: SessionDef[];
}
