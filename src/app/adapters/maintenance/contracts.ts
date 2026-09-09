/** Host-private deterministic duties. App work uses SDK schedules and Tasks. */
export interface MaintenanceEntry {
  name: string;
  handler: string;
  enabled?: boolean;
  agent?: string;
  description?: string;
  context?: string[];
  intervalMs?: number;
  offsetMs?: number;
  timeoutMs?: number;
  handlerConfig?: Record<string, unknown>;
  on?: string[];
}
