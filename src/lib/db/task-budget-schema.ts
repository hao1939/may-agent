/** Resource accounting only. Task ownership and outcomes stay in canonical Task rows. */
export const TASK_BUDGET_SCHEMA = `
CREATE TABLE IF NOT EXISTS task_budget_policies (
  app_id TEXT PRIMARY KEY, policy_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS task_credit_grants (
  sponsor_app_id TEXT NOT NULL, sponsor_agent TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('ordinary', 'coordination')),
  period TEXT NOT NULL, credits INTEGER NOT NULL CHECK (credits >= 0),
  charged INTEGER NOT NULL DEFAULT 0 CHECK (charged >= 0 AND charged <= credits),
  PRIMARY KEY(sponsor_app_id, sponsor_agent, purpose, period)
);
CREATE TABLE IF NOT EXISTS task_budget_roots (
  root_app_id TEXT NOT NULL, root_task_id TEXT NOT NULL,
  sponsor_app_id TEXT NOT NULL, sponsor_agent TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('ordinary', 'coordination')),
  renewal TEXT NOT NULL CHECK (renewal IN ('lifetime', 'utc-day')),
  credits INTEGER NOT NULL CHECK (credits >= 0),
  PRIMARY KEY(root_app_id, root_task_id)
);
CREATE TABLE IF NOT EXISTS task_budget_root_balances (
  root_app_id TEXT NOT NULL, root_task_id TEXT NOT NULL, period TEXT NOT NULL,
  charged INTEGER NOT NULL CHECK (charged >= 0),
  PRIMARY KEY(root_app_id, root_task_id, period),
  FOREIGN KEY(root_app_id, root_task_id) REFERENCES task_budget_roots(root_app_id, root_task_id)
);
CREATE TABLE IF NOT EXISTS task_budget_bindings (
  app_id TEXT NOT NULL, task_id TEXT NOT NULL,
  root_app_id TEXT NOT NULL, root_task_id TEXT NOT NULL,
  PRIMARY KEY(app_id, task_id),
  FOREIGN KEY(root_app_id, root_task_id) REFERENCES task_budget_roots(root_app_id, root_task_id)
);
CREATE TABLE IF NOT EXISTS task_budget_operations (
  operation_id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL, task_id TEXT NOT NULL,
  root_app_id TEXT NOT NULL, root_task_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('task', 'attempt', 'helper', 'adoption')),
  period TEXT NOT NULL, credits INTEGER NOT NULL CHECK (credits IN (0, 1)),
  charged_at INTEGER NOT NULL, receipt_json TEXT NOT NULL,
  FOREIGN KEY(app_id, task_id) REFERENCES task_budget_bindings(app_id, task_id)
);
CREATE INDEX IF NOT EXISTS idx_task_budget_operations_task ON task_budget_operations(app_id, task_id, charged_at, operation_id);
CREATE TABLE IF NOT EXISTS task_budget_funding_receipts (
  change_id TEXT PRIMARY KEY,
  root_app_id TEXT NOT NULL, root_task_id TEXT NOT NULL,
  changed_at INTEGER NOT NULL, receipt_json TEXT NOT NULL,
  FOREIGN KEY(root_app_id, root_task_id) REFERENCES task_budget_roots(root_app_id, root_task_id)
);
CREATE TABLE IF NOT EXISTS task_budget_policy_funding_receipts (
  change_id TEXT PRIMARY KEY, policy_app_id TEXT NOT NULL,
  changed_at INTEGER NOT NULL, receipt_json TEXT NOT NULL,
  FOREIGN KEY(policy_app_id) REFERENCES task_budget_policies(app_id)
);
CREATE INDEX IF NOT EXISTS idx_app_tasks_root_funding_hold
  ON app_tasks(json_extract(resource_json, '$.status.funding.root.appId'),
    json_extract(resource_json, '$.status.funding.root.taskId'), app_id, task_id)
  WHERE json_valid(resource_json) AND json_extract(resource_json, '$.status.funding.reason') = 'root-credit';
CREATE INDEX IF NOT EXISTS idx_app_tasks_sponsor_funding_hold
  ON app_tasks(json_extract(resource_json, '$.status.funding.sponsor.appId'),
    json_extract(resource_json, '$.status.funding.sponsor.agent'),
    json_extract(resource_json, '$.status.funding.purpose'), app_id, task_id)
  WHERE json_valid(resource_json) AND json_extract(resource_json, '$.status.funding.reason') = 'sponsor-credit';
CREATE TABLE IF NOT EXISTS task_budget_managed_starts (
  invocation_id TEXT PRIMARY KEY, app_id TEXT NOT NULL, task_id TEXT NOT NULL,
  generation INTEGER NOT NULL, attempt_id TEXT NOT NULL, session_id TEXT NOT NULL,
  primary_covered INTEGER NOT NULL CHECK (primary_covered IN (0, 1)),
  operation_id TEXT NOT NULL REFERENCES task_budget_operations(operation_id),
  admitted_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_task_budget_primary_start
  ON task_budget_managed_starts(app_id, task_id, attempt_id) WHERE primary_covered = 1;
`;
