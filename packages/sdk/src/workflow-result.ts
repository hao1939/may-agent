export const workflowResultVersion = "workflow-result-v1";

export type WorkflowResultStatus = string;

export type WorkflowSubject = Record<string, unknown> & {
  kind?: string;
  id?: string;
  capabilityId?: string | null;
};

export type WorkflowCheckResult = Record<string, unknown> & {
  name?: string;
  status?: string;
  detail?: string;
};

export type WorkflowProblem = Record<string, unknown> & {
  category?: string;
  diagnosis?: string;
  resumeCondition?: string;
  owner?: string;
};

export type WorkflowIoContract = {
  workflow: string;
  version?: string;
  input?: unknown;
  output?: unknown;
  description?: string;
  [key: string]: unknown;
};

export type StructuredWorkflowResult = Record<string, unknown> & {
  resultVersion: typeof workflowResultVersion;
  workflow?: string;
  workflowVersion?: string;
  subject?: WorkflowSubject;
  status?: WorkflowResultStatus;
  summary?: string;
  input?: unknown;
  output?: unknown;
  artifacts?: string[];
  checks?: WorkflowCheckResult[];
  metrics?: Record<string, unknown>;
  problem?: WorkflowProblem | null;
  nextActions?: string[];
  inputFingerprint?: Record<string, unknown>;
  details?: Record<string, unknown>;
};

export function workflowResult<T extends Record<string, unknown>>(
  input: T,
): T & {
  resultVersion: typeof workflowResultVersion;
  artifacts: string[];
  checks: WorkflowCheckResult[];
  metrics: Record<string, unknown>;
  nextActions: string[];
} {
  return {
    resultVersion: workflowResultVersion,
    artifacts: [],
    checks: [],
    metrics: {},
    nextActions: [],
    ...input,
  };
}
