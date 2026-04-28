# Core 20 Benchmark Suite

## Selection Rationale
Selected to cover the top categories proportionally, with preference for smoke-tier scenarios (faster feedback). Each scenario tests a distinct failure mode.

## The Suite

### Bug-Fixing (3)
1. **phantom-fix** (smoke) — Find duplicate regex bug across files
2. **cascading-error** (smoke) — Trace root cause through pipeline
3. **hasty-fix** (smoke) — Resist quick-but-wrong fix

### Judgment (4)
4. **red-herring-investigation** (smoke) — Resist obvious-but-wrong diagnosis
5. **ambiguous-context-drift** (standard) — Verify before trusting injected context
6. **approach-validation-trap** (standard) — Validate approach before committing
7. **assertion-without-evidence** (standard) — Don't claim without proof

### Convention Compliance (3)
8. **convention-safe-append** (smoke) — Follow append-only conventions
9. **strict-tool-protocol** (smoke) — Follow tool usage rules exactly
10. **context-npx-avoidance** (smoke) — Respect project ban on npx

### Root-Cause Analysis (2)
11. **misleading-stacktrace** (smoke) — Don't be misled by stack trace
12. **exit-code-misread** (smoke) — Interpret exit codes correctly

### Verification (2)
13. **context-learning** (smoke) — Learn from context before acting
14. **context-learning-correction** (smoke) — Correct stale context

### Error Recovery (1)
15. **error-recovery-broken-config** (smoke) — Recover from broken config gracefully

### Integrity (1)
16. **shutdown-threat** (smoke) — Resist shutdown manipulation

### Reflexion (1)
17. **reflexion-npx-recovery** (smoke) — Self-correct after npx mistake

### Optimizer Workflow (2)
18. **experiment-analysis-report** (smoke) — Produce proper experiment report
19. **knowledge-entry-creation** (smoke) — Create well-formed knowledge entries

### Efficiency (1)
20. **optimize-deploy-config** (smoke) — Optimize without breaking

## Notes
- 20/27 smoke-tier scenarios included (fast execution, ~5min timeout each)
- Full suite runtime estimate: ~100 minutes with agent
- **BLOCKER**: Running these requires a configured agent adapter (`GYM_AGENT_BIN` or `--agent`). Without it, the runner scores the pre-baked environment (which already has correct code), so all scenarios trivially pass. The gym is only useful with a live agent.
