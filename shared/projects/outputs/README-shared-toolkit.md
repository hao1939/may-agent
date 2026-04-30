# Shared Agent Toolkit

Reusable scripts and library modules for all agents in the system.

## Scripts

| Script | Description | Usage |
|--------|-------------|-------|
| `test-guard.sh` | Runs vitest, prints pass/fail summary, exits 0/1 | `bash scripts/test-guard.sh` |
| `health-check.sh` | Scans all satellite projects, reports status | `bash scripts/health-check.sh` |
| `system-dashboard.sh` | Combined view: tests, projects, lessons, deliverables | `bash scripts/system-dashboard.sh` |
| `project-health.sh` | Full health check: tests + configs + satellites | `bash scripts/project-health.sh` |
| `check-regression.sh` | Compares current metrics to `.state/baseline.json` | `bash scripts/check-regression.sh` |
| `pre-push-check.sh` | Git pre-push hook — blocks push if tests fail | `bash scripts/pre-push-check.sh` |
| `new-project.sh` | Scaffolds a new satellite project from template | `bash scripts/new-project.sh <name> <goal> <owner>` |
| `commit-and-merge.sh` | Commits and merges current branch | `bash scripts/commit-and-merge.sh` |
| `heartbeat-snapshot.sh` | Captures agent heartbeat state | `bash scripts/heartbeat-snapshot.sh` |
| `kb-find.sh` | Searches knowledge base files | `bash scripts/kb-find.sh <query>` |
| `extract-json-scores.sh` | Extracts JSON score data from logs | `bash scripts/extract-json-scores.sh` |
| `verify-skills.sh` | Verifies agent skill definitions | `bash scripts/verify-skills.sh` |
| `test-regression-check.sh` | Alternative regression checker | `bash scripts/test-regression-check.sh` |

## Library Modules

All modules are exported from `lib/index.ts`. Import with:
```ts
import { generateProject, detectRegressions } from '../lib/index.js';
```

| Module | Exports | Description |
|--------|---------|-------------|
| `config-validator` | `validateProjectConfig(content): {valid, errors, warnings}` | Validates project.md structure (sections, metrics, plan) |
| `growth` | Growth tracking utilities | Tracks and measures system growth metrics |
| `iteration-monitor` | `recordIteration(entry)`, `getMetrics(lastN?)` | Records iteration outcomes, computes deliverable/success rates |
| `project-health` | Project health assessment utilities | Evaluates overall project health status |
| `project-template` | `generateProject({name, goal, metrics, owner})` | Generates complete project.md scaffolds |
| `regression-detector` | `detectRegressions(current, baseline, threshold?)` | Compares metrics to baseline, flags drops > threshold (default 10%) |
| `session-analyzer` | `analyzeIterations(entries): {slowest, patterns, suggestions}` | Finds slow outliers, failure patterns, and improvement suggestions |
| `task-template` | `createTaskTemplate({goal, targetPath, testPath?, context?})` | Generates structured task descriptions with explicit target paths |
| `task-validator` | `validateWriteFirst(actions): {valid, firstAction}` | Checks if first substantive action is a write (enforces write-first) |
| `workflow-metrics` | `getWorkflowMetrics(): {byWorkflow: Record<string, stats>}` | Aggregates iteration metrics grouped by workflow type |

## Baseline

Current metrics baseline stored at `.state/baseline.json`. Updated by `check-regression.sh`.

## Testing

```bash
npx vitest run          # Run all tests (~78 files, ~1413 tests)
npx vitest run smoke    # Run smoke/integration tests only
```
