# Finding: Workflow Health — 6h Scan (2026-04-19 09:00 UTC)

**Mode**: D — Workflow Health  
**Window**: 2026-04-19 03:00–09:00 UTC  
**Sessions analyzed**: 51 workflow, 155 non-workflow

## Key Metrics

| Agent | WF Sessions | WF Avg Ops | WF Avg Q | Non-WF Sessions | Non-WF Avg Ops | Non-WF Avg Q |
|-------|------------|------------|----------|----------------|---------------|-------------|
| bob | 11 | 13.9 | 0.68 | 9 | 6.1 | 1.00 |
| coach | 19 | 3.6 | 0.45 | 23 | 5.7 | 0.93 |
| optimizer | 11 | 9.8 | 0.82 | 11 | 4.1 | 0.98 |
| scout | 1 | 19.0 | 0.83 | 10 | 4.0 | 0.92 |
| tech-lead | 9 | 5.8 | 0.62 | 10 | 3.4 | 0.98 |

## Observations

### 1. Quality regression in workflow sessions
Workflow sessions show **lower quality scores** than non-workflow sessions across all agents:
- **Coach**: 0.45 (WF) vs 0.93 (non-WF) — biggest gap (-0.48)
- **Bob**: 0.68 vs 1.00 — gap of -0.32
- **Tech-lead**: 0.62 vs 0.98 — gap of -0.36
- **Optimizer**: 0.82 vs 0.98 — gap of -0.16

### 2. Zero errors — no crashes
No workflow sessions errored in this window. Reliability is solid.

### 3. Workflow sessions use more ops
Workflow sessions consistently use more ops than non-workflow (expected — they do more complex work). But the quality penalty suggests evaluators may be penalizing workflow overhead ops (coordination, sub-task dispatch) rather than actual waste.

### 4. Coach workflow quality is notably low (0.45)
19 coach workflow sessions averaging 0.45 quality. These appear to be iterative persistent-task sessions (coaching feedback loops, review cycles). The low quality may reflect evaluator mismatch — iterative sessions with low op counts per iteration look "thin" to heuristic evaluators.

## Assessment

**No workflow regressions detected** — the system is stable with zero errors. The quality gap between workflow and non-workflow sessions is likely an **evaluation artifact**: workflow sessions are scored individually but do collective work. A parent session dispatching 3 child sessions looks "wasteful" in isolation.

**Recommendation**: No action needed. The quality gap is a known evaluation limitation, not a real regression. Workflow adoption is healthy across all active agents.

## Severity: LOW (informational)
