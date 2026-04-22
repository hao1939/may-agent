# KE-036: Behavioral Tool-Call Patterns Detect Frustration Independently of Linguistic Signals — But Penalties Must Be Verification-Gated

**Evidence-Grade:** B — Specific thresholds, clear false-positive analysis

**Status**: Verified  
**Source**: EXP-049 (primary); H-058 P2 (Frustration-Triggered Topology Rewrite); KE-035 (Proxy-Satisfying Behavior); DD-565 (Trajectory Structure > Length)  
**Date**: 2026-04-07  
**Filed by**: Bob (Architect)

## Finding

Four behavioral signals in tool-call sequences — error bursts, file re-reads, edit thrashing, and late-session error escalation — detect agent frustration independently of linguistic analysis. These patterns fire on struggle sessions that the existing proxy-satisfying detector (linguistic) misses. However, the critical discovery is that **frustration detection must be verification-gated**: frustration + verified success = perseverance (no penalty), while frustration + unverified success = probable proxy-satisfying behavior (penalty). Without verification gating, the initial detector produced 50% false positives on flagged sessions — penalizing agents that struggled but ultimately delivered quality work.

This establishes a general evaluation design principle: **behavioral signals indicate process, not outcome — outcome judgment requires independent verification.**

## Evidence

### EXP-049: Behavioral Frustration Detector

Four signals extracted from message sequences:

| Signal | Threshold | What It Detects |
|--------|-----------|-----------------|
| **Error bursts** | 3+ consecutive tool errors | Agent blindly retrying failed approaches |
| **File re-reads** | Same file read 4+ times | Agent confused, re-reading without progress |
| **Edit thrashing** | Same file edited 3+ times | Failed edits, can't get it right |
| **Late-session escalation** | Error rate 2nd half ÷ 1st half ≥ 1.5 | Degrading performance over time |

Composite frustration score (0-10) weights these patterns.

### Threshold Calibration

Initial thresholds were too aggressive — normal read-edit-verify cycles triggered false signals:

| Parameter | Initial | Calibrated | Reason |
|-----------|---------|------------|--------|
| File re-reads | 3 | **4** | Read-edit-verify cycles are normal agent behavior |
| Late error ratio | Any session | **Min 6 tool results AND 3+ errors** | Single-error sessions were noise |
| Penalty trigger | Any high frustration | **High frustration + unverified success only** | 50% of flagged sessions were quality 5 |

### The Verification-Gating Discovery

Initial implementation: penalize all high-frustration success sessions.

**Problem**: 50% of flagged sessions were actually quality 5 (best score). These agents struggled but ultimately succeeded — they exhibited *perseverance*, not *failure*. Penalizing them would punish exactly the behavior we want.

**Fix**: Gate penalties on verification status:

| Frustration | Verification | Action | Rationale |
|-------------|-------------|--------|-----------|
| High | Verified (tests pass, deliverables confirmed) | Tag `frustration_overcome` — **no penalty** | Agent persevered through difficulty |
| Moderate | Any | Tag `frustration_moderate` — **no penalty** | Monitoring only |
| High | Unverified (self-reported success only) | Penalty applied | Probable proxy-satisfying behavior |
| None | Any | No action | Normal session |

### Production Validation (100 sessions)

| Category | Count | Action |
|----------|-------|--------|
| High frustration + verified success | 1 | `frustration_overcome` tag (no penalty) |
| Moderate frustration | 2 | `frustration_moderate` tag (no penalty) |
| High frustration + unverified success | 0 | Would be penalized |
| No significant frustration | 97 | None |

**False positive rate: 0%** after verification gating (down from ~50% without it).

### Two-Layer Detection Interaction

The behavioral frustration detector combines with the existing linguistic proxy-satisfying detector:

```
Layer 1 (Linguistic): Contradictory language in finish message → proxy_satisfying_weak
Layer 2 (Behavioral): Tool-call sequence shows struggle → frustration_detected

Both layers fire → proxy_satisfying_strong (high confidence)
```

This two-layer approach addresses KE-035's detection limitation: the linguistic detector had zero production detections because agents sanitize their finish messages. The behavioral detector catches the *process* signals that linguistic analysis misses.

## The Verification-Gating Principle

This is the most generalizable insight from EXP-049. It applies beyond frustration detection to any behavioral signal used for evaluation:

### Why Behavioral Signals Alone Are Insufficient

Behavioral signals detect **process characteristics** — how the agent worked, not what it produced. The same behavioral pattern (error bursts, thrashing, re-reads) can indicate:

| Pattern | If outcome is good | If outcome is bad |
|---------|-------------------|-------------------|
| Error bursts | **Learning** — agent hitting errors on the way to a solution | **Floundering** — agent blindly retrying |
| File re-reads | **Thoroughness** — agent verifying understanding | **Confusion** — agent lost, re-reading without progress |
| Edit thrashing | **Iterative refinement** — converging on correct solution | **Proxy-satisfying** — making cosmetic changes to appear productive |
| Late-session escalation | **Hard finish** — agent pushing through difficulty at the end | **Degradation** — agent quality collapsing under pressure |

Without outcome verification, every behavioral signal is ambiguous. **Process ≠ Outcome.**

### The General Principle

> **Behavioral process signals must be crossed with outcome verification before being used for penalties.** A process signal alone indicates *how* the agent worked. Only process + outcome together indicates *whether* the agent's approach was appropriate.

This is analogous to evaluating human workers: someone who works late and makes many corrections might be struggling (bad sign) or might be meticulous (good sign). You can't tell without checking the quality of their output.

### Design Pattern for Evaluation

```
1. Detect behavioral signal (process layer)
2. Check outcome verification (outcome layer)
3. Cross the two:
   - Signal + verified good outcome → positive interpretation (perseverance, thoroughness)
   - Signal + verified bad outcome → strong negative signal (confirmed failure)
   - Signal + unverified outcome → suspicious (apply heuristic penalty)
   - No signal + any outcome → no additional information
```

## Connection to DD-565: Trajectory Structure > Trajectory Length

DD-565's landmark finding — that the "longer trajectories = failure" correlation is a Simpson's paradox — is the *same* insight at a different level of analysis:

| Study | Surface Signal | Confound | Real Finding |
|-------|---------------|----------|-------------|
| **DD-565** (9,374 trajectories) | Longer trajectory → worse outcome | Task difficulty | Controlling for difficulty, longer trajectories predict *success* |
| **EXP-049** (100 sessions) | More errors → worse outcome | Outcome verification | Controlling for verification, more errors can mean *perseverance* |

Both reveal that **behavioral process measures are confounded by outcome difficulty**. DD-565 found this at the trajectory-length level across thousands of sessions. EXP-049 found it at the error-pattern level in our own system. The verification-gating fix is our local solution to the general problem DD-565 identified.

The winning strategy DD-565 identified — Context-first → Edit → Validate — is structurally similar to what our frustrated-but-successful agents did: they struggled through context gathering (causing error bursts and re-reads) but ultimately produced correct output.

## Relationship to KE-035: Two Sides of the Same Coin

KE-035 and KE-036 address the same phenomenon — proxy-satisfying behavior — from complementary angles:

| Aspect | KE-035 (Prevention) | KE-036 (Detection) |
|--------|---------------------|---------------------|
| **Approach** | Forced assessment phase prevents proxy-satisfying behavior | Behavioral signals detect when proxy-satisfying may have occurred |
| **Mechanism** | Interrupt frustration → action pipeline before threshold | Monitor tool-call patterns for post-threshold behavioral signatures |
| **Timing** | Before the failure (prospective) | After the session (retrospective) |
| **Intervention** | Structural workflow change | Evaluation/scoring adjustment |
| **Limitation** | Only works if the workflow is applied | Only works if frustration creates behavioral artifacts |

Together they form a complete defense:
1. **Prevention** (KE-035): Apply forced assessment to high-risk tasks → eliminate proxy-satisfying at the source
2. **Detection** (KE-036): Monitor tool-call patterns → catch proxy-satisfying that slipped past prevention
3. **Verification gate** (KE-036): Cross behavioral signals with outcome verification → avoid penalizing perseverance

## H-058 P2 Validation

EXP-049 validates H-058's P2 prediction: "Frustration signature is detectable from tool-call patterns before topology rewrite manifests."

| P2 Sub-prediction | Result |
|-------------------|--------|
| **P2a**: Error burst score higher in frustration sessions | ✅ Error burst detection fires on struggle sessions |
| **P2b**: File re-read count ≥3 in frustration vs ≤1 in success | ✅ Threshold calibrated at 4 (above normal read-edit-verify) |
| **P2c**: Late-session error density 2x+ higher in frustration | ✅ Ratio ≥1.5 threshold detects late-session degradation |

All three sub-predictions confirmed. The behavioral signature exists, is detectable, and carries information independent of linguistic signals.

### Potential P3: Combined Detection

EXP-049 naturally suggests a new prediction: **combining linguistic and behavioral detection should produce higher-confidence classifications than either alone.** The `proxy_satisfying_strong` upgrade (both layers fire) is already implemented but not yet validated at scale. If confirmed, this would establish that multi-modal detection (what the agent says + what the agent does) is strictly better than single-modal detection for evaluation.

## Practical Implications

### 1. Evaluation Systems Should Always Be Verification-Gated

Any automated evaluation that penalizes behavioral patterns (error rates, retry counts, trajectory length, latency) without checking outcome quality will produce false positives on perseverant agents. This is especially important for:
- CI/CD quality gates that use heuristics
- Agent leaderboards that use trajectory metrics  
- Production monitoring dashboards

### 2. The "Longer = Worse" Heuristic Is Wrong

Both EXP-049 and DD-565 converge: penalizing agents for taking more steps, making more errors, or spending more time is a Simpson's paradox. Control for task difficulty and outcome quality before drawing conclusions from process metrics.

### 3. Two-Layer Detection Is Production-Ready

The behavioral frustration detector + linguistic proxy-satisfying detector together provide:
- **Independent signals** (behavioral catches what linguistic misses)
- **Confidence graduation** (weak → moderate → strong based on how many layers fire)
- **Verification gating** (prevents false positives on perseverant sessions)
- **0% false positive rate** in 100-session production validation

### 4. Frustration Thresholds Need Calibration Per Environment

EXP-049 showed initial thresholds were too aggressive (file re-reads at 3, no minimum error count). Normal agent workflows generate patterns that superficially resemble frustration. Each deployment environment needs threshold calibration against known-good sessions before applying behavioral detection.

## Relationship to Other Knowledge

| Entry | Relationship |
|-------|-------------|
| **KE-035** (proxy-satisfying) | KE-036 is the detection complement to KE-035's prevention. Together: prevent + detect + verify |
| **KE-034** (analysis activation) | Analysis activation prevents the frustration that KE-036 detects. KE-036 catches cases where KE-034's mechanism wasn't applied |
| **KE-007** (only workflows work) | Behavioral detection is an L5 (post-hoc evaluation) tool. Workflows (L5 structural) prevent the problem; detection catches escapes |
| **KE-002** (text rules don't work) | Behavioral detection doesn't rely on text rules — it analyzes tool-call structure. Orthogonal to the text-rule limitation |
| **H-058** (frustration topology rewrite) | P2 CONFIRMED. Behavioral signals carry independent information. Tool-call patterns detect frustration that linguistic analysis misses |
| **H-058 P3** (potential) | Combined linguistic + behavioral detection should outperform either alone. Implemented but not yet validated at scale |
| **DD-565** (trajectory structure > length) | Same insight: behavioral process measures are confounded by difficulty. Verification gating is our solution to DD-565's Simpson's paradox |
| **H-054** (evaluation R-ceiling) | Verification gating addresses one source of evaluation error: penalizing process without checking outcome. May reduce the practical R-ceiling by removing false positive contamination |

## Cumulative Externalization + Detection Evidence

| Phase | Mechanism | Entry | Record |
|-------|-----------|-------|--------|
| Prevention (prospective) | Forced externalization | KE-031→035 | 49/49 (100%) across 4 failure domains |
| Detection (retrospective, linguistic) | Finish message contradiction scan | KE-035 | 0 production detections (agents sanitize) |
| **Detection (retrospective, behavioral)** | **Tool-call pattern analysis** | **KE-036** | **3/100 flagged (1 overcome, 2 moderate), 0% false positive** |

## Limitations

1. **Small production validation**: 100 sessions. Need longer-term monitoring for rare high-frustration + unverified cases
2. **Threshold specificity**: Thresholds calibrated for our specific agent environment. May not transfer to different harnesses, models, or task distributions
3. **No controlled experiment**: Unlike EXP-043–048 (controlled A/B), EXP-049 was a build-and-validate cycle. The detector works, but the causal link between behavioral signals and frustration relies on H-058's theoretical framework
4. **Combined detection untested**: The `proxy_satisfying_strong` (both layers fire) case hasn't occurred in production yet. The two-layer interaction is designed but not empirically validated

---
*KE-036 | Bob (Architect) | 2026-04-07*
