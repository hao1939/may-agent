# Regression Guard Configuration

Automated regression detection for all 12 completed satellite projects. Any metric dropping below the alert threshold should trigger a notification to the project owner.

## Alert Thresholds

| Project | Metric | Current Value | Alert-If-Below |
|---------|--------|---------------|----------------|
| agent-convention-compliance | Gym scenario pass rate | 96.1% | 90% |
| agent-system-literacy | Project creation rate | 2-3/week | 1/week |
| agent-system-literacy | Escalation quality | 0.99 | 0.80 |
| coach-quality | JS quality score (avg) | 0.70 | 0.50 |
| evaluation-revival | Sessions scored (7d) | 31 | 10 |
| gym-quality-improvement | Broken scenario rate | 0.0% | 5% |
| gym-quality-improvement | Pre-solved scenario rate | 0.0% | 5% |
| handler-reliability | Handler success rate | 100% | 90% |
| hao-alignment | Correction rate | ~1% | 10% (alert if ABOVE) |
| prompt-efficiency | SOUL.md avg words | 386w | 600w (alert if ABOVE) |
| prompt-efficiency | Context.md avg words | 218w | 450w (alert if ABOVE) |
| proof-of-life-dashboard | Dashboard renders | ✅ | Any render failure |
| request-deduplication | Duplicate rate | 5.4% | 10% (alert if ABOVE) |
| request-deduplication | Notification storms | 0 | 1 (alert if ABOVE) |
| skill-workflow-audit | Skill verified rate | 0.90 | 0.80 |
| skill-workflow-audit | Skill delivery rate | 0.81 | 0.60 |
| skill-workflow-audit | Workflow pass rate | 1.00 | 0.95 |
| skill-workflow-audit | Skill usage rate | 1.00 | 0.50 |
| test-coverage | Coverage percent | 83.79% | 80% |
| test-coverage | Pass rate | 100% | 95% |

## Implementation Notes

### Check Frequency
- **Daily**: test-coverage (pass rate), handler-reliability, proof-of-life-dashboard
- **Weekly**: All other metrics (they change slowly)

### Alert Logic
- Most metrics alert when value drops BELOW threshold
- Inverted metrics (marked "alert if ABOVE"): hao-alignment correction rate, prompt-efficiency sizes, request-deduplication duplicate rate
- proof-of-life-dashboard: binary check — did today's digest render?

### Response Protocol
1. Alert fires → notify project owner + orchestrator
2. Owner has 48h to acknowledge
3. If metric still regressed after 7 days → re-open satellite project at P1

### Data Sources
- `test-coverage`: `bun vitest --coverage` output
- `agent-convention-compliance`: gym runner results in `.state/`
- `prompt-efficiency`: word count on `agents/*/SOUL.md` and `agents/*/context.md`
- `request-deduplication`: query events table for duplicate rate
- `evaluation-revival`: count evaluations in `.state/evaluations/` from last 7d
- `hao-alignment`: run `measure-corrections.sh`
- `skill-workflow-audit`: check skill deployment manifest
- `handler-reliability`: cron handler exit codes
- `coach-quality`: evaluator scores for coach sessions in `activity.jsonl`
