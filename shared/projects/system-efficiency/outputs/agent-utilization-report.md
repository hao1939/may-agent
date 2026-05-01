# Agent Utilization Report

*Generated: Phase 5, Iteration 31*

## Per-Project Efficiency

| Project | Outputs | Iterations | Ratio | Rating |
|---------|---------|------------|-------|--------|
| system-efficiency | 70 | 74 | 0.95 | ⭐ Excellent |
| workflow-reliability | 16 | 25 | 0.64 | ✅ Good |
| handler-reliability | 2 | 2 | 1.00 | ⭐ Excellent |
| skill-workflow-audit | 28 | 93 | 0.30 | ⚠️ Below avg |
| request-deduplication | 2 | 11 | 0.18 | ⚠️ Below avg |
| agent-memory-learning | 7 | 56 | 0.13 | 🔴 Low |
| test-coverage | 6 | 36 | 0.17 | 🔴 Low |
| agent-system-literacy | 8 | 87 | 0.09 | 🔴 Very low |
| documentation-gen | 8 | 106 | 0.08 | 🔴 Very low |
| coach-quality | 0 | 64 | 0.00 | ❌ Zero output |
| hao-alignment | 0 | 20 | 0.00 | ❌ Zero output |
| gym-quality-improvement | 0 | 23 | 0.00 | ❌ Zero output |
| agent-convention-compliance | 0 | 12 | 0.00 | ❌ Zero output |
| evaluation-revival | 0 | 12 | 0.00 | ❌ Zero output |
| proof-of-life-dashboard | 0 | 4 | 0.00 | ❌ Zero output |

## Top 3 Performers

1. **system-efficiency** (0.95) — 70 outputs in 74 iterations. Near-perfect utilization. This project benefits from clear plan items and concrete deliverables each iteration.
2. **handler-reliability** (1.00) — Small sample (2/2) but perfect ratio. Well-scoped tasks.
3. **workflow-reliability** (0.64) — 16 outputs in 25 iterations. Good ratio for infrastructure work.

## Bottom 5 (Zero or Near-Zero Output)

1. **coach-quality** (0.00) — 64 iterations, 0 outputs. 100% waste. Likely a meta-project with no file deliverables expected.
2. **hao-alignment** (0.00) — 20 iterations, 0 outputs. Alignment work may produce config/behavioral changes rather than files.
3. **gym-quality-improvement** (0.00) — 23 iterations, 0 outputs. Work may land in gym/ directory rather than outputs/.
4. **documentation-gen** (0.08) — 106 iterations for 8 outputs = 98 wasted iterations. Highest absolute waste.
5. **agent-system-literacy** (0.09) — 87 iterations for 8 outputs. Similar pattern.

## System-Wide Stats

- **Total iterations**: 625
- **Total outputs**: 168
- **System-wide ratio**: 0.27 (27%)
- **Wasted iterations**: ~457 (73%)

## Root Cause Analysis

| Waste Pattern | Est. % of Waste | Fix |
|---------------|----------------|-----|
| Zero-output projects (no file deliverables expected) | ~30% | Exclude meta-projects from efficiency metrics |
| Retry storms (failed writes, context loss) | ~25% | WRITE-FIRST constraint helps; need crash recovery |
| Analysis paralysis (reads without writes) | ~25% | Enforce "write stub first, fill later" pattern |
| Blocked on other agents | ~20% | Better dependency tracking |

## Recommendations

1. **Retire or restructure zero-output projects** — coach-quality, hao-alignment, evaluation-revival produce no files. Either add concrete deliverables to their plans or close them.
2. **Investigate documentation-gen** — 106 iterations for 8 outputs is the worst absolute waste. The project may need rescoping.
3. **Enforce write-first** across all workflows — system-efficiency's 0.95 ratio proves the pattern works.
4. **Add output tracking to project.md** — Each plan item should name its expected output file. This makes "did this iteration produce?" trivially measurable.
