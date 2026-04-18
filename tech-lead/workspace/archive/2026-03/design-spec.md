# Feature: Agent Health Monitor

## Overview
Build a lightweight health monitoring module that periodically checks agent status and produces health reports. This is a standalone module (not integrated into the main system) for evaluation purposes.

## Requirements

### 1. Health Check Module (`health-checker.ts`)
A module that can run health checks against agent configurations and produce structured results.

**Functions to implement:**
- `checkAgent(agentDir: string): Promise<HealthCheckResult>` — Checks if an agent directory has the required files (SOUL.md, DOMAIN.md) and reports missing ones.
- `checkAll(baseDir: string): Promise<HealthReport>` — Runs `checkAgent` on all subdirectories of `baseDir`, collects results, computes summary stats.
- `formatReport(report: HealthReport): string` — Formats a HealthReport into a human-readable markdown string.

**Types:**
```typescript
interface HealthCheckResult {
  agent: string;
  healthy: boolean;
  missingFiles: string[];
  checkedAt: number; // Date.now() timestamp
}

interface HealthReport {
  results: HealthCheckResult[];
  summary: {
    total: number;
    healthy: number;
    unhealthy: number;
    healthRate: number; // healthy / total, as a decimal 0-1
  };
  generatedAt: number;
}
```

### 2. Alert Rules (`alert-rules.ts`)
A module that evaluates health reports against configurable thresholds and produces alerts.

**Functions to implement:**
- `evaluateAlerts(report: HealthReport, rules: AlertRule[]): Alert[]` — Check each rule against the report. A rule triggers when its condition is met.
- `defaultRules(): AlertRule[]` — Returns a sensible set of default rules.

**Types:**
```typescript
interface AlertRule {
  id: string;
  name: string;
  condition: 'healthRate_below' | 'unhealthy_above' | 'agent_missing_file';
  threshold: number; // For healthRate_below: 0-1. For unhealthy_above: count. For agent_missing_file: ignored.
  severity: 'warning' | 'critical';
}

interface Alert {
  ruleId: string;
  ruleName: string;
  severity: 'warning' | 'critical';
  message: string;
  triggeredAt: number;
}
```

### 3. Tests
- Tests for `checkAgent` with a mock directory structure
- Tests for `checkAll` with multiple agents
- Tests for `evaluateAlerts` with various rule combinations
- Tests for `formatReport` output structure

## Existing Code
There is an existing `health-checker.ts` with the types defined and a partial implementation of `checkAgent`. It has a known bug that needs to be fixed. `alert-rules.ts` needs to be created from scratch.

## Deliverables
1. Fix the bug in `health-checker.ts`
2. Complete the `checkAll` and `formatReport` functions in `health-checker.ts`
3. Create `alert-rules.ts` with full implementation
4. Create `health-monitor.test.ts` with comprehensive tests
5. All tests pass, tsc clean

## Notes
- Use `fs/promises` for file system operations
- Use `path` module for path joining
- Keep it simple — no external dependencies
