export interface SessionDef {
  id?: string;
  task: string;
  injected_context?: string;
  environment?: string;
  artifacts_out?: string[];
  artifacts_in_rename?: Record<string, string>;
  timeout?: number;
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
  learn_between_phases?: boolean;
  phase_cleanup?: string[];
  injected_context?: string;
  sessions?: SessionDef[];
}

