/**
 * Shared workflow type definitions.
 * Provides interfaces used across all workflow files.
 */

/** Context object passed to workflow execute functions */
export interface WorkflowContext {
  agentsRoot?: string;
  getDb(): unknown;
  emit(event: Record<string, unknown>): void;
  log(message: string): void;
  done(message: string): WorkflowResult;
  prompt(options: Record<string, unknown>): Promise<string>;
  config?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Result returned from workflow execution */
export interface WorkflowResult {
  success: boolean;
  message?: string;
  data?: unknown;
}
