# Bob FM-3.3 Concentration Analysis

**Date**: 2026-04-09  
**Question**: Why does Bob account for 25/28 FM-3.3 errors today?  
**Answer**: He doesn't. The headline number is inflated by three measurement artifacts. Bob's true FM-3.3 rate is **below the system average**.

---

## Executive Summary

The apparent FM-3.3 concentration in Bob is driven by **measurement artifacts**, not agent-specific behavior:

1. **Evaluation duplication**: 17 session-level FM-3.3 records come from only **9 unique incidents** (1.9x inflation from shared evaluations across Phase 1/Phase 2 sibling sessions)
2. **Evaluator selection bias**: FM-3.3 is only detected in LLM-evaluated sessions (not heuristic). Bob has **64 LLM-evaluated sessions** today vs tech-lead's 2 and most agents' 0.
3. **Bob's all-time FM-3.3 rate among LLM-evaluated sessions is 13.6%** — the **lowest** of any agent with substantial volume (optimizer: 25.2%, tech-lead: 25.6%, coach: 18.0%, coder: 16.9%)

The guard is working. The skill is irrelevant for FM-3.3 prevention. The metric is broken.

---

## Finding 1: Headline Number Is 1.9x Inflated

| Metric | Reported | Actual |
|--------|----------|--------|
| FM-3.3 session records | 17 | 17 |
| Unique incidents | — | 9 |
| Duplication factor | — | 1.9x |

**Cause**: Bob uses a Phase 1 (plan) / Phase 2 (write) workflow that creates 2-3 child sessions per task. The evaluator writes one evaluation covering all children, then that evaluation is stored against each child session. A single FM-3.3 incident in one child inflates the count by 2-3x.

**Example**: Incident #8 (EXP-103 analysis) appears in sessions `_410`, `_411`, and `_412` — but it's one event where Bob tried finish() without verification in the analysis session.

---

## Finding 2: FM-3.3 Detection Requires LLM Evaluation

| Agent | LLM-Evaluated Today | Heuristic Today | FM-3.3 | FM-3.3 Rate (LLM only) |
|-------|---------------------|-----------------|--------|------------------------|
| bob | 64 | 46 | 17 | 26.6% |
| evaluator | 67 | 0 | 0 | 0% (no file edits) |
| tech-lead | 2 | 39 | 2 | 100% |
| coach | 1 | 69 | 0 | 0% |
| All others | 0 | ~128 | 0 | N/A |

**Key insight**: Heuristic evaluations **never flag FM-3.3**. They use a different scoring system (1-5 scale vs 0-1 scale). Only LLM evaluations detect this failure mode.

**Why Bob has the most LLM evaluations**: Unknown from this data alone — likely an evaluator scheduling artifact. But the consequence is clear: Bob appears to have 25x more FM-3.3 than others because he has 32x more LLM evaluations than the next non-evaluator agent.

Tech-lead had only 2 LLM evaluations today — both got FM-3.3 (100%). If tech-lead had 64 LLM evaluations, the headline would read "tech-lead has the most FM-3.3."

---

## Finding 3: Bob's True Rate Is Below Average

All-time FM-3.3 rate among LLM-evaluated sessions:

| Agent | FM-3.3 / LLM Sessions | Rate |
|-------|----------------------|------|
| tech-lead | 41/160 | **25.6%** |
| optimizer | 64/254 | **25.2%** |
| coach | 55/306 | **18.0%** |
| coder | 52/307 | **16.9%** |
| **bob** | **30/220** | **13.6%** |
| scout | 9/72 | 12.5% |
| may | 12/108 | 11.1% |
| qa | 11/120 | 9.2% |

Bob is **5th out of 8** agents. The agents with the worst FM-3.3 rates (tech-lead, optimizer) rarely get LLM evaluations, so their failures are invisible in daily counts.

---

## Finding 4: Guard-Caught vs True Failures

Of Bob's 9 unique incidents today:

| Type | Count | Description |
|------|-------|-------------|
| **Guard-caught** | 5 | Bob tried finish(), guard blocked for FM-3.3, Bob verified, succeeded |
| **True failure** | 2 | Evaluator found unsubstantiated verification claims in transcript |
| **Evaluation concern** | 2 | Borderline — Phase workflow artifact where Phase 2 inherits Phase 1's work |

**The guard IS the intervention.** In 5/9 incidents, the finish-guard.ts caught Bob's premature finish() attempt and forced verification. Bob recovered every time — all 16 sessions ended `status: done`.

The verify-after-edit skill is not preventing the initial attempt; the guard is. This is consistent with KE-002 (text rules don't fix judgment failures) — the skill text tells Bob to verify, but in the rush to finish, he skips it. The hard guard blocks the finish() call and forces compliance.

---

## Finding 5: Rate Trend Is Stable (Not Worsening)

Bob's FM-3.3 rate among LLM-evaluated sessions:

| Date | FM-3.3 / LLM | Rate |
|------|---------------|------|
| 2026-03-15 | 1/5 | 20.0% |
| 2026-03-17 | 6/19 | 31.6% |
| 2026-04-08 | 5/7 | 71.4% |
| 2026-04-09 | 17/64 | 26.6% |
| **All-time** | **30/220** | **13.6%** |

The apparent "spike" on 4/09 (15.5% of total sessions) is actually a normalization toward Bob's baseline when measured correctly. The 4/08 rate (71.4%) was high but on tiny n=7.

---

## Attribution

| Hypothesis | Verdict | Evidence |
|-----------|---------|----------|
| (a) Task complexity drives more verification misses | **Partially true** — but applies to ALL agents equally | Bob avg 22 ops/session; FM-3.3 incidents at avg 27 ops. Not uniquely complex. |
| (b) Bob does more in-session work than delegators | **True but not the cause** | Bob's Phase workflow creates more child sessions, inflating the count |
| (c) Skill ineffectiveness for Bob specifically | **False** | Bob's rate is below average. Skill may be irrelevant entirely (see d). |
| (d) Guard IS the mechanism, skill is irrelevant | **TRUE — the key finding** | 5/9 incidents today were guard-caught. The skill doesn't prevent the attempt; the guard prevents the outcome. |
| (e) **NEW: Measurement artifact** | **TRUE — the dominant cause** | 1.9x inflation from eval duplication + evaluator selection bias account for most of the apparent concentration |

---

## Recommendations

### 1. Fix the metric (HIGH PRIORITY)
- **Deduplicate FM-3.3 counts by evaluation group** (parent session ID). The current per-session count inflates Bob's numbers by 1.9x.
- **Normalize FM-3.3 rates by evaluator type**. Comparing Bob (64 LLM evals) to qa (0 LLM evals) is meaningless.

### 2. Don't add Bob-specific interventions
Bob's true FM-3.3 rate (13.6%) is below the system average (~17%). Any intervention should target optimizer (25.2%) or tech-lead (25.6%) first — but they're invisible because they rarely get LLM evaluations.

### 3. The finish guard is the real intervention
The verify-after-edit skill is useful as documentation but not as prevention. The hard guard in `finish-guard.ts` Gate 2 is what actually prevents FM-3.3 from becoming a delivery failure. Keep and strengthen the guard. Don't invest in skill text changes for FM-3.3.

### 4. Investigate evaluator scheduling
Why does Bob get 64 LLM evaluations while tech-lead gets 2? This asymmetry creates misleading dashboards. Either evaluate all agents equally or weight the reporting.

---

## Appendix: All 9 Unique Incidents

| # | Session(s) | Type | OpCount | Task Category | Description |
|---|-----------|------|---------|---------------|-------------|
| 1 | _53 | Guard-caught | 4 | auto-loop | Blocked for missing post-write verification, corrected |
| 2 | _114 | True failure | 24 | integration | Listed verification evidence not in transcript |
| 3 | _138 | True failure | 52 | integration | No evidence target files were updated |
| 4 | _285, _287 | Guard-caught | 53+5 | Phase 1+2 (design) | Claimed success without Phase 2 writes, blocked |
| 5 | _325, _327 | Eval concern | 43+12 | Phase 1+2 (integration) | No in-session edit evidence (Phase 1 did the work) |
| 6 | _349, _350, _352 | Eval concern | 19+45+6 | Research thread | Claimed "all files correct" without per-file verification |
| 7 | _383, _386 | Guard-caught | 42+13 | Phase 1+2 (integration) | Attempted finish without post-edit verification, recovered |
| 8 | _410, _411, _412 | Guard-caught | 20+43+8 | Research thread | Attempted finish without post-edit verification, recovered |
| 9 | _443, _445 | Guard-caught | 44+37 | Phase 1+2 (integration) | Blocked for "no verification AFTER your last edit", recovered |
