# Finding: Workflow Health Check — Apr 16, 2026 (03:30 UTC)

## Summary
System-wide workflow adoption has **dropped sharply** from 27.1% (Apr 12) to **5.2%** (last 6h). This is a significant regression worth investigating.

## Data (Last 6h Window)

### Overall
- **Total sessions**: 22,156
- **Workflow sessions**: 1,153
- **Adoption rate**: 5.2% (down from 27.1% on Apr 12)

### By Agent (core agents only)
| Agent | Total | Workflow | Rate |
|-------|-------|----------|------|
| coder | 393 | 174 | **44.3%** |
| optimizer | 2,061 | 250 | 12.1% |
| bob | 2,963 | 340 | 11.5% |
| qa | 970 | 100 | 10.3% |
| coach | 2,984 | 255 | 8.5% |
| tech-lead | 2,403 | 27 | 1.1% |
| scout | 1,223 | 7 | 0.6% |
| may | 4,395 | 0 | 0.0% |
| evaluator | 2,504 | 0 | 0.0% |
| amy/amy-kimi | 1,944 | 0 | 0.0% |

### Efficiency: Workflow vs Non-Workflow
- **Non-workflow avg ops**: 15.3 (n=10,078)
- **Workflow avg ops**: 19.8 (n=938)
- Workflow sessions use **29% more ops** on average — opposite of what we'd hope

### High-Op Workflow Sessions (>20 ops)
Top offenders: bob (187, 113, 100, 93, 93, 90, 90 ops), coder (104 ops), coach (98, 96 ops). These are mostly research/planning workflows that don't benefit from structure (aligns with KE-015/KE-016 — workflows help eliminable decisions, hurt essential/exploratory ones).

## Analysis

1. **Adoption collapse**: 27.1% → 5.2% is dramatic. The denominator grew (many test/variant agents with 0% adoption), but even core agents show low rates. Only coder (44.3%) has strong adoption.

2. **Efficiency concern**: Workflows averaging 19.8 ops vs 15.3 for non-workflow suggests they're adding overhead, not reducing it. The high-op outliers (bob 187 ops) inflate this, but the pattern is clear.

3. **Agent stratification**: Clear tiers — coder is a workflow-heavy agent, bob/optimizer/qa/coach are moderate adopters (8-12%), and may/evaluator/amy never use workflows.

4. **Exploratory tasks don't benefit**: The highest-op workflow sessions are research synthesis, scenario design, and sprint planning — exactly the task types KE-015 predicts workflows hurt (high decision topology R).

## Recommendations
- Investigate why adoption dropped — was it a deployment change, or natural selection away from workflows?
- Focus workflow use on structured/repetitive tasks (coder's pattern), not open-ended research
- Consider removing workflow wrapping from research/synthesis tasks to reduce overhead

## Conclusion
Workflow adoption has regressed significantly. The remaining workflow usage shows higher ops than non-workflow, suggesting current workflow designs add overhead for the task types they're applied to. Coder is the success story; research-heavy agents should likely reduce workflow use.
