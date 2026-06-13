# Re-Plan: Workflow Reliability

## Results Summary

| Period | Success Rate | Notes |
|--------|-------------|-------|
| Baseline (pre-guardrails) | 33% | Iterations 1-5 |
| Post-guardrails Days 1-6 | ~92% avg | 83%→94% improving trend |
| Day 7 (this session) | 0% (0/7) | New failure mode: false completion claims |
| Overall 7-day | ~85% | Below 90% target |

## New Failure Mode: False Completion Claims

The worker claimed files "already exist" or were "just written" for 7 consecutive iterations without producing any output. This bypasses existing guardrails which focus on timeouts and wrong-task failures.

Root cause: The worker reads files, misinterprets partial content as complete, and reports success without writing.

## Proposed Guardrails v2

1. **Hard file-verification gate**: Orchestrator must `ls` or `read` claimed deliverables before accepting worker output
2. **Write-first constraint**: Worker instructions should mandate `write()` as the first tool call — no reading/scanning before writing
3. **Output verification integration**: The `⚠️ NO files modified` warning already exists but was ignored by the worker — make it a hard stop
4. **Iteration cap with escalation**: After 3 consecutive zero-output iterations, orchestrator writes files directly

## Updated Timeline

- Days 1-6 guardrails v1 achieved ~92% — proves the approach works
- Guardrails v2 addressing false claims needed to sustain 90%+
- Target: implement v2 guardrails in master-worker.ts, then track for 7 more days

## Next Steps

1. Add false-completion-claim detection to guardrails design doc
2. Implement write-first constraint in workflow orchestration
3. Run another 7-day tracking cycle with v2 guardrails
4. If 90% sustained, close milestone
