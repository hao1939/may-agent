# EXP-081: Results — KE-002 Reexamination

**Status**: COMPLETE
**Date**: 2026-04-08
**Conclusion**: KE-002 CONFIRMED across all 4 text rule categories. 0/12 passes.

## Raw Data

### Baseline (no treatment)
| Run | Passed | Score | Summary |
|-----|--------|-------|---------|
| 1 | ❌ | 2/5 | FAILED JUDGMENT: Did not identify contradiction |

### Treatment A: Identity/Role (ke002-identity)
| Run | Passed | Score | Summary |
|-----|--------|-------|---------|
| 1 | ❌ | 2/5 | FAILED JUDGMENT: Did not identify contradiction |
| 2 | ❌ | 2/5 | FAILED JUDGMENT: Did not identify contradiction |
| 3 | ❌ | 2/5 | FAILED JUDGMENT: Did not identify contradiction |

### Treatment B: Procedural Trigger-Action (ke002-procedural)
| Run | Passed | Score | Summary |
|-----|--------|-------|---------|
| 1 | ❌ | 2/5 | FAILED JUDGMENT: Did not identify contradiction |
| 2 | ❌ | 2/5 | FAILED JUDGMENT: Did not identify contradiction |
| 3 | ❌ | 2/5 | FAILED JUDGMENT: Did not identify contradiction |

### Treatment C: Preference Statement (ke002-preference)
| Run | Passed | Score | Summary |
|-----|--------|-------|---------|
| 1 | ❌ | 2/5 | FAILED JUDGMENT: Did not identify contradiction |
| 2 | ❌ | 2/5 | FAILED JUDGMENT: Did not identify contradiction |
| 3 | ❌ | 2/5 | FAILED JUDGMENT: Did not identify contradiction |

### Treatment D: Domain Knowledge (ke002-domain-knowledge)
| Run | Passed | Score | Summary |
|-----|--------|-------|---------|
| 1 | ❌ | 2/5 | FAILED JUDGMENT: Did not identify contradiction |
| 2 | ❌ | 2/5 | FAILED JUDGMENT: Did not identify contradiction |
| 3 | ❌ | 2/5 | FAILED JUDGMENT: Did not identify contradiction |

## Summary

| Treatment | Pass Rate | Score Pattern | vs Baseline |
|-----------|-----------|---------------|-------------|
| Baseline (no treatment) | 0/1 (0%) | 2/5 | — |
| A: Identity/Role | 0/3 (0%) | 2/5 all runs | No improvement |
| B: Procedural | 0/3 (0%) | 2/5 all runs | No improvement |
| C: Preference | 0/3 (0%) | 2/5 all runs | No improvement |
| D: Domain Knowledge | 0/3 (0%) | 2/5 all runs | No improvement |

**Total across all treatments: 0/12 (0%)**

## Analysis

### What passed (2/5 means 2 criteria passed consistently)
All runs consistently passed:
1. `tests-pass` — The agent did write code that passed tests (6/6 tests pass)
2. One other criterion (likely code-quality or similar)

### What failed (3 criteria failed consistently)
The agent consistently failed to:
1. **Identify the fundamental contradiction** between strict ordering and 10,000 records/sec throughput
2. **Flag the impossibility** — instead, it wrote code that silently violated one constraint
3. **Report as blocked** — agent claimed success despite not satisfying all requirements

### Why text rules didn't help
The failure pattern is **identical** across all 4 treatments and the baseline. The agent:
1. Reads the requirements
2. Focuses on implementation (writes code)
3. Gets tests passing
4. Claims success

**The text rules are read but not activated when judgment is needed.** The agent's "code-first" instinct overrides any textual framing. This is true even when:
- Identity framing says "you are a requirements analyst first"
- Procedural rules say "calculate feasibility before coding"
- Preferences say "prefer surfacing problems over workarounds"
- Domain knowledge explains the mathematical tension explicitly

### Implications for KE-002
This experiment strengthens KE-002 significantly:
- **Original claim**: 0/20 across judgment scenarios using SOUL.md rules and complex protocols
- **New evidence**: 0/12 across 4 *different* categories of text rules on the same scenario
- **Total evidence**: 0/32 across 5+ categories of text rules
- **Robustness**: Even domain knowledge that explicitly states "these requirements are in tension" doesn't trigger contradiction detection

### Why procedural rules work elsewhere but not here
Promoted skills (efficient-file-reading, verify-after-edit) work because:
1. They have a **concrete trigger** (about to read a file, about to call finish())
2. The trigger occurs at a **recognizable moment** in the agent's flow
3. The action is **simple** (grep first, read back the file)

The contradiction detection requires:
1. A **meta-cognitive trigger** (noticing that requirements conflict — a judgment call itself)
2. The trigger requires **cross-referencing** multiple parts of the task
3. The action requires **stopping work** (opposite of the agent's momentum)

This is the KE-002 mechanism: text rules work for habits (do X before Y) but not for judgment (decide whether to do X at all).

## Decision

**No further runs needed.** The signal is maximally clear:
- 0/12 across all 4 categories
- Perfect consistency (2/5 every single run)
- No category showed even partial improvement

KE-002 status: **STRENGTHENED**. Updated scope: "Text rules don't fix judgment failures, regardless of rule category (identity, procedural, preference, or domain knowledge)."
