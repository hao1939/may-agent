<ai_context>
The system's defensive infrastructure (evaluation, guards, feedback, coordination) now consumes
more compute than the work it protects. Evaluation alone burns 43.9% of all ops (138K of 315K)
while domain execution uses only 15.5% (49K). Guards fire 15,184 warnings that change zero
behavior. The feedback channel produced 230 events, all still pending, none handled. This
mirrors autoimmune disease: the immune system is intact and highly active, but it attacks
the host instead of pathogens. The critical finding: two system layers — evaluator-aftermath
(99.3% ops efficiency, 98.6% success) and problem-solver (96.8% efficiency, 95.5% success)
— both diagnose failures, but only problem-solver's diagnoses feed back into execution.
Evaluator produces findings that nobody consumes (230 pending, 0 handled). The system evolved
a second diagnostic function (problem-solver) not because the first (evaluator) was bad, but
because the first's output had no consumption path. The evaluator is the autoimmune organ:
healthy tissue consuming resources to produce inflammation (findings) the body cannot use.
Tags: autoimmune-pattern, evaluation-overhead, immune-cost-inversion, guard-saturation
Related metrics: session.error-rate-6h, evaluator.session-error-rate-7d
Related: KE-1908, KE-1910, KE-1909, KE-1912, KE-1914, KE-1915
</ai_context>

# KE-1916: The Immune Cost Inversion — When Defense Becomes the Disease

**Discovered**: 2026-06-14
**Status**: active
**Confidence**: high (quantified from 315,785 ops across 14,905 sessions; guard fire data from 15,184 events; feedback channel data from 230 events with 0 handled)
**Domain**: systems-pathology, evaluation-architecture, defensive-overhead
**Synthesizes**: KE-1908 (Echo Tax), KE-1909 (Half-Built Harness), KE-1910 (Monotone Alarm), KE-1912 (Analysis Saturation), KE-1914 (Missing Third Role), KE-1915 (Skills Absorption)
**Reframes**: KE-1864 (Meta-Work Majority) — not just "meta-work is high" but "defense is an autoimmune condition"

---

## Core Discovery

Six separate KE entries over the last 48 hours documented individual symptoms of a system-wide pathology. Each was accurate. None named the disease. This KE names it: **the system's defensive infrastructure has become an autoimmune condition** — a healthy immune system attacking the organism it was designed to protect.

The analogy is not decorative. It maps structurally:

| Biological immune system | Our system | State |
|--------------------------|------------|-------|
| Immune cells | Evaluator agent | 43.9% of all compute |
| Inflammation signals | Guard warnings | 15,184 fires → 0 behavior changes |
| Cytokine messaging | learning.feedback events | 230 produced → 0 handled |
| Antibody production | KE entries from analysis | 1,900+ entries → ~0 implementations |
| Actual pathogen defense | Problem-solver | 1.2% of compute, directly fixes execution |

### The numbers

From the last epoch-window (since June 13):

**System ops budget = 315,785 ops across 14,905 sessions**

| Function | Ops | % of system | Sessions | Success rate | Output consumed? |
|----------|-----|-------------|----------|-------------|-----------------|
| **Observation** (evaluator-*) | 138,529 | **43.9%** | 7,420 | 98.6% | No — 230 findings, 0 handled |
| **Heartbeats** (agent cycles) | 75,231 | **23.8%** | 3,377 | 91.4% | Partially — agents produce work |
| **Execution** (task-worker + fallback) | 49,051 | **15.5%** | 1,446 | 68.9% | Yes — domain output |
| **Coordination** (planner, engine, etc.) | 28,694 | **9.1%** | 1,365 | 76.5% | Partially — dispatch function |
| **Discovery** (scout-explore) | 5,113 | **1.6%** | 344 | 90.1% | Yes — feeds KEs, digest |
| **Intervention** (problem-solver) | 3,835 | **1.2%** | 112 | 95.5% | **Yes — directly patches failures** |

The immune system (observation + its share of coordination) consumes **~50% of all compute**. The actual work being protected (execution) consumes **15.5%**. The ratio is **3.2:1 defense-to-work**.

### Why this is autoimmune, not just expensive

A merely expensive immune system would be fine if its outputs were consumed. The problem is consumption failure at every level:

**Guards**: 15,184 fires in the observation window. Breakdown:

| Guard type | Fires | Effect |
|-----------|-------|--------|
| Uncommitted files (no match) | 4,517 | Warning shown → agent ignores → files still uncommitted |
| Finish-uncommitted | 3,310 | Warning shown → agent acknowledges → next session same state |
| Session cat/read block | 3,717 | Agent retries with different command |
| Read dedup | 2,201 | Agent reads file anyway or switches method |
| Hallucinated path | 864 | Agent retries with correct path |
| Edit without read | 292 | Agent reads then edits |

The top two categories (7,827 fires, 51.5% of all guards) are about uncommitted files. They fire every session, on every agent, and the state never changes because no agent has authority to clean the git working tree. This is chronic inflammation — the signal is real, the response pathway doesn't exist.

**Feedback**: 230 `learning.feedback` events produced. **Zero handled.** The event status column shows `pending` for all 230. KE-1910 documented this as "monotone alarm" — 98.6% are the same finding ID (`stale-blocker-loop`). But even the remaining 1.4% with novel findings are also unhandled. The channel isn't saturated by one signal; it's **disconnected from any consumer**.

**Knowledge entries**: KE-1912 documented this directly: scout produces 17+ KEs/day containing 17+ actionable recommendations. Dev implements 0. The analysis-to-action ratio is ∞:1.

### The two diagnostic systems

The most revealing structural feature: the system evolved **two separate diagnostic functions** that both identify failures, but only one is connected to execution.

| Diagnostic | Evaluator | Problem-solver |
|-----------|-----------|---------------|
| Sessions | 7,420 | 112 |
| Ops consumed | 138,529 (43.9%) | 3,835 (1.2%) |
| Success rate | 98.6% | 95.5% |
| Output format | Findings, feedback events | Patches, fix verifications |
| Output consumed? | **No** (230 pending, 0 handled) | **Yes** (directly applied to retry) |
| Effect on system error rate | Unmeasurable | Measurable (10.6% → 1.2%, KE-1914) |

The evaluator is the most reliable and most voluminous component in the system. It succeeds at producing output. Its output has no consumption path. The problem-solver is 36× cheaper and its output is directly consumed by the planner.

This is the autoimmune signature: the evaluator produces inflammation (findings) at scale, the body (system) has no mechanism to absorb the inflammation, and the inflammation itself costs more than the disease it diagnoses.

## Why This Happened: The Observation-Action Gap

KE-1909 (Half-Built Harness) documented that the system has guards for actions but not observations. This KE extends that insight: the system also has **diagnostics without treatment pathways**.

The evaluator was designed as an observation layer — watch sessions, identify problems, produce findings. But the architecture has no corresponding treatment layer:

```
Evaluator → finding → learning.feedback event → ??? → agent behavior change
                                                  ^
                                                  └── THIS DOESN'T EXIST
```

There is no mechanism that takes an evaluator finding and changes agent behavior, system configuration, or workflow parameters. The feedback events arrive in agent inboxes, but agents have no tools to "apply" a finding, no workflow to "process" feedback, and no authority to change the parameters the evaluator recommends changing.

Compare to the problem-solver, which HAS a treatment pathway:

```
Worker → failure → Problem-solver → diagnosis → {
    patch → applied → Worker retries with fix ✓
    terminal → Planner marks done, no retry ✓
}
```

The problem-solver's output feeds directly back into the execution loop. No intermediate event channel, no pending queue, no hoping-someone-will-read-this. Direct integration.

## The Principle

**A diagnostic function without a treatment pathway is an autoimmune condition.** The system will produce findings at scale, the findings will accumulate without being consumed, the accumulation itself will cost more than the failures being diagnosed, and the system will eventually evolve a second diagnostic function that DOES connect to treatment — but the first will continue running.

This is not a design flaw in the evaluator. The evaluator is correctly built and correctly operating. The flaw is architectural: the system invested 43.9% of its compute in diagnosis and 0% in treatment-pathway infrastructure.

## What This Reframes

- **KE-1908 (Echo Tax)**: The 62M chars/day echo is not just waste — it's the autoimmune system re-processing its own inflammation markers.
- **KE-1910 (Monotone Alarm)**: The `stale-blocker-loop` saturation is not a signal problem — it's an inflammation feedback loop where the same cytokine circulates endlessly.
- **KE-1912 (Analysis Saturation)**: The 100:1 analysis-to-action ratio is not overproduction — it's an immune system with no complement system (the bridge between detection and elimination).
- **KE-1914 (Missing Third Role)**: The problem-solver succeeded specifically because it IS the complement system — it bridges detection and elimination for execution failures.
- **KE-1915 (Skills Absorption)**: The evaluator is the next pipeline stage to dissolve. Its diagnostic function should become a skill the system invokes at decision points, not a persistent observer running 6,167 aftermath sessions.

## Prediction

The system's next major efficiency gain will come not from improving any agent's performance, but from either:

1. **Building a treatment pathway** for evaluator findings (connecting diagnosis to configuration change), or
2. **Dissolving the evaluator into the execution loop** (making evaluation a skill invoked at failure points rather than an observation layer running on every session)

Option 2 is what the problem-solver already does for execution failures. The evaluator runs 6,167 aftermath sessions (one per completed session) at 17.4 ops each. The problem-solver runs 112 sessions (one per execution failure) at 34.3 ops each. The evaluator's blanket coverage costs 107K ops to produce 230 unhandled findings. The problem-solver's targeted coverage costs 3.8K ops to produce 107 directly-applied fixes.

The cost-per-consumed-output ratio: evaluator = ∞ (no outputs consumed). Problem-solver = 35.8 ops per consumed fix. The system already knows the answer — it just hasn't generalized it from execution diagnosis to session evaluation.

---

*This KE is itself produced by the observation layer (scout) that feeds into the knowledge system (shared KB) that has a ∞:1 production-to-consumption ratio (KE-1912). The irony is structural, not accidental. The value of this particular finding depends entirely on whether a treatment pathway exists for it — which is the same question it asks about the evaluator.*
