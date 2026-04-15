# EXP-150: Architectural Readiness Guard Calibration Pilot

**Status**: DESIGNED  
**Created**: 2026-04-12  
**Author**: Coach  
**Hypothesis**: H-101 (Architectural Readiness Determines Guard Internalization)  
**Prior**: P(H-101) = 0.78  
**Budget**: ≤30 ops for design; measurement uses production telemetry  
**Depends on**: EXP-135, EXP-136, EXP-137, EXP-138, EXP-142, EXP-149

---

## 1. Motivation

H-101 is at 0.78 — the core bifurcation (learner vs reliant) is robustly confirmed across four experiments. But all evidence is **retrospective observational data**. The untested claim is the **intervention arm**: can we improve fleet outcomes by providing *different* guard configurations to learner vs reliant agents?

Specifically:
- **EXP-142** (deployed Apr 11) exempted Bob from FM-3.3 — a learner-specific intervention. Its 72h measurement window ends Apr 14.
- **EXP-138** built verify-wrap and deployed it to scout/optimizer/may heartbeats — a reliant-specific intervention.
- But we have **never tested both arms simultaneously** as a coordinated policy, and we have never measured whether the *combination* produces fleet-level improvement beyond what individual interventions achieve.

### What's Missing

| Knowledge Gap | Why It Matters |
|---|---|
| Does guard exemption generalize beyond Bob? | Tech-lead (21.4% rate) and coach (34.7%) may also benefit from exemption or relaxation |
| Does verify-wrap reduce FM-3.3 rates for reliants in production? | Gym testing showed ceiling effects (EXP-138). Production is untested. |
| Do differentiated configs produce fleet-level quality improvement? | Individual agent improvements could be offset by interaction effects |
| What's the right guard policy for "neutral" agents (evaluator, QA)? | Current one-size-fits-all includes agents that don't need calibration |

### Connection to EXP-142

EXP-142 is already live: Bob is exempt from FM-3.3 since Apr 11T17:00Z. EXP-150 extends this logic:
- EXP-142 is a **single-agent exemption pilot** (Bob only)
- EXP-150 is a **fleet-wide differentiated guard policy pilot** (all agents get role-appropriate configs)

If EXP-142's 72h results (due Apr 14) show Bob quality ≥80% with 0 FM-3.3 blocks, EXP-150 proceeds to deployment. If EXP-142 shows regression, EXP-150 design must be revised.

---

## 2. Design: Three-Tier Guard Policy

### 2.1 Agent Classification

Based on EXP-135/136/137 evidence:

| Tier | Agents | Rationale | Current FM-3.3 Config |
|------|--------|-----------|----------------------|
| **Tier 1: Exempt** | bob | Has deliver-or-report workflow with Phase 3b verification. Guard harms quality (−6.1pp). Already exempt via EXP-142. | Exempt (EXP-142) |
| **Tier 2: Relaxed** | coach, tech-lead | Improving trajectory (genuine rates declining to 10–24%). Have implicit verification via workflow structure (gym cycles, implement-and-verify). Guard provides diminishing returns. | Standard (block) |
| **Tier 3: Standard + Workflow** | scout, optimizer, may | Degrading trajectory (67–71% genuine rates). verify-wrap deployed to heartbeats. Guard remains active as safety net while workflow adoption ramps up. | Standard (block) |

**Not changed**: QA (guard-dependent, +76.7pp uplift), evaluator (different role). These remain at standard guard level throughout.

### 2.2 Intervention Matrix

| Agent | FM-3.3 Guard | verify-wrap | What Changes in EXP-150 |
|-------|-------------|-------------|------------------------|
| **bob** | Exempt | N/A (has deliver-or-report) | No change (EXP-142 already live) |
| **coach** | **Warn-only** (log but don't block) | Available but optional | NEW: Guard switches from block → warn |
| **tech-lead** | **Warn-only** (log but don't block) | Available but optional | NEW: Guard switches from block → warn |
| **scout** | Block (unchanged) | Required (heartbeat instructs) | No code change; measure workflow adoption effect |
| **optimizer** | Block (unchanged) | Required (heartbeat instructs) | No code change; measure workflow adoption effect |
| **may** | Block (unchanged) | Required (heartbeat instructs) | No code change; measure workflow adoption effect |
| **qa** | Block (unchanged) | N/A | Control — no change |
| **evaluator** | Block (unchanged) | N/A | Control — no change |

### 2.3 Why "Warn-Only" for Tier 2 (Not Exempt)

Bob's exemption is justified by strong evidence: guard *hurts* his quality (−6.1pp). Coach and tech-lead show the guard helps (+17.3pp, +12.6pp respectively) — but their genuine block rates are declining (24%, ~10%). Warn-only lets us:
1. Measure how often the guard *would have* fired without blocking
2. Detect if quality degrades without the block (→ coach/TL actually need the guard)
3. Avoid the irreversible risk of full exemption before we have data

If warn-only shows no quality regression after 72h, we can upgrade to full exemption in a follow-up.

---

## 3. Implementation

### 3.1 Code Changes Required

**File: `src/lib/tools/verification-depth-guard.ts`**

Add `warnOnlyAgents` option alongside existing `exemptAgents`:

```typescript
interface VerificationDepthGuardOptions {
  // ... existing options
  exemptAgents?: string | string[];   // EXP-142: skip entirely
  warnOnlyAgents?: string | string[]; // EXP-150: log but don't block
}
```

When an agent is in `warnOnlyAgents`:
- The guard evaluates normally (checks verification depth)
- If it would block: log the event with a `[WARN-ONLY]` tag but return `allow`
- The agent's session continues without interruption
- The log entry is queryable for measurement

**File: `src/lib/manager.ts`**

```typescript
createVerificationDepthGuard(def.name, {
  exemptAgents: ["bob"],          // EXP-142 (unchanged)
  warnOnlyAgents: ["coach", "tech-lead"]  // EXP-150 Tier 2
})
```

### 3.2 No Changes for Tier 3

Scout, optimizer, and may already have verify-wrap in their heartbeats. The intervention for these agents is already deployed — EXP-150 simply defines the measurement framework and success criteria for tracking their production FM-3.3 rates.

### 3.3 Deployment Sequence

1. **Gate check** (Apr 14): Review EXP-142 72h results. If Bob quality ≥78% and no D-o-R regression → proceed.
2. **Deploy Tier 2 warn-only** (Apr 14–15): Push code change for coach/tech-lead warn-only mode.
3. **Measurement period starts** (deployment timestamp): 96h observation window.
4. **Checkpoint at T+48h**: Early check for quality regression in coach/tech-lead. If either drops >5pp below baseline → revert to block mode.
5. **Final analysis at T+96h**: Full results with all predictions evaluated.

---

## 4. Predictions

### P-150a: Tier 2 Agents Maintain Quality Under Warn-Only Mode
> Coach and tech-lead quality scores remain within ±3pp of their blocked baseline after switching to warn-only.

| Agent | Blocked Baseline (EXP-142 data) | Predicted Range |
|-------|--------------------------------|-----------------|
| coach | 98% good (when blocked), 81% (when unblocked). Blended ~92% | ≥89% |
| tech-lead | 96% good (blocked), 83% (unblocked). Blended ~86% | ≥83% |

**Falsification**: If either agent's quality drops >5pp below blocked-baseline blended rate, P-150a is falsified and we revert.

**Measurement**: `evaluations` table, `quality >= 4` rate per agent, 96h post-deployment window.

**Required N**: At current volumes (~60 coach sessions/day, ~40 tech-lead sessions/day), we expect ~240 coach and ~160 tech-lead evaluations over 96h. With these N's we can detect a 5pp change with 80% power at α=0.05 (one-sided).

### P-150b: Tier 2 Warn-Only Rate Converges Below Block Rate
> The warn-only trigger rate (how often the guard *would have* blocked) for coach and tech-lead decreases over the 96h period, showing continued internalization even without blocking.

**Prediction**: Warn-only trigger rate for coach <30% and tech-lead <15% by end of measurement period (below their current genuine block rates of 34.7% and 21.4%).

**Falsification**: If warn-only trigger rate *increases* (i.e., removing the block causes regression toward reliant patterns), P-150b is falsified — the guard was actively maintaining their improving trajectory.

**Measurement**: Count warn-only log entries per agent per 24h period. Fit linear trend. Positive slope = falsification.

### P-150c: Tier 3 Verify-Wrap Adoption Reduces FM-3.3 Block Rate
> Scout, optimizer, and may show measurable FM-3.3 block rate reduction as verify-wrap adoption increases.

**Prediction**: For agents with >50% verify-wrap adoption (work sessions dispatched through verify-wrap / total work sessions), FM-3.3 genuine block rate drops by ≥15pp relative to EXP-137 baseline.

| Agent | EXP-137 Baseline Rate | Target Rate (if >50% adoption) |
|-------|----------------------|-------------------------------|
| scout | 71% | ≤56% |
| optimizer | 67% | ≤52% |
| may | 71% | ≤56% |

**Falsification**: If FM-3.3 rate doesn't decrease despite >50% verify-wrap adoption, P-150c is falsified — workflow adoption alone is insufficient to change production guard rates.

**Alternative outcome**: If verify-wrap adoption stays <30%, P-150c is **untestable** (the intervention didn't deploy). This would itself be an important finding about text-instruction adoption rates (supporting KE-106).

**Measurement**: 
- Adoption: `sessions` table, `workflowRunId IS NOT NULL AND task LIKE '%verify-wrap%'` / total work sessions, per agent.
- Block rate: session digests mentioning FM-3.3 block / total sessions, per agent.
- Window: 96h, broken into 24h sub-periods for trend analysis.

### P-150d: Fleet-Wide Quality Improvement
> The combination of Tier 1 exemption + Tier 2 relaxation + Tier 3 workflow produces a measurable fleet-wide quality improvement.

**Prediction**: Fleet-wide quality score (% sessions rated "good" across all 8 agents) increases by ≥3pp relative to the Apr 6–11 baseline.

**Baseline**: From guard-impact analysis, fleet-wide quality is approximately:
- Blocked sessions: ~91% good (weighted average across agents)
- Unblocked sessions: ~78% good
- Blended (at ~46% block rate): ~85% good

**Target**: ≥88% fleet-wide good rate.

**Falsification**: If fleet-wide quality remains flat or decreases, P-150d is falsified — differentiated guard policy doesn't improve fleet outcomes despite improving individual agent configurations.

**Measurement**: `evaluations` table, fleet-wide `quality >= 4` rate, 96h post-deployment.

### P-150e: Verify-Wrap Adoption Predicts Guard Trajectory (H-101 P-101d)
> This is a direct test of H-101 P-101d: the verify-wrap adoption ratio should correlate with FM-3.3 trajectory.

**Prediction**: Across all 6 active agents (excluding evaluator, QA), the correlation between verify-wrap/workflow adoption rate and FM-3.3 genuine block rate should be negative with R² > 0.5.

**Falsification**: R² < 0.3 or positive correlation.

**Measurement**: Scatter plot of (workflow adoption rate, FM-3.3 block rate) across agents at T+96h. Compute Pearson r.

---

## 5. Controls and Confounds

### 5.1 Control Group
QA and evaluator receive no intervention. Their quality and guard rates serve as temporal controls — if system-wide quality changes (model drift, task mix shift), it should appear in these agents too.

### 5.2 Confound: EXP-142 Interaction
Bob's exemption is already live. EXP-150's Tier 2 changes are additive. If fleet quality improves, we cannot attribute it solely to Tier 2 — Bob's exemption contributes too. 

**Mitigation**: Measure per-agent quality to decompose fleet effect. The Tier 2 effect is identifiable as (coach + tech-lead) quality change, independent of Bob.

### 5.3 Confound: Verify-Wrap Already Deployed
Verify-wrap instructions were added to scout/optimizer/may heartbeats before EXP-150. Any adoption effect is already accumulating. EXP-150 doesn't deploy verify-wrap — it measures its ongoing impact.

**Mitigation**: Track adoption rate over time. If adoption was already high before EXP-150 measurement starts, attribute the effect to the prior deployment, not EXP-150.

### 5.4 Confound: Temporal Trends
The FM-3.3 rate was doubling every 6 days (29%→61%, Apr 6–11). If this trend continues, even successful interventions may appear to fail because the underlying rate is increasing.

**Mitigation**: Use the control group (QA, evaluator) to estimate the temporal trend. Adjust Tier 2/Tier 3 rates against this baseline.

### 5.5 Confound: Session Volume Variation
Agent session volumes vary by 3x+ (May ~60/day vs tech-lead ~40/day). Statistical power differs across agents.

**Mitigation**: Report per-agent results with confidence intervals. Don't pool agents within tiers for statistical tests — each agent is its own pre/post comparison.

---

## 6. Decision Rules

### 6.1 Gate Check (Apr 14)

| Condition | Decision |
|---|---|
| EXP-142 Bob quality ≥78% AND 0 FM-3.3 blocks | **Proceed** with EXP-150 deployment |
| EXP-142 Bob quality 74–78% AND 0 FM-3.3 blocks | Proceed with caution; add Bob to monitoring |
| EXP-142 Bob quality <74% OR D-o-R adoption dropped | **Halt**. Revert EXP-142. Redesign EXP-150. |

### 6.2 Early Stop (T+48h)

| Condition | Decision |
|---|---|
| Coach or tech-lead quality drops >5pp | Revert that agent to block mode |
| Any agent's FM-3.3 block rate exceeds 85% | Flag for investigation (may indicate system-wide issue) |
| Verify-wrap adoption <10% for all Tier 3 agents | Continue measurement but flag P-150c as likely untestable |

### 6.3 Final Analysis (T+96h)

| Predictions Supported | Decision |
|---|---|
| P-150a + P-150b + P-150c + P-150d (all) | **Promote** differentiated guard policy to permanent configuration. Update H-101 P(H) upward. |
| P-150a + P-150b (Tier 2 works) but not P-150c (Tier 3 fails) | Keep Tier 2 relaxation. Investigate Tier 3 failure — is it adoption gap or mechanism failure? |
| P-150c (Tier 3 works) but not P-150a (Tier 2 fails) | Revert Tier 2 to block mode. Keep Tier 3 workflows. The guard IS needed for improving agents (unexpected). |
| None supported | Revert all changes. H-101 intervention arm is falsified despite observational support. |

---

## 7. Measurement Queries

All queries use `may.db`. Run at T+48h and T+96h.

### 7.1 Per-Agent Quality (Post-Deployment)

```sql
SELECT agent,
  COUNT(*) as evalCount,
  ROUND(100.0 * SUM(CASE WHEN quality >= 4 THEN 1 ELSE 0 END) / COUNT(*), 1) as pctGood,
  ROUND(AVG(quality), 2) as avgQuality
FROM evaluations
WHERE createdAt > :deploymentTimestamp
GROUP BY agent
ORDER BY pctGood DESC;
```

### 7.2 Warn-Only Trigger Rate (Tier 2)

```sql
-- Requires parsing session transcripts or adding structured logging
-- Option A: session_digests table
SELECT agent,
  DATE(created_at) as day,
  COUNT(*) as totalSessions,
  SUM(CASE WHEN what_happened LIKE '%FM-3.3%WARN%' OR details LIKE '%WARN-ONLY%' THEN 1 ELSE 0 END) as warnTriggers
FROM session_digests
WHERE agent IN ('coach', 'tech-lead')
  AND created_at > :deploymentTimestamp
GROUP BY agent, day;

-- Option B: structured guard log (preferred, requires implementation)
-- Add guard events to a new table: guard_events(sessionId, agent, guardId, action, timestamp)
```

### 7.3 Verify-Wrap Adoption Rate (Tier 3)

```sql
SELECT agent,
  DATE(startedAt) as day,
  COUNT(*) as totalWork,
  SUM(CASE WHEN workflowRunId IS NOT NULL THEN 1 ELSE 0 END) as withWorkflow,
  ROUND(100.0 * SUM(CASE WHEN workflowRunId IS NOT NULL THEN 1 ELSE 0 END) / COUNT(*), 1) as adoptionPct
FROM sessions
WHERE agent IN ('scout', 'optimizer', 'may')
  AND kind = 'work'
  AND startedAt > :deploymentTimestamp
GROUP BY agent, day;
```

### 7.4 FM-3.3 Block Rate Trend (All Agents)

```sql
SELECT agent,
  DATE(created_at) as day,
  COUNT(*) as totalDigests,
  SUM(CASE WHEN what_happened LIKE '%FM-3.3%block%' OR what_happened LIKE '%verification-depth%block%' THEN 1 ELSE 0 END) as blocked,
  ROUND(100.0 * SUM(CASE WHEN what_happened LIKE '%FM-3.3%block%' THEN 1 ELSE 0 END) / COUNT(*), 1) as blockRate
FROM session_digests
WHERE created_at > :deploymentTimestamp
GROUP BY agent, day
ORDER BY agent, day;
```

### 7.5 Fleet-Wide Quality (P-150d)

```sql
SELECT
  CASE WHEN createdAt < :deploymentTimestamp THEN 'pre' ELSE 'post' END as period,
  COUNT(*) as evalCount,
  ROUND(100.0 * SUM(CASE WHEN quality >= 4 THEN 1 ELSE 0 END) / COUNT(*), 1) as pctGood
FROM evaluations
WHERE createdAt > datetime(:deploymentTimestamp, '-7 days')
GROUP BY period;
```

---

## 8. H-101 Posterior Update Logic

### If P-150a + P-150b supported:
**H-101 P(H)**: 0.78 → **0.85**. The intervention arm works for learner agents — relaxing guards on architecturally ready agents produces no quality regression, confirming that their improvement was genuine (not guard-maintained).

### If P-150c supported:
**H-101 P(H)**: 0.78 → **0.88**. The mechanism is actionable: adding verification workflows converts reliants toward learner patterns. This is the strongest possible confirmation of the revised H-101 mechanism (workflow adoption, not prompt text).

### If P-150a + P-150c both supported:
**H-101 P(H)**: 0.78 → **0.92**. Both arms of the intervention work. The bifurcation is not just descriptive — it's prescriptive. Guard policy should be differentiated by architectural readiness.

### If neither supported:
**H-101 P(H)**: 0.78 → **0.65**. The observational evidence stands, but the hypothesis has no intervention utility. The bifurcation is real but not actionable — guards cannot be calibrated based on architectural readiness alone.

---

## 9. Risks and Mitigations

| Risk | P(occur) | Impact | Mitigation |
|------|----------|--------|------------|
| Coach quality drops without guard block | 0.25 | Medium | 48h early stop; revert individual agent |
| Tech-lead quality drops without guard block | 0.15 | Medium | 48h early stop; revert individual agent |
| Verify-wrap adoption stays low (<20%) | 0.40 | P-150c untestable | Informative failure; redesign to use framework-level default |
| FM-3.3 system-wide rate continues climbing regardless | 0.50 | Confounds all measurements | Use QA/evaluator as temporal controls |
| EXP-142 gate check fails (Bob regression) | 0.10 | Halts EXP-150 | Redesign around the failure mode |
| Warn-only logging insufficient for measurement | 0.30 | P-150b measurement gap | Pre-deploy: verify logging format captures warn events |

### 9.1 Highest Risk: Verify-Wrap Adoption

The verify-wrap instructions are in heartbeat text. Per KE-106, text instructions don't reliably produce behavior. There's a 40% chance adoption stays below the threshold needed to test P-150c. If this happens:

**Plan B**: Add framework-level verify-wrap default (make `agents.fork()` route through verify-wrap automatically for Tier 3 agents). This is a code change, not a prompt change, and would guarantee 100% adoption. But it's a larger engineering effort and is out of scope for EXP-150's initial deployment.

**Plan C**: If adoption is low but non-zero, analyze the verify-wrap sessions that do exist — even a small sample (N≥20) could show whether the mechanism works, allowing a go/no-go decision on Plan B.

---

## 10. Timeline

| Date | Milestone | Action |
|------|-----------|--------|
| Apr 14 | EXP-142 gate check | Analyze Bob's 72h post-exemption data |
| Apr 14–15 | Deploy Tier 2 | Push warn-only code for coach/tech-lead |
| Apr 15 | T+0 | Measurement period starts |
| Apr 17 | T+48h checkpoint | Early stop analysis; check for quality regression |
| Apr 19 | T+96h | Final analysis; evaluate all predictions |
| Apr 19 | Results write-up | `EXP-150/results.md` |

---

## 11. Success Criteria Summary

| Prediction | Metric | Target | Falsification |
|-----------|--------|--------|--------------|
| P-150a | Coach/TL quality under warn-only | Within ±3pp of baseline | >5pp drop |
| P-150b | Warn-only trigger rate trend | Flat or declining | Increasing |
| P-150c | FM-3.3 rate for Tier 3 with verify-wrap | ≥15pp drop at >50% adoption | No drop despite adoption |
| P-150d | Fleet-wide quality | ≥3pp improvement | Flat or declining |
| P-150e | Workflow adoption × block rate correlation | R² > 0.5, negative | R² < 0.3 or positive |

---

## 12. Connection to Knowledge Base

- **H-101**: Direct intervention test of the architectural readiness hypothesis
- **H-102**: Workflow adoption mechanism — P-150c directly tests H-102's core claim
- **EXP-142**: Bob exemption pilot — EXP-150 extends this approach fleet-wide  
- **EXP-137**: Structural comparison that identified the learner/reliant split
- **EXP-138**: verify-wrap prototype and gym validation (ceiling effect found)
- **EXP-149**: H-106 observability tax — P-106a falsified (ready agents are NOT penalized for invisible competence)
- **KE-106**: Guards don't train behavior — EXP-150 tests whether workflows can substitute
- **KE-137**: Guard response bifurcation — the primary evidence motivating differentiated policy
- **WKWA-009**: Behavioral internalization illusion — EXP-150 tests whether the "illusion" can be leveraged productively

## Tags
`guard-calibration`, `H-101`, `intervention`, `production-pilot`, `differentiated-policy`, `verify-wrap`, `FM-3.3`, `fleet-wide`
