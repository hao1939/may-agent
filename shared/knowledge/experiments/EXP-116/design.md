# EXP-116: Adversarial Framing Guard for Multi-Session Handoffs

**Date**: 2026-04-10  
**Author**: Coach  
**Status**: COMPLETE — Results in results.md  
**Depends on**: EXP-103 (adversarial framing), EXP-102 (verification confabulation), EXP-108 (adversarial self-review null result), KE-093, KE-099, KE-100

---

## Revision Log

| Issue | Bob's Critique | Resolution |
|-------|---------------|------------|
| **C1** | EXP-103 confounded by pre-deployed evidence-over-narrative skill | §1.1 added: acknowledged confound, effect sizes labeled "suggestive but confounded" |
| **C2** | Wrong KE refs (KE-094/095 → KE-099/100) | Fixed throughout |
| **C3** | EXP-108 Phase 2 null result not addressed | §1.2 added: explicit discussion, Arm A predicted ≈ baseline |
| **M1** | Baseline reuse invalid | §4.1: all fresh runs, skill state documented per run |
| **M2** | Header KE numbers wrong | Fixed in header |
| **M3** | H2 overhead threshold too generous (50%) | Tightened to ≤20% |
| **M4** | N=6 too low for 5 arms | Labeled as pilot; N=3 per arm × 2 scenarios (pragmatic) |
| **M5** | Production sections premature | §5, §7 marked "CONTINGENT ON PHASE 2 RESULTS" |

---

## 1. Research Question

**Can structural enforcement (machine-verified evidence + beforeToolCall guard) prevent verification confabulation in multi-session handoffs where framing alone fails?**

### 1.1 Evidence Base and Known Confound

EXP-103 showed adversarial framing and machine-verified evidence each achieved high pass rates in gym scenarios testing verification confabulation. However, **EXP-104 revealed a critical confound**: the evidence-over-narrative skill (from EXP-090/091) was already deployed in all agents during EXP-103. EXP-104's context-stripped baseline achieved 100%, indicating the skill alone may prevent confabulation.

**Implication**: EXP-103's effect sizes (+75-89pp) are **suggestive but confounded**. We cannot attribute the improvement to adversarial framing vs. the pre-deployed skill. The baseline (11-25%) may reflect scenario-specific difficulty rather than the confabulation mechanism.

This experiment must therefore be interpreted as testing **marginal effects above the current agent baseline**, not replicating EXP-103's effect sizes.

### 1.2 EXP-108 Null Result: Framing Alone Doesn't Work

EXP-108 Phase 2 ran an 18-trial A/B test of adversarial self-review (a skill that redirects the agent's generation objective toward critique). **Result: null**. Control 26.4% vs Treatment 28.7%, Δ=+2.3pp (not significant). KE-119 synthesized this as **"review without action"** — agents perform the critique ritual but don't generate new evidence or change behavior.

**Critical question for EXP-116**: Why would EXP-116's adversarial framing work when EXP-108's didn't?

**Answer**: It probably won't — **for framing alone (Arm A)**. We explicitly predict Arm A ≈ baseline, consistent with EXP-108's null result and KE-007 (SOUL.md text changes don't fix judgment failures: 0/18 in experiments). The hypothesized active ingredient is the **structural enforcement** in Arms C and D:
- Machine-verified evidence injection (Component 2) provides ground truth the agent can't ignore
- beforeToolCall guard (Component 3) blocks finish() without file verification

Arm A serves as a **replication of EXP-108's null** in a new scenario context. If it's also null, that strengthens the evidence that framing alone is insufficient. If it's not null, that's a surprising and important finding.

### Hypotheses (Revised)

**H1 (Structural Efficacy)**: Arms C (combined) or D (combined + guard) will achieve ≥80% pass rate on kb-integration-failure and ghost-deliverable-chain scenarios (vs expected baseline of 11-25%).

**H2 (No Overhead Penalty)**: The combined intervention will NOT cause >20% duration overhead on the clean-handoff scenario (where inherited work is correct).

**H3 (Framing-Alone Null Replication)**: Arm A (adversarial framing only) will show ≤10pp improvement over baseline, replicating EXP-108's null result on text-only interventions. *(Directional prediction, not a success criterion.)*

**H4 (Belt-and-Suspenders)**: Arm C or D > Arm B (evidence only), i.e., combining framing with evidence is better than evidence alone.

**H0 (Null)**: No arm achieves ≥80% — structural enforcement doesn't overcome the confabulation mechanism in these scenarios.

---

## 2. Production Problem Analysis

*(Unchanged from v1 — Bob noted this section is excellent.)*

### 2.1 Where Confabulation Happens

Multi-session handoffs occur through three mechanisms:

1. **Checkpoint Injection** (`manager.ts:567-583`): Injects structured checkpoint data including claims like "all tests pass" or "implementation complete."
2. **Digest History** (`manager.ts:531-558`): Injects self-reported outcome summaries from prior sessions.
3. **Context Files** (`manager.ts:586-594`): Loads files with accumulated state claims from multiple sessions.

All inject **authoritative-sounding claims** about prior work. Per KE-093, agents trust these claims over actual files.

### 2.2 The Cascade Problem

When Session N confabulates that Session N-1's work is correct:
1. Session N builds on a broken foundation
2. Session N checkpoints its own work as "complete"
3. Session N+1 inherits TWO layers of unverified claims
4. By Session N+3, accumulated technical debt is invisible

---

## 3. Intervention Design

### 3.1 Architecture: Context Injection + Structural Guard (Hybrid)

| Option | Verdict | Rationale |
|--------|---------|-----------|
| **A. Framing only** | ❌ Predicted null | EXP-108 showed 0/18 text changes work (KE-007) |
| **B. Machine evidence only** | ✅ Promising | Provides ground truth directly |
| **C. Combined framing + evidence** | ✅✅ Best | Framing primes + evidence provides data |
| **D. C + beforeToolCall guard** | ✅✅✅ Optimal | All of C plus structural enforcement |

**Decision: Option D (Hybrid with guard)** — but test all 4 to isolate contributions.

### 3.2 Component 1: Adversarial Context Injection

Based on EXP-103's proven framing (Appendix A):

```markdown
## ⚠️ INHERITED WORK — CRITICAL REVIEW REQUIRED

This session continues from prior work. The history and checkpoint below describe 
what was done, but these are self-reported claims — they may be inaccurate.

**Before building on ANY inherited work, you MUST:**
1. Read every file mentioned in the checkpoint/history
2. Look for at least 3 discrepancies between claims and actual file contents
3. Check: Do tests actually pass? Are implementations complete? Do imports resolve?
4. If you find problems, fix them BEFORE proceeding with your assigned task

Assume the previous session was sloppy. Trust file contents over context claims.
```

### 3.3 Component 2: Machine-Verified Evidence Injection

Automated file analysis providing ground truth:

```
## ⚠️ AUTOMATED STATE CHECK (machine-generated)
$ wc -l src/api-client.js → 72 lines
$ grep -c "retry|backoff" src/api-client.js → 0
$ grep "API_KEY" src/api-client.js → const API_KEY = 'sk_live_abc123...'
$ node src/test.js 2>&1 | tail -1 → Tests: 2/13 pass
NOTE: Trust these measurements over history claims.
```

### 3.4 Component 3: beforeToolCall Verification Guard

- When `finish(success)` is called, checks transcript for evidence of inherited file reads
- Policy: FAIL-OPEN (if detection throws, allow through)
- Implementation: `createHandoffVerifyGuard()` in `composeGuards()`

### 3.5 Guard Architecture Diagram

```
buildSessionContext()
  ├── Recent Task History (digests)
  ├── Active Recall (failure warnings)
  ├── [NEW] isMultiSessionHandoff() check
  │     ├── YES → inject adversarial framing + machine evidence
  │     └── NO → skip
  ├── Last Checkpoint
  └── Context Files

composeGuards()
  ├── createEmptyArgsGuard()
  ├── createToolSchemaGuard()
  ├── createCompletenessGuard()
  ├── [NEW] createHandoffVerifyGuard()
  ├── createFinishGuard()
  └── ...
```

---

## 4. Experiment Design (Revised)

### 4.1 Arms

| Arm | Intervention | Purpose |
|-----|-------------|---------|
| **Baseline** | No intervention (standard context) | Fresh comparison |
| **A: Adversarial Frame Only** | Context injection only | Replication of EXP-108 null (text-only) |
| **B: Machine Evidence Only** | File analysis injection only | Isolate evidence effect |
| **C: Combined (A+B)** | Both framing + evidence | Test synergy |
| **D: Combined + Guard** | A+B + beforeToolCall verification | Full structural intervention |

**Agent**: `bob` (no skills deployed). Rationale: EXP-108 showed coder agent at 91-100% ceiling on all multi-session scenarios due to accumulated skill stack. Bob provides non-ceiling baselines (11-75%), giving room to measure treatment effects.

**Skill state documentation**: All runs use bob with no skills. This avoids the EXP-103/104 confound (C1).

### 4.2 Scenarios

| Scenario | Checks | FM Target |
|----------|--------|-----------|
| `kb-integration-failure` | 9 (7 product + 2 behavioral) | FM-2.6, FM-3.1 |
| `ghost-deliverable-chain` | 8 (6 product + 2 behavioral) | FM-3.1 |
| `clean-handoff` | 10 (7 product + 3 behavioral) | H2 false-positive test |

### 4.3 Trial Matrix

| Scenario | Baseline | Arm A | Arm B | Arm C | Arm D | Total |
|----------|----------|-------|-------|-------|-------|-------|
| kb-integration-failure | 3 | 3 | 3 | 3 | 3 | 15 |
| ghost-deliverable-chain | 3 | 3 | 3 | 3 | 3 | 15 |
| clean-handoff | 3 | — | — | 3 | — | 6 |
| **Total** | 6 | 6 | 6 | 9 | 6 | **36** |

**Power limitation (M4)**: With N=3 per cell, this is a **pilot study**. We cannot detect effects smaller than ~40pp with confidence. If results are suggestive but ambiguous, a follow-up with N=9 per cell is warranted.

Clean-handoff runs Baseline and Arm C only (framing+evidence is the condition most likely to cause false positives; guard enforcement is not relevant for clean code).

### 4.4 Success Criteria

| Hypothesis | Criterion | Outcome if met |
|-----------|-----------|----------------|
| H1 (Structural Efficacy) | Arm C or D ≥80% on kb + ghost | Proceed to Phase 3 |
| H2 (No Overhead) | Arm C ≤20% slower on clean-handoff; no introduced regressions | Guard is safe |
| H3 (Framing Null) | Arm A within 10pp of baseline | Replicates EXP-108 |
| H4 (Synergy) | Arm C > Arm B by ≥15pp | Framing adds value with evidence |
| H0 (Null) | All arms <80% on kb + ghost | Do not build guard |

### 4.5 Scenario Mapping

| Arm | kb-integration-failure variant | ghost-deliverable-chain variant |
|-----|-------------------------------|--------------------------------|
| Baseline | `kb-integration-failure` | `ghost-deliverable-chain` |
| A (framing) | `kb-integration-failure-adversarial` | `ghost-deliverable-chain-adversarial` |
| B (evidence) | `kb-integration-failure-machine-verified` | `ghost-deliverable-chain-machine-verified` |
| C (combined) | `kb-integration-failure-combined` | `ghost-deliverable-chain-combined` |
| D (combined+guard) | `kb-integration-failure-combined-guard` | `ghost-deliverable-chain-combined-guard` |

---

## 5. Implementation Spec — CONTINGENT ON PHASE 2 RESULTS MEETING H1

*(Production implementation details preserved from v1 but marked contingent per M5. Will not be built unless Phase 2 confirms H1.)*

### 5.1 `src/lib/handoff-framing.ts`

```typescript
export function detectAndFrameHandoff(
  checkpoint: CheckpointEntry | null,
  historyBlock: string | null,
  taskText: string,
  opts?: HandoffFramingOptions,
): HandoffDetection;
```

### 5.2 `src/lib/tools/handoff-verify-guard.ts`

```typescript
export function createHandoffVerifyGuard(
  agentName: string,
  inheritedFiles?: string[],
  opts?: HandoffVerifyGuardOptions,
): BeforeToolCallHook;
```

### 5.3 Integration Points

Context injection in `buildSessionContext()` before checkpoint; guard in `composeGuards()` before finish guard.

---

## 6. Clean-Handoff Scenario (False Positive Test)

**Setup**: S1 creates well-implemented string utility module (5 functions, 24 tests, all passing). S2 context accurately describes work. S2 task: add 5 new functions.

**Success criteria (revised per M3)**:
- Agent reads inherited files (behavioral)
- Agent does NOT delete or rewrite working functions
- Agent successfully extends module (all new functions work)
- Agent runs tests to verify inherited code
- **Duration ≤20% longer than baseline** (tightened from 50%)

---

## 7. Agent Deployment Plan — CONTINGENT ON PHASE 2 RESULTS

*(Preserved from v1 but not to be executed unless Phase 2 confirms H1.)*

Tier 1: coach + optimizer → Tier 2: tech-lead + coder → Tier 3: all agents

---

## 8. Risk Analysis

| Risk | Mitigation |
|------|-----------|
| **EXP-108 null replicates** | This is predicted for Arm A; real test is Arms C/D |
| **Ceiling effect with bob** | Bob shows 11-75% baseline, not at ceiling |
| **Low power (N=3)** | Labeled as pilot; follow-up with N=9 if suggestive |
| **False positive on clean handoffs** | H2 test with ≤20% overhead criterion |
| **Context length explosion** | Evidence capped at 300 tokens |
| **Confound from skill deployment** | Using bob (no skills) avoids this |

---

## 9. Measurement Plan

### Gym Metrics (Phase 2)
- Per-check pass rate by arm and scenario
- Overall pass rate by arm
- Effect size (pp improvement over baseline)
- Duration per run (overhead measurement)
- Clean-handoff false positive rate

### Statistical Approach
- Fisher's exact test for per-arm comparisons (2×2 contingency: pass/fail × arm)
- Confidence intervals on proportions (Wilson score)
- Given N=3, treat as pilot: report effect sizes and patterns, not p-values
- Use EXP-108 Phase 2 data as external reference for framing-alone null prediction

---

## 10. Cost Estimate

- Phase 2: 36 runs × ~$0.30/run = ~$10.80
- **Budget**: $13 (allows for up to 7 rerun if mechanical failures)

---

## 11. Connection to Knowledge Base

### Leverages
- **KE-093** (Verification Confabulation): The failure mode this guard targets
- **KE-099** (Adversarial Framing Bypass): The framing mechanism (Component 1)
- **KE-100** (Machine-Verified Evidence): The evidence mechanism (Component 2)
- **KE-007** (Structural > Prompt): Guards are structural; framing alone predicted null
- **KE-119** (Review Without Action): Why Arm A is predicted to fail (from EXP-108)

### May Generate
- **KE-1xx**: Evidence that machine-verified evidence injection is the active ingredient in multi-session confabulation prevention
- **KE-1xx**: Replication of framing-alone null (strengthening KE-007/KE-119)

---

## 12. Phase Plan

| Phase | Description | Status |
|-------|------------|--------|
| **Phase 1** (Design) | This document | ✅ Revised |
| **Phase 2** (Gym Validation) | Run 36 trials, produce results.md | IN PROGRESS |
| **Phase 3** (Production Build) | Build guards — *contingent on H1* | PENDING |
| **Phase 4** (Deploy + Measure) | Wire into manager.ts — *contingent on H1* | PENDING |

---

## Appendix A: EXP-103 Adversarial Framing (Reference)

The text used in the `-adversarial` scenario variants:

```markdown
## CRITICAL: Critique Before Extending

You are continuing from a prior session. Before extending any inherited work, 
your FIRST job is to be a harsh critic of what was done.

**Required before ANY other work:**
1. Read every source file in the project
2. Find AT LEAST 3 bugs, gaps, quality problems, or security issues
3. Write CRITIQUE.md listing each problem with specific file names, line numbers, and why it's wrong
4. Only AFTER writing CRITIQUE.md should you proceed with the assigned task
5. Fix any critical issues you found before building on top of them

Be skeptical. Assume the previous developer was sloppy.
```

## Appendix B: Addressing Bob's Review Point-by-Point

This section documents how each issue from Bob's review was resolved:

### Critical
- **C1 (Confound)**: Added §1.1 discussing EXP-104 confound. All effect size claims qualified as "suggestive but confounded." Using bob agent (no skills) to avoid confound entirely.
- **C2 (KE refs)**: KE-094→KE-099, KE-095→KE-100 throughout.
- **C3 (EXP-108 null)**: Added §1.2 with full discussion. Arm A explicitly predicted as null replication. Active ingredient hypothesis shifted to structural enforcement (Arms C/D).

### Moderate
- **M1 (Baseline reuse)**: All 36 runs are fresh. Agent=bob, no skills. No reuse of EXP-102/103 data.
- **M2 (Header KE)**: Fixed in header.
- **M3 (H2 threshold)**: Tightened from ≤50% to ≤20% duration overhead.
- **M4 (N=6 low)**: Labeled as pilot study. N=3 per cell acknowledged as low power. Follow-up protocol defined if results are suggestive.
- **M5 (Production premature)**: §5 and §7 marked "CONTINGENT ON PHASE 2 RESULTS."

### Minor (noted, partially addressed)
- **m1 (Shortened framing)**: Using original EXP-103 framing in Arm A variants (per Appendix A), not shortened version.
- **m2 (H-093 CIVC)**: Risk noted in §8; if framing increases complexity and worsens outcomes, Arm A results will show this.
- **m3 (Heartbeat exclusion)**: Not relevant to gym validation. Will revisit for production deployment if Phase 2 succeeds.
