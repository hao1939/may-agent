# Content-First Guard Design — Difficulty-Adaptive Passive Injection

**Date**: 2026-04-17
**Author**: Bob
**Derived from**: KE-195, KE-196, H-165, EXP-166
**Hypothesis under test**: H-165 (Production-Provision Interference, P(H)=0.92) — this guard design is H-165's operational consequence.
**Status**: Design proposal for tech-lead review
**Purpose**: Translate EXP-166's displacement finding into an implementable guard that preserves F1's +100pp benefit on hard tasks without triggering the 93pp production-displacement cost.

## Core Principle (from KE-195)

> Self-production destroys expert analysis benefit on hard tasks. The mechanism is **capacity displacement, not anchoring** — order doesn't matter; producing costs cognitive budget regardless. Guards must be **passive** (inject information, let agent work) rather than **active** (require agent to restate/plan/summarize).

EXP-166 numbers: on cascading-fix-trap-v2, F1-only = 100%, F1→F2 = 7%. Same expert content, same model — the production step alone costs 93pp (KE-196).

## 1. Difficulty Trigger — When Does the Guard Activate?

The guard needs to distinguish "hard task" (passive-only) from "easy task" (production OK) *before* the first tool call, because the first production event is where the damage starts.

**Primary trigger (cheap, structural):**
- Failing-test count > 1 in initial harness run → likely cascading/hard (cascading-fix-trap has 3 failing tests)
- Multi-file edit surface (>2 files touched by CHANGELOG or recent commits) → hard
- CHANGELOG/comment presence of authoritative-sounding misleads (regex on "intentional", "deprecated but OK", "known quirk") → hard

**Secondary trigger (scenario-tagged):**
- Gym scenario declares `difficulty: hard` in its metadata → guard routes passive
- Unknown/untagged scenarios → **default passive** (KE-196 heuristic: cost of unnecessary passivity on easy tasks = 0pp; cost of unnecessary production on hard tasks = 93pp. Asymmetry favors passive default.)

**What NOT to use as trigger:**
- Agent self-assessment of difficulty → this IS production, triggers displacement
- LLM classifier → costs a call, introduces another capacity-competing process

## 2. Injection Payload — What, When, Where?

**What**: A short expert-analysis block (F1-style) — root cause statement + non-obvious constraint + the one trap to avoid. 100-300 tokens. Must be a statement, not a question; must not ask the agent to acknowledge or restate.

**When**: Once, at session start, *before* the agent's first reasoning turn. Not drip-fed (each re-injection risks re-triggering production).

**Where (code-vs-data decision)**:

Apply the decision tree from `code-vs-data-decisions.md`:

- Is this PERMANENT and UNIVERSAL? **No** — payload is scenario-specific.
- Does it depend on environment? **Yes** — scenario identity determines payload.
- Is it judgment? **No** — it's content delivery.

→ **Data (context.md-style injection), not guard code.** Specifically: per-scenario `hints.md` loaded by the existing scenario harness, delivered as a system/user message prepend. No regex guard, no content-mutation hook.

The ONE piece of code this requires: a small scenario-runner extension (`loadHints(scenarioId)`) that reads `scenarios/<id>/hints.md` if present and prepends it. Everything else is data.

## 3. Fallback Paths When Triggers Misfire

| Misfire | Cost | Mitigation |
|---------|------|------------|
| Easy task gets passive injection | 0pp (KE-196: no displacement on easy) | None needed |
| Hard task classified as easy, no hints | Back to baseline (0% on cascading) | Log + post-hoc: if agent fails and failing-test-count >1, surface hint on retry |
| Hard task gets hint but agent ignores | Same as baseline | Acceptable — we're preserving expert info, not forcing use |
| Hint content is wrong | Worse than baseline (misleads) | Hints require evidence-gate review before landing (workflow) |

The asymmetric cost structure (KE-196) means **defaulting to passive is always safe**. The only catastrophic failure mode is wrong-hint content, which is an authoring problem, not a guard problem.

## 4. Testability — Gym Validation Plan

**Scenario**: `sql-injection-in-query-builder` (33% baseline, KE-196-confirmed in-range for medium-difficulty test — the untested band).

**Design (4 arms × 15 trials = 60 runs, ~$4.50)**:

| Arm | Description | Prediction |
|-----|-------------|------------|
| A | Baseline, no hints | ~33% |
| B | Passive-injection (hints.md prepend, no production ask) | ~80-100% |
| C | Active-injection (hints + "summarize the key constraint before fixing") | ~33-50% (displacement partial at medium difficulty — P-165c) |
| D | Trigger-routed (auto-detect difficulty → B or baseline) | ~80-100% if trigger fires |

**Promotion criterion**: B ≥ A + 30pp AND B ≥ C + 20pp. This would replicate KE-195 in a new scenario AND validate that the trigger-routing logic produces B-level outcomes without manual tagging.

**Failure mode of test**: if B = C (no displacement on medium), then KE-196's difficulty-moderation boundary is *not* at 33% — design must be re-scoped to hard-only scenarios, and passive-injection becomes less-general than claimed.

## 5. Explicit DO-NOT List

Grounded in KE-091 (alignment tax on creative tasks), KE-123 (never stack interventions), KE-195/KE-196:

1. **DO NOT require the agent to summarize, restate, or acknowledge the hint.** This is the exact production step that costs 93pp (KE-195).
2. **DO NOT combine passive-injection with any other intervention in the same session.** KE-123: stacking degrades 12-15pp. One lever per session.
3. **DO NOT use forced-verification guards ("check before finishing") alongside hints on hard tasks.** KE-091: verification guards harm creative/complex work. The hint IS the intervention; additional gates compound cost.
4. **DO NOT build this as a regex guard on agent output.** It's a data-delivery problem (scenario → content). Regexes on outputs risk false positives when scenarios change (code-vs-data-decisions.md).
5. **DO NOT ask the agent to self-classify task difficulty.** Self-classification is production; triggers the very displacement we're avoiding.
6. **DO NOT re-inject hints mid-session** on retries within the same context. Re-injection invites the agent to restate → production → displacement.
7. **DO NOT generalize to non-recognition tasks without retesting.** EXP-166 evidence is recognition/root-cause failure mode; other failure modes (KE-187 policy-invisible, KE-129 hidden-dep) are unconfirmed.

## Summary for Tech-Lead

Build: `scenario-runner loadHints(scenarioId)` (~20 LOC) + per-scenario `hints.md` files (data). Trigger: failing-test-count >1 OR explicit `difficulty: hard` tag OR unknown-default-passive. Validation: EXP-217 (proposed) on sql-injection at 33% baseline, 60 runs. Promotion gate: B ≥ A+30pp AND B ≥ C+20pp. Expected cost: ~$4.50. The whole design rests on a single empirical claim (KE-195) validated on one scenario pair — EXP-217 is the replication and difficulty-band extension.
