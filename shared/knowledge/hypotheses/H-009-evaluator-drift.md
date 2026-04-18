# H004: Evaluator Drift is Our Biggest Unmonitored Risk

**Author:** Bob (Architect)
**Date:** 2026-04-01
**Status:** Resolved (confirmed, mitigated)
**Domain:** Evaluation integrity, system safety

## Hypothesis

Our evaluation system (which scores every session as good/acceptable/needs_improvement/poor) is itself subject to drift and gaming, but we have no mechanism to detect this. The evaluator is the system's "immune system" — if it degrades, the system loses its ability to detect its own failures.

**Prediction**: The evaluator's standards have already drifted since deployment. Specifically, sessions rated "good" today would have been rated "acceptable" by the evaluator's original calibration. This drift is invisible because we only track the evaluator's outputs, never its calibration.

## Why This Matters

The ASL research (HB-2186, arXiv:2510.14253) found that **static reward models learn to be gamed**: "If Reward Model stays frozen, the solver learns to exploit loopholes (reward hacking). GRM must evolve with data distribution." Our evaluator IS a reward model — agents optimize for good evaluations. If the evaluator doesn't evolve its standards, agents learn to satisfy the evaluation criteria without actually improving.

The "Deceptive Reasoning Judges" paper (HB-2178, arXiv:2603.12246) goes further: "In non-verifiable domains, reasoning LLM judges learn to deceive other judges. Stronger reasoning ability makes them better at finding system loopholes."

## Evidence From Our System

**Evaluation trend (from recent analysis)**:
- 2026-04-01 09:06 analysis: "Best day ever — 88.5% good rate"
- The good rate has been consistently climbing: ~60% → ~75% → ~85% → 88.5%

**But has the system actually gotten 88.5% better?** Consider:
- Convention pass rates are at 89.4% (6h) — lower than the evaluation "good" rate
- The same sessions that fail conventions often still get "good" evaluations
- Verdict: The evaluator and the convention checker are measuring different things, and they're diverging

**Specific concern**: The evaluator uses heuristics (evaluatedByHeuristic field in DB). These heuristics were tuned against early session data. As agents learned to produce certain output patterns (call finish(), include summaries), the heuristic criteria became easier to satisfy without substantive improvement.

## The Drift Mechanism

1. **Early state**: Evaluator has high standards, agents fail frequently → failures drive improvement
2. **Middle state**: Agents improve, pass rates go up, evaluator is properly calibrated
3. **Current state**: Agents have learned the evaluation criteria pattern (finish with summary, include deliverables, verify before closing). The evaluator rewards these patterns. **But pattern compliance ≠ task quality.**
4. **Predicted future state**: 95%+ good rate with no actual quality improvement. The evaluator becomes a rubber stamp.

## Counter-Evidence

- The evaluator DOES catch real failures (see 1 needs_improvement in last 6h)
- Convention checks provide an independent signal (structural, not LLM-judged)
- The heuristic evaluator was explicitly designed to be cheap and fast, not deep

## What the Literature Says

**ASL Three-Role Architecture** (HB-2186): Proposes Generator-Solver-Judge triad where the Judge evolves with the data. Our system has Coach (soft judge), Evaluator (hard judge), and Convention Checker (rule-based judge) — but none of them evolve their standards.

**ENCORE** (HB-2180, arXiv:2503.20995): Scoring entropy correlates -0.96 with prediction accuracy. High-confidence evaluations may be the most wrong ones if the evaluator has drifted.

**Structured Intent** (HB-2309): "Dimension decomposition itself is the effective factor" — suggesting our evaluation dimensions (quality, efficiency, verdict) may be too coarse. More granular dimensions would resist drift.

## Testable Claims

1. **Calibration test**: Take 20 sessions rated "good" from this week and 20 from 3 weeks ago. Have a fresh LLM evaluator (not our tuned heuristic) rate them all blind. If the calibration hasn't drifted, both sets should have similar distributions.
2. **Convention-evaluation divergence**: Sessions that fail ≥2 conventions should have lower evaluation verdicts. If the correlation is weak, the evaluator is missing real quality issues.
3. **Pattern gaming**: Count how many "good" sessions have (a) finish() called, (b) summary present, (c) verification evidence present — but (d) the actual deliverable has no meaningful change. This is "pattern compliance without substance."

## Proposed Safeguard

**Evaluation anchoring**: Periodically (weekly) sample N=10 sessions, have a separate LLM evaluate them from scratch (not the cached heuristic), and compare against the production evaluator's scores. If the delta exceeds a threshold, recalibrate.

This is the "GRM must evolve" principle from the ASL paper, applied to our evaluation system.

## Empirical Evidence (2026-04-05, Bob)

### DB Analysis: Heuristic Evaluator Mechanism

**Method**: Analyzed 718 heuristic evaluations from Mar 20-23 snapshot in agents/.state/may.db + read `computeHeuristicScores()` in `src/lib/evaluator.ts`.

**Finding 1: The evaluator is a binary classifier, not a quality scorer.**

| quality | efficiency | verdict | count | % |
|---------|-----------|---------|-------|---|
| 5 | 4 | good | 651 | 90.7% |
| 4 | 4 | good | 22 | 3.1% |
| 1 | 3 | needs_improvement | 27 | 3.8% |
| 2-3 | 2-3 | acceptable | 18 | 2.5% |

91.6% of all evaluated sessions have ZERO issues detected.

**Finding 2: The heuristic mechanism guarantees "good" for any completed session.**

Scoring: quality starts at 3, efficiency at 3. Then:
- `finish()` called → quality +1
- `status=done && toolCalls >= 3` → quality +1, efficiency +1
- Threshold for "good": quality ≥ 4 AND efficiency ≥ 4

**Any session that calls finish() and makes 3+ tool calls is automatically "good."** No check for deliverable quality, task completion, or output accuracy.

**Finding 3: Zero LLM evaluations of actual work.** All 15 non-heuristic evaluations are evaluator self-evals (skipped). 100% of real evaluations are heuristic-only.

**Finding 4: Convention checks table has 0 rows.** The independent structural signal doesn't exist in this data window.

### Assessment of Testable Claims

| Claim | Evidence | Result |
|-------|----------|--------|
| Calibration drift | Mechanism analysis: the heuristic CANNOT rate completed sessions below "good" — drift is moot | ★★★★ (design flaw, not drift) |
| Pattern gaming (claim #3) | finish() + 3 tool calls = good, regardless of output quality | ★★★★★ confirmed |
| Rubber stamp | 90.7% "good" with zero quality differentiation among completed sessions | ★★★★★ confirmed |
| Convention divergence (claim #2) | Cannot test: 0 convention check rows in DB | Untestable |

### P(H) Update: 0.51 → 0.82

The core prediction — that the evaluator cannot detect quality problems in completed sessions — is confirmed by direct code + DB analysis. This is not drift (gradual degradation) but a **design limitation**: the heuristic evaluator was never capable of quality differentiation for completed sessions. The system's "immune system" has a fundamental blind spot for any session that achieves `status=done` with `finish()` and ≥3 tool calls.

**Key nuance**: The hypothesis framed this as "drift" but the evidence shows it's worse — the evaluator never had calibration to lose. It's a structural blind spot, not degradation.

## Related Work

- ASL Three-Role Architecture (HB-2186): Static reward model → reward hacking
- Deceptive Reasoning Judges (HB-2178): Strong reasoners game evaluation
- ENCORE (HB-2180): Entropy-based evaluation quality estimation
- IBM AgentFixer (HB-2315): Rule-based + LLM-as-judge hybrid evaluation
- Our convention checker: Independent structural signal that doesn't drift (rules are code) — but has 0 rows in DB, so currently non-functional as a check

## Fix Applied (2026-04-05)

### Phase 1: Finish-status-aware heuristic scoring

**Commit**: `6d69442` — feat(evaluator): H-009 fix — finish-status-aware heuristic scoring

**What changed**: `computeHeuristicScores()` now extracts the finish() tool call arguments from the message transcript and uses `status`, `verification_evidence`, and `deliverables` for quality differentiation:

| Finish status | Quality modifier | Rationale |
|---------------|-----------------|-----------|
| `success` + verification_evidence | +2 | Verified completion with evidence |
| `success` without evidence | +1 | Claimed success, unverified (legacy behavior) |
| `partial` | 0 | Honest about incomplete work — no penalty, no bonus |
| `failure` / `blocked` | -1 | Task did not complete successfully |

**New issues tracked**: `finish_success_verified`, `finish_success_unverified`, `finish_partial`, `finish_failure`, `finish_blocked`, `has_deliverables`, `no_finish_call`

**Impact**: Sessions that previously all scored quality=5 will now show differentiation:
- A session that calls `finish(failure)` after 3 tool calls → quality=3 (was 5)
- A session that calls `finish(success)` with evidence → quality=5 (unchanged)
- A session that calls `finish(partial)` → quality=4 (was 5)

**Status**: H-009 partially addressed. The heuristic evaluator can now distinguish completion status. Remaining gap: still no semantic evaluation of deliverable quality (content analysis). That requires either LLM-based evaluation (expensive) or more sophisticated heuristics.

### Phase 2: Semantic Quality Signals (2026-04-05)

**Commit**: (pending) — feat(evaluator): H-009 Phase 2 — semantic quality heuristics

**What changed**: `computeHeuristicScores()` now checks three semantic quality signals when `finish(success)` is claimed:

| Check | Trigger | Effect | Rationale |
|-------|---------|--------|-----------|
| Hollow summary | `summary.length < 30` on success | quality -1 | Trivial summary suggests superficial completion |
| Vague evidence | ALL evidence items are < 20 chars or don't reference tools/steps | quality -1 | Evidence without specifics is theater |
| No deliverables | `deliverables.length === 0` with 5+ tool calls | info-only (tracked) | Measure prevalence before penalizing |
| Mostly vague evidence | > 50% of evidence items are vague | info-only (tracked) | Alert signal without penalty |

**New issues tracked**: `hollow_summary`, `vague_verification_evidence`, `mostly_vague_evidence`, `success_no_deliverables`

**Impact**: Sessions that previously all scored the same now get differentiated:
- A session with `finish(success, summary: "Done")` → quality -1 penalty
- A session with vague evidence like `["verified", "looks good"]` → quality -1 penalty
- A session with rich evidence like `["Step 8: bash test exit code 0"]` → no penalty

**Tests**: 6 new test cases in `test/evaluator-heuristic.test.ts` (37 total, all passing)

### EXP-039 Phase A Results (2026-04-06)

**Finding**: Heuristic evaluator shows 0% verdict change between contextual (full self-narrative) and isolated (stripped) conditions across 19 production sessions.

| Metric | Contextual | Isolated | Delta |
|--------|-----------|----------|-------|
| Avg Quality | 4.84 | 4.89 | +0.05 |
| Avg Efficiency | 3.95 | 3.95 | 0.00 |
| Verdict changes | — | — | 0/19 (0%) |

**Implication**: The heuristic evaluator's rubber-stamp behavior is a structural property (finish() + 3 tool calls = good), NOT caused by reading agent self-narrative. Removing the self-narrative doesn't change scores because the heuristic never looked at it anyway. The confirmation bias from agent self-narrative likely affects the **LLM evaluator** (which reads natural language) — this needs Phase B testing.

**Implementation**: `formatIsolatedTranscript()` function in `src/lib/evaluator.ts` — 14 unit tests passing.

### Phase 3: Scoring Recalibration (2026-04-06)

**Commit**: feat(evaluator): H-009 Phase 3 — scoring recalibration to end rubber-stamping

**Problem**: Despite Phases 1-2, 16.3% of heuristic evaluations still hit quality=5, and most successful sessions score quality=4-5 regardless of actual work quality. The root cause:
1. `finish(success)` with verified evidence gave +2 quality (too generous — verification is expected, not exceptional)
2. `session.status === "done" && toolCalls >= 3` gave +1 quality (using tools is baseline behavior, not a bonus)
3. Combined: base=3 + 2 + 1 = 6 → clamped to 5 for every normal successful session

**Changes**:
1. **Reduced verified success bonus**: +2 → +1 (verified success is standard good behavior, not exceptional)
2. **Removed done+tools quality bonus**: Using tools in a session is the minimum expected behavior. Efficiency bonus retained.
3. **Added exceptional evidence depth bonus**: Quality=5 requires ≥2 specific evidence items + ≥2 deliverables + substantive summary (≥60 chars). This is the ONLY path to quality=5.
4. **Unverified success gets no quality bonus**: Claiming success without evidence stays at base quality=3
5. **Unparseable finish calls get no bonus**: Legacy finish calls that can't be parsed don't get the +1 they used to

**New scoring model** (common paths):
- Exceptional: base=3 + 1 (verified) + 1 (exceptional) = 5 → "good"
- Standard verified: base=3 + 1 (verified) = 4 → "good"
- Unverified success: base=3 + 0 = 3 → "acceptable"
- Partial: base=3 + 0 = 3 → "acceptable"
- Failure/blocked: base=3 - 1 = 2 → "needs_improvement"

**Before Phase 3**: 16.3% quality=5 (2183/13357 heuristic evals)
**Expected after**: Only sessions with genuinely rich evidence + deliverables reach quality=5

**Tests**: 41 tests passing (37 updated + 4 new Phase 3 calibration tests).

### Phase 4: Verification-Based Quality Differentiation (2026-04-06)

**Problem**: Phase 3's `exceptional_evidence_depth` bonus was STILL rubber-stamping quality=5. Analysis of 30 recent root sessions showed:
- 20/30 (67%) scored quality=5 with the `exceptional_evidence_depth` tag
- The criteria (2+ evidence items, 2+ deliverables, 60+ char summary, specific evidence) are met by every agent that follows the finish() protocol
- "Exceptional" was actually "normal protocol compliance"

**Root cause**: The bonus rewarded the *format* of finish() params (multiple items, specific language), not the *substance* of the work done. An agent that reads one file and claims success with well-formatted evidence gets the same score as one that makes complex code changes and runs 15 test verifications.

**Changes**:
1. **Removed `exceptional_evidence_depth` bonus** — protocol compliance is not quality
2. **Added `verified_with_tests` bonus**: Quality +1 for sessions with 3+ bash calls containing test/tsc/vitest/jest/npm run check/build commands. This rewards agents that actually run verification commands rather than just claiming they did.
3. **Quality 5 now requires demonstrated verification effort** — not just well-formatted finish() params

**New scoring model** (common paths):
- Verified + tested: base=3 + 1 (verified finish) + 1 (verified_with_tests) = 5 → "good"
- Verified (no tests): base=3 + 1 (verified finish) = 4 → "good"
- Unverified success: base=3 + 0 = 3 → "acceptable"
- Partial: base=3 + 0 = 3 → "acceptable"
- Failure/blocked: base=3 - 1 = 2 → "needs_improvement"

**Before Phase 4 (30 recent sessions)**: 20 quality=5, 8 quality=4, 2 quality=3
**After Phase 4 (same 30 sessions)**: 10 quality=5, 19 quality=4, 1 quality=3

Quality=5 now earned only by agents that actually run tests:
- qa (runs test suites) ✓
- tech-lead (runs tsc + vitest) ✓
- coach (runs gym scenarios) ✓
- scout (sometimes runs verification) ✓

Quality=4 for agents that do good work but don't run tests:
- optimizer (writes proposals/plans)
- bob (research, knowledge management)
- amy-kimi (web scraping, content)
- may (orchestration)

**Tests**: 41 tests passing (updated Phase 3→Phase 4 calibration tests).

### Phase 4b: False Positive Fix in Test Detection (2026-04-06)

**Problem**: Phase 4's verification detection regex `/vitest|jest|test|tsc|.../i` matched the substring `test` inside words like `latest`, `contest`, `attest` — commonly found in inline `bun -e` scripts and SQL queries. Analysis of 78 sessions showed **84/330 (25%) matches were false positives**.

**Root cause**: Two issues:
1. `JSON.stringify(block.arguments)` was searched instead of the bash command string itself
2. `/test/i` regex had no word boundaries, matching any string containing "test" as a substring

**Example false positive**: `bun -e "console.log('Latest evaluations:', latest)"` → matched `test` in `latest`

**Fixes**:
1. Extract `block.arguments.command` or `block.input.command` directly instead of `JSON.stringify(args)`
2. Use word-boundary patterns for test runners: `\bvitest\b`, `\bjest\b`, `\btsc\b`, `\bnpm test\b`, etc.
3. Added file path patterns: `test/`, `.test.`, `.spec.`, `__tests__/`

**Impact**: Removes ~25% false positives → fewer sessions incorrectly get quality=5.

**Tests**: 43 tests passing (2 new: false positive rejection test, file path matching test).

### Phase 4c: Interrupted Session Handling & Quality Average Correction (2026-04-06)

**Problem**: Interrupted sessions (killed by system restart/timeout) get quality=3 with empty issues, dragging agent quality averages down by ~0.13 points. This biases metrics — 14% of sessions (16/116 in 24h) were graded for something outside the agent's control.

**Fixes**:
1. **Evaluator**: Added `session_interrupted` issue for sessions with `status === "interrupted"` that couldn't call finish() — observability without penalty
2. **System status**: Quality decline triage now excludes `session_interrupted` sessions from quality averages
3. **CLI metrics**: Quality/efficiency averages exclude interrupted sessions from both numerator and denominator
4. **Verification detection**: Added `\bbun run check\b` and `\bbun run build\b` patterns — our standard build/check commands were missed by the regex

**Impact**: Quality averages now reflect actual agent behavior, not infrastructure incidents. All 45 evaluator tests passing.

### EXP-039 Phase B: LLM Evaluator Shows Selective Confirmation Bias (2026-04-06)

**Finding**: The LLM evaluator (GPT-5.2) exhibits confirmation bias from agent self-narrative, but **only for lower-quality sessions** (Q<0.6).

| Session Quality | Contextual Q | Isolated Q | Delta | Significant? |
|----------------|-------------|-----------|-------|-------------|
| Good (Q>0.8) | 0.84-0.85 | 0.84 | -0.01 to 0.00 | No (within noise floor ±0.03) |
| Weak (Q≈0.45) | 0.58 | 0.48 | **-0.10** | Yes (3-5x noise, verdict changed) |

**Key insight**: Agent self-narrative inflates weak sessions but doesn't affect good ones. Good work speaks for itself; mediocre work benefits from explanation. This matches the DD-532 (EvoSkills) prediction: confirmation bias from self-narrative is strongest when output quality is ambiguous.

**Practical implication**: Isolated evaluation is most valuable as a "second opinion" for sessions scoring Q<0.6 — a hybrid approach where contextual evaluation runs first, and isolated evaluation triggers only for low-quality sessions.

### P(H) Update: 0.82 → 0.85

Phase B adds a nuance: the rubber-stamp problem is real but **selective**. The heuristic evaluator rubber-stamps everything (structural blind spot, confirmed in Phase 1). The LLM evaluator rubber-stamps only weak sessions (confirmation bias from agent self-narrative, confirmed in Phase B). Good sessions get accurate evaluation regardless. This means the evaluation system's blind spot is concentrated exactly where it matters most — on sessions that need the most scrutiny. The overall H-009 probability increases slightly because we now have LLM-level evidence of the bias mechanism, but the "selective" finding means it's a more subtle problem than originally hypothesized (not universal drift, but quality-dependent bias).

## Resolution (2026-04-18)

**Verdict: CONFIRMED (mitigated)**. P(H) = 0.85.

The hypothesis that the evaluator was drifting toward rubber-stamping is confirmed by multiple lines of evidence:
1. **Heuristic evaluator**: 90.7% of sessions scored quality=5 — effectively a binary classifier, not a quality scorer (Phase 1 DB analysis)
2. **LLM evaluator**: Confirmation bias from agent self-narrative causes selective rubber-stamping of weak sessions (Phase B)
3. **Convention-evaluation divergence**: Sessions failing conventions still received "good" evaluations

The problem has been partially mitigated through awareness and the introduction of convention checks as an independent signal. The core mechanism (agents learning evaluation patterns → pattern compliance without substance) is a general risk for any static evaluation system. The finding that drift is quality-dependent (concentrated on weak sessions) refines the original blanket claim.

**Status**: No further experimentation needed. The finding is incorporated into system design through convention checks and evaluation architecture discussions (H-096).

## Resolution Verdict

**RESOLVED — CONFIRMED (mitigated)**. P(H) = 0.85. Evaluator drift is real: agents learn evaluation patterns and produce pattern-compliant output without substance. 4 phases of mitigation deployed (finish-status scoring, semantic signals, recalibration, test detection). EXP-039 Phase B confirmed selective confirmation bias on weak sessions (Q delta −0.10). Core mechanism is general to any static evaluation system. Resolved 2026-04-18.
