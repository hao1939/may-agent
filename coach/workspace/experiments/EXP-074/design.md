# EXP-074: AECRM Context Audit — Rubric/Exemplar Effect on FM-3.1

**Status**: CLOSED — No testable scenario exists
**Date**: 2026-04-08
**Sprint**: 30
**Tags**: FM-3.1, ghost-deliverables, AECRM, rubric, context-engineering

## Hypothesis

Adding explicit rubric + exemplar context to the agent (per AECRM framework, Method 23 from DD#598) reduces FM-3.1 (ghost deliverables) because the agent knows what "done right" looks like.

## Background

- **Method 23** (DD#598, arXiv:2604.04258): 72% of rework comes from incomplete context. AECRM framework identifies 5 context roles: Authority, Exemplar, Constraint, Rubric, Metadata. Biggest gaps in our agent context: Exemplar and Rubric.
- **FM-3.1**: Ghost deliverables — agent claims work is done when it isn't. 52 entries across all ERROR_LOGs (optimizer: 17, coach: 12, tech-lead: 9, bob: 4, coder: 4, may: 3, amy-kimi: 2, evaluator: 1).
- **KE-002**: Text rules have 0/20 success rate for judgment failures. Rubric is text injection (albeit structural/quality-defining rather than behavioral). KE-002 predicts 0% effect.
- **KE-010**: Most gym scenarios are ceiling. Must verify non-ceiling before building treatment.

## Pre-Design Assessment: FM-3.1 Scenario Baseline Check

### Existing FM-3.1 Scenarios

| Scenario | Baseline | Status | Why Ceiling |
|----------|----------|--------|-------------|
| ghost-deliverable-detection | 3/3 (100%) | CEILING | Test suite catches inconsistency; agent always runs tests |
| partial-ghost-deliverable | 3/3 (100%) | CEILING | Agent reads all 5 files regardless of stale context claims |

Both FM-3.1 scenarios from EXP-067/068 are at ceiling. Source: EXP-067 baselines, EXP-068 baselines.

### Why FM-3.1 Is Structurally Untestable in Current Gym

FM-3.1 occurs in production (52 ERROR_LOG entries) but not in gym due to **three structural factors**:

1. **Infrastructure prevention**: The `finish()` tool validates deliverables against the session transcript. If the agent claims files were created/modified but no write/edit appears in the transcript, finish() blocks the call. This catches the most common FM-3.1 pattern (claiming work that wasn't done).

2. **Single-session fresh state**: Production FM-3.1 often involves multi-session drift — the agent trusts a stale checkpoint claiming prior work was completed. Gym scenarios are single-session with clean environments, so there's no accumulated state to create false confidence.

3. **Small environment clarity**: Production agents work in 710MB workspaces with 11,229 files (EXP-065 analysis). Gym environments have 3-12 files. With so few files, the agent reads everything, making ghost deliverables impossible to sneak through.

### Could a Harder FM-3.1 Scenario Be Created?

Considered approaches:
- **No test suite + injected context**: Already tested (partial-ghost-deliverable). Still ceiling — agent reads files regardless.
- **Many deliverables to lose track of**: drudgery-multi-file tests this. Ceiling (EXP-023).
- **Subtle content gaps** (file exists but wrong): partial-ghost-deliverable tests this. Ceiling.
- **Multi-session context simulation**: injected_context infrastructure exists (EXP-067) but both FM-3.1 variants were ceiling.

**Root cause**: In a clean single-session environment, the agent has no reason NOT to verify. The conditions that create production FM-3.1 (context overload, time pressure, multi-session state drift) cannot be replicated in the current gym architecture.

### Is Rubric Really Different from Text Rules?

Even if a non-ceiling scenario existed, there's a second blocker: **KE-002 predicts rubric context won't work**.

- Rubric context = "here's what good output looks like" = text injection
- KE-002: Text rules for judgment = 0/20 (0%)
- Prior art: classify-then-act skill (detailed quality protocol embedded in text) = 0/19
- The DD#598 claim that rubric halves iteration count was measured on human-AI collaboration, not autonomous agents

The only interventions that work for judgment failures are:
- Forced externalization (+74pp, workflow-based)
- Strict classify-then-act workflow (30→100%, structural gate)
- Workaround-resistant scenario design (structural constraint)

All are structural, not text-based.

## Decision: EXPERIMENT CLOSED

Per the task instructions: *"If all candidate scenarios are ceiling for FM-3.1, document that finding and close the experiment."*

**Finding**: All FM-3.1 scenarios are ceiling (100% baseline). FM-3.1 is structurally untestable in the current gym architecture. Even if testable, KE-002 predicts rubric context (a text-based intervention) would have 0% effect on judgment failures.

**Runs used**: 0 (no gym runs needed — assessment used existing baseline data from EXP-067/068)

## Implications

1. **Method 23 (AECRM) remains theoretically interesting but empirically untestable** for FM-3.1 in gym.
2. **FM-3.1 requires production-level testing**, not gym testing. The gym-production gap for this failure mode is structural (EXP-065).
3. **Rubric/exemplar context could still be valuable** for other use cases — particularly for non-judgment tasks where KE-002 doesn't apply (factual completeness, format compliance). But these are already ceiling in gym.
4. **The AECRM audit should focus on production monitoring** rather than gym experiments: track FM-3.1 rates before and after adding rubric context to agent identity files.

## Related

- EXP-065: Production-Gym Gap Analysis (identified structural gaps)
- EXP-067: injected_context infrastructure (ghost-deliverable-detection = ceiling)
- EXP-068: Harder injected_context baselines (partial-ghost-deliverable = ceiling)
- KE-002: Text rules don't fix judgment failures
- KE-010: Most gym scenarios hit ceiling
- Method 23: AECRM Context Completeness Audit (research-notes.md)
