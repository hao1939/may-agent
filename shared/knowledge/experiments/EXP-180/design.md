# EXP-180: Dead Ends Memory — FM-1.3 Reduction

**Date**: 2026-04-18
**Status**: DESIGNED
**Predecessor**: none
**Hypothesis**: H-180a (new — defined below)
**Project**: Project 2 — Learn from Existing Agent Systems

---

## Research Question

Does injecting a structured "dead ends" file into agent context reduce FM-1.3 (path-guessing/flailing) errors by ≥15pp on gym scenarios that involve multi-attempt problem solving?

## Source Pattern

**EvoHarness** — `dead_ends.md` research notebook. Each proposer iteration reads a file listing previously-rejected approaches with reasons. Prevents re-exploring known failures. Ranked #1 in Project 2 triage (highest impact × feasibility for our system).

## Hypothesis

- **H-180a**: Injecting a dead-ends file with 3-5 known-bad approach patterns (NOT scenario-specific answers) improves pass rate by ≥15pp on at least 2 of 3 target scenarios.
- **H-180-null**: Dead-ends file has no significant effect (<5pp change) — agents either already avoid listed mistakes, or the file is ignored/displaces useful context.

## Design

### Arms

| Arm | Intervention | N | Notes |
|-----|-------------|---|-------|
| A (control) | No dead-ends file (current system) | 5 per scenario | Baseline |
| B (treatment) | `dead_ends.md` injected into context.md | 5 per scenario | Contains 3-5 domain-general anti-patterns |

### Dead Ends File Content (Treatment Arm B)

The `dead_ends.md` will contain general anti-patterns derived from our FM-1.3 error log, NOT scenario-specific hints:

```markdown
# Dead Ends — Known Bad Approaches

These approaches have been tried before and consistently fail. Do NOT attempt them.

1. **Guessing file paths from memory** — ALWAYS `ls` the parent directory before reading/editing files in unfamiliar locations. Top error: 34+ wasted calls in 7 days from path guessing.
2. **Assuming tool output succeeded without checking** — Read stderr/stdout after every command. Exit code 0 doesn't mean the operation did what you intended.
3. **Repeating the same failed approach with minor variations** — If an approach fails twice, STOP and try a fundamentally different strategy.
4. **Editing files without reading them first** — Contents may have changed since you last saw them. Always read() before edit().
5. **Committing before verifying deliverables exist** — Check that all output files are present and contain expected content before git commit.
```

### Scenarios

| Scenario | Relevance | Current baseline (est.) |
|----------|-----------|------------------------|
| `stale-approach-fixation` | Directly tests ability to abandon failed approaches | ~50-60% |
| `stale-error-misdiagnosis-v2` | Tests error diagnosis without path-guessing loops | TBD |
| `cascading-fix-trap-v2` | Multi-step problem solving with many wrong paths | ~30-40% |

### Metrics

- **Primary**: Pass rate per scenario (binary: pass/fail per trial)
- **Secondary**: Tool call count (fewer = less flailing), time to first correct action

### Decision Rule

- **Confirmed** if: ≥15pp improvement on at least 2 of 3 scenarios, no regression >10pp on any canary scenario
- **Falsified** if: <5pp improvement on all 3 scenarios
- **Inconclusive** if: mixed results (1 scenario improves, others flat) — extend to 10 trials

## Execution Plan

### Phase 1: Baseline (Arm A)
```bash
# 5 trials per scenario, no intervention
scripts/gym-run.sh stale-approach-fixation --agent coder --tag EXP-180-A --trials 5 --timeout 600
scripts/gym-run.sh stale-error-misdiagnosis-v2 --agent coder --tag EXP-180-A --trials 5 --timeout 600
scripts/gym-run.sh cascading-fix-trap-v2 --agent coder --tag EXP-180-A --trials 5 --timeout 600
```

### Phase 2: Treatment (Arm B)
```bash
# Inject dead_ends.md into agent context, then run same scenarios
# Implementation: append dead_ends.md content to agents/coder/context.md before runs
scripts/gym-run.sh stale-approach-fixation --agent coder --tag EXP-180-B --trials 5 --timeout 600
scripts/gym-run.sh stale-error-misdiagnosis-v2 --agent coder --tag EXP-180-B --trials 5 --timeout 600
scripts/gym-run.sh cascading-fix-trap-v2 --agent coder --tag EXP-180-B --trials 5 --timeout 600
```

### Phase 3: Analysis
- Compare pass rates A vs B per scenario
- Fisher's exact test for significance (small N)
- Check for context-displacement effects (does adding dead_ends.md hurt on unrelated tasks?)

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Dead-ends content too specific → acts as hint | Use only domain-general patterns, not scenario-specific |
| Context displacement (KE-133) | Keep dead_ends.md short (≤200 words); measure canary regression |
| Stacking effect (KE-123) | Run dead-ends as SOLE intervention, no other changes |
| Low N → noisy results | If inconclusive, extend to 10 trials per arm |

## Connection to Project 2

This is the first experiment in the Learn from Existing Agent Systems pipeline. If confirmed:
- Tech-lead implements dead_ends.md as a persistent, auto-updated file in agent context
- Future: explore auto-generating dead-ends from FM logs (full EvoHarness pattern)

If falsified:
- Move to Pattern #2 (Fragility Tracking) or #3 (Prescreen Gate)
- Record as evidence that passive context injection is insufficient for behavior change (cf. KE-011)

---

*EXP-180 | Project 2 | Pattern: Dead Ends Memory | Source: EvoHarness*
