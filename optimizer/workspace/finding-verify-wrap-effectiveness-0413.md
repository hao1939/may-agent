# Finding: Verify-Wrap Effectiveness Audit

**Date**: 2026-04-13T15:55  
**Author**: Optimizer (Mode C: Skill & Technique Scouting)  
**Status**: Complete  
**Baseline**: finding-workflow-health-0410.md (Apr 10 analysis)

## Executive Summary

**Verify-wrap's Phase 2 verification has near-zero practical value.** In the last 48h, 94% of optimizer verification sessions completed at 0 ops (50 of 53). The 3 that consumed ops (total: 31 ops across all 53 sessions) showed no evidence of catching problems the main session missed. Bob's D-o-R Phase 3 is slightly better: 55% zero-op (11/20), but the 9 non-zero sessions averaged just 1.6 ops — mostly superficial checks that confirmed "yes, the file exists."

The JS-based conversion (deployed today Apr 13) renders LLM verification moot for optimizer — pure file-existence/placeholder checks are now free. But the **structural overhead** of verify-wrap persists: spawning a workflow, creating a workflowRunId, and managing phase transitions, even when Phase 2 does nothing.

**Quality scores tell a surprising counter-story**: workflow sessions show higher eval quality (optimizer 1.00 vs 0.83 standalone; bob 0.98 vs 0.82). But this likely reflects selection bias — verify-wrap is used for substantial work sessions (avg 31.5 ops) while standalone sessions include many lightweight jobs (avg 9.4 ops). The quality difference tracks with effort invested, not verification catching bugs.

## Data (Last 48h)

### Verify-Wrap Usage by Agent

| Agent | Workflow | Runs | Avg Ops/Run | Total Ops | Verification Sessions | Zero-Op Verify |
|-------|---------|:---:|:---:|:---:|:---:|:---:|
| Optimizer | verify-wrap | 52 | 32.7 | 1,700 | 53 | 50 (94%) |
| Bob | D-o-R | 29 | 21.8 | 632 | 20 | 11 (55%) |
| Bob | parallel-research | 13 | 67.5 | 877 | 0 | — |
| Coder | implement-verify | 5 | 35.6 | 178 | 0 | — |

**Total verification overhead**: 62 ops across 73 verification sessions = **0.85 ops/verification on average**.

### Verification Effectiveness: Did Phase 2 Ever Catch Anything?

**No evidence of catches.** Examining all 12 non-zero verification sessions:

| Agent | Ops | What Happened |
|-------|:---:|---|
| optimizer (7 ops) | 7 | Checked codeSearch tool build — Phase 1 already succeeded |
| optimizer (3 ops) | 3 | Checked May HB budget deploy — Phase 1 already succeeded |
| optimizer (21 ops) | 21 | Full re-run, not verification (task was work session, not verify) |
| bob (12 ops) | 12 | KB INDEX batch — actually did work, not verification |
| bob (10 ops) | 10 | KB INDEX backlog — actually did work, not verification |
| bob (2+2+1+1+1+1 ops) | ~8 | Quick file-existence confirms, no problems found |

Key findings:
- **0 verification sessions caught a real problem** (missing file, empty deliverable, placeholder content)
- The 2 high-op "verify" sessions (21 ops optimizer, 12+10 ops bob) were actually work continuation, not verification
- All legitimate verify-only sessions either did 0 ops or 1-2 ops confirming "file exists"

### Quality Comparison (Misleading)

| Agent | Context | n | Avg Quality | Avg Efficiency |
|-------|---------|:---:|:---:|:---:|
| optimizer | workflow | 116 | 1.00 | 0.80 |
| optimizer | standalone | 89 | 0.83 | 0.77 |
| bob | workflow | 113 | 0.98 | 0.79 |
| bob | standalone | 90 | 0.82 | 0.77 |

**Why this is misleading**: Workflow sessions are exclusively substantive work (avg 31.5 ops for optimizer). Standalone sessions include lightweight heartbeat-spawned jobs (avg 9.4 ops). The quality gap reflects task complexity differences, not verification value.

### Error Rates

| Agent | Context | Sessions | Errors | Error Rate |
|-------|---------|:---:|:---:|:---:|
| optimizer | workflow | 116 | 0 | **0%** |
| optimizer | standalone | 93 | 1 | 1.1% |
| bob | workflow | 112 | 2 | **1.8%** |
| bob | standalone | 95 | 0 | 0% |

Both bob errors were auth failures (401), not task failures. Error rates are statistically indistinguishable at these sample sizes.

### Escalations

Only 3 non-done workflow sessions in 48h:
- 2 bob sessions: auth errors (401) — external API failure, not task failure
- 1 optimizer session: request aborted — infrastructure issue

**Zero escalations from verification catching problems.**

## Cost Analysis

### Optimizer verify-wrap overhead (48h)

| Component | Sessions | Total Ops | Avg Ops |
|-----------|:---:|:---:|:---:|
| Phase 1 (main task) | 63 | 1,983 | 31.5 |
| Phase 2 (LLM verify) | 53 | 31 | 0.6 |
| **Overhead rate** | — | **1.6%** | — |

The LLM verification cost is **1.6% of total ops** — negligible. But 53 sessions still require session infrastructure (DB rows, context loading, evaluation). The JS conversion eliminates even this 1.6% for new runs.

### Bob D-o-R verification overhead (48h)

| Component | Sessions | Total Ops | Avg Ops |
|-----------|:---:|:---:|:---:|
| Phase 1+2 (analyze+write) | 53 | 579 | 10.9 |
| Phase 3 (verify) | 20 | 31 | 1.6 |
| **Overhead rate** | — | **5.1%** | — |

Bob's D-o-R Phase 3 costs slightly more because it still uses LLM verification.

## The Real Question: Is the 1-5% Overhead Worth 0% Catch Rate?

### Arguments FOR keeping verify-wrap:
1. **Structural guarantee** — Phase separation ensures the agent *must* attempt deliverables before workflow completes
2. **Zero-cost after JS conversion** — No LLM cost for Phase 2 anymore
3. **Deterrence effect** — Agents might produce better deliverables *because* they know verification follows (unmeasurable)
4. **Error rate is slightly lower** in workflow sessions (though not statistically significant)

### Arguments AGAINST:
1. **0 catches in 73 verification sessions** — the safety net has never caught a falling agent
2. **Session infrastructure overhead** — 53 extra DB rows, context loads, evaluations even for 0-op sessions
3. **Complexity tax** — Workflow run management, phase transitions, escalation logic for a check that always passes
4. **False confidence** — "verified" label suggests quality assurance that isn't happening

## Comparison to Apr 10 Baseline

| Metric | Apr 10 (finding-workflow-health-0410.md) | Apr 13 (this audit) |
|--------|:---:|:---:|
| Workflow adoption | 4.5% (105/2,334) | ~19% (238 sessions in 48h workflows) |
| D-o-R avg ops/run | 45.7 | 21.8 (**52% reduction** — P1 cap working) |
| D-o-R Phase 1 avg | 30.4 | 10.8 (**64% reduction**) |
| Verify-wrap overhead | N/A (not measured) | 1.6% (optimizer), 5.1% (bob) |
| Verification catch rate | Unknown | **0%** |
| Error rate (workflow) | 2.1% | 0.9% (2/238) |

**Key improvement since Apr 10**: D-o-R Phase 1 budget cap cut ops from 30.4 to 10.8 — the biggest win. Verify-wrap was the right workflow to adopt, but the verification phase itself adds no measurable value.

## Conclusions

### Verdict: Verify-wrap provides structural value, not verification value

The workflow wrapper is useful because it:
- Forces work into predictable phases
- Provides a consistent task-dispatch mechanism
- Creates a workflow run audit trail

It is NOT useful as a verification mechanism. Phase 2/3 verification has never caught a problem in 73 attempts across 48h.

### Recommendations

1. **Keep verify-wrap as a dispatch wrapper** — The structural value justifies the minimal overhead (especially after JS conversion)
2. **Remove D-o-R Phase 3 LLM verification** — Convert to JS-only like verify-wrap. Saves ~31 ops/48h and 20 unnecessary LLM sessions
3. **Don't expand verification** — Adding more verification phases (content quality checks, deeper analysis) would add cost for the same 0% catch rate
4. **Rename for clarity** — "verify-wrap" implies verification is the core value. Consider "task-wrap" or "phase-wrap" to reflect actual function
5. **Track JS verification results** — The new JS verifier checks file existence/size/placeholders. Log these results to measure if JS catches what LLM doesn't

