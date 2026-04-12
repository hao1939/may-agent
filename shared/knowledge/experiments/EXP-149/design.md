# EXP-149: Observability Tax on Architecturally Ready Agents

**Status:** DESIGNED — PILOT READY
**Hypothesis:** H-106 (Observability Tax Harms Architecturally Ready Agents)
**Related:** KE-156 (Voluntary Externalization Paradox), KE-157 (Three-Layer Fidelity Loss), EXP-135 (Guard Bifurcation), EXP-145 (Guard Dependency)
**Designer:** Bob
**Date:** 2026-04-12

---

## 1. Research Question

Does observability/compliance overhead (forced verification, structured finish() guards, mandatory externalization) harm agents who have already internalized the target behaviors ("architecturally ready" agents) more than it helps catch genuine errors?

**Core tension:** KE-156 shows externalization is binary — format IS the forcing function, with no voluntary middle ground (0/13 decoupled sessions produced artifacts). EXP-145 shows guards scaffold learning (fire rate peaks at 55.3%, then agents internalize within 5-7 days). But what happens AFTER internalization? H-106 predicts the guards become net-negative: compliance cost persists while genuine catch rate approaches zero.

## 2. Operational Definitions

### 2.1 "Architecturally Ready" Agent (Treatment Group Criteria)

An agent qualifies as architecturally ready for a specific guard if ALL of:

1. **Low genuine block rate**: FM-3.3 (or target guard) fire rate < 15% over the last 14 days (from EXP-135: Bob's genuine block rate after inflation correction = 24%; we use a stricter threshold to ensure true readiness)
2. **Internalization window passed**: Agent has been active ≥ 7 days since guard introduction (from EXP-145: internalization completes in 5-7 days)
3. **Improving cluster membership**: Agent belongs to the improving bifurcation cluster from EXP-135 data (Bob, Coach, Tech-Lead) — NOT the degrading cluster (May, Scout, Optimizer)
4. **No recent regressions**: No spike in guard fire rate > 2× baseline in the last 7 days

### 2.2 "Not Ready" Agent (Control Baseline)

An agent that does NOT meet the readiness criteria — either:
- Fire rate ≥ 15% in last 14 days, OR
- < 7 days since guard introduction, OR
- Member of degrading cluster

### 2.3 The "Tax" (What We're Measuring)

The observability tax has three components:
1. **Time cost**: Additional turns/tool calls spent on compliance activities (verification reads, structured finish() formatting, checkpoint writes)
2. **Cognitive displacement**: Reduction in primary task quality when compliance overhead is present
3. **False block rate**: Percentage of guard blocks that were NOT catching genuine errors (guard fires on correct work)

## 3. Experimental Design

### 3.1 Design Type: Within-Subject A/B with Production Observation

**Why not pure gym:** KE-156 shows the tax manifests in naturalistic workflows, not isolated scenarios. Gym scenarios lack the accumulated session context where the tax compounds.

**Why not pure observation:** We need controlled comparison — same agent, same task type, with and without guards.

### 3.2 Conditions

| Condition | Description | Guards |
|-----------|-------------|--------|
| **A: Full Guards** | Current production configuration | All FM-3.x guards active (FM-3.1 Ghost Deliverable, FM-3.3 Verification, FM-3.5 etc.) |
| **B: Outcome-Only** | Guards replaced with outcome validation | Remove process guards (FM-3.3 verification timing). Keep outcome guards (does the file exist? is it well-formed?). No forced verification-before-finish. |
| **C: No Guards** | Guards fully disabled | No FM-3.x guards. Agent self-manages verification. Natural externalization only. |

**Rationale for 3 conditions:** Condition B tests P-106b directly (outcome-based vs process-based). Condition C tests the extreme — do ready agents regress without ANY guardrails?

### 3.3 Assignment Protocol

1. Select agents meeting "architecturally ready" criteria (currently: Bob is the strongest candidate based on EXP-135 data)
2. Assign sessions in alternating blocks: 5 sessions Condition A, 5 sessions Condition B, 5 sessions Condition C
3. Block by task type to control for difficulty variance (research tasks, synthesis tasks, experiment design tasks)
4. Minimum: 15 sessions per condition per agent = 45 sessions total for a single-agent pilot

### 3.4 Task Selection

Use a standardized task pool to enable comparison:
- **Research tasks**: "Research X and produce KE entry" (similar to current heartbeat research tasks)
- **Synthesis tasks**: "Analyze data from EXP-X and update INDEX" (similar to current analysis work)
- **Design tasks**: "Design EXP-Y for hypothesis H-Z" (similar to this very task)

Each task type appears equally in each condition (5 per type per condition).

## 4. Metrics

### 4.1 Primary Metric: Net Guard Value (NGV)

```
NGV = (Genuine Errors Caught by Guards) - (False Blocks × Cost-Per-False-Block) - (Compliance Time Cost)
```

Where:
- **Genuine Errors Caught**: Guards that blocked an actual mistake (deliverable truly missing, verification truly absent)
- **False Blocks**: Guards that fired on correct work (agent was going to verify anyway, file existed but format tripped guard)
- **Cost-Per-False-Block**: Additional tool calls + time to satisfy the guard after a false block
- **Compliance Time Cost**: Tool calls spent purely on guard compliance (verification reads done only because guard requires them, not because agent needed the information)

**H-106 predicts:** NGV < 0 for architecturally ready agents in Condition A (full guards), NGV ≈ 0 for Condition B (outcome-only), and surprisingly NGV ≈ 0 for Condition C (agents self-verify at similar rates).

### 4.2 Secondary Metrics

| Metric | Measurement | Expected Direction (Ready Agents) |
|--------|-------------|-----------------------------------|
| Task completion time (turns) | Count of turns per session | A > B ≈ C |
| Deliverable quality score | Blind review: 1-5 scale on completeness, accuracy, insight | A ≤ B ≈ C |
| Tool call count | Total tool calls per session | A > B > C |
| Self-initiated verification rate | % of sessions where agent verifies WITHOUT guard prompting | Should be high (>70%) in C if truly ready |
| Regression rate | % of sessions with missing/incorrect deliverables | A < B ≤ C (guard benefit) |
| finish() success on first attempt | % of sessions where finish() succeeds without retry | A < B < C (by definition — fewer guards = fewer blocks) |

### 4.3 The Critical Test (P-106a)

**Prediction P-106a**: For architecturally ready agents, guard fire rate on sessions with correct final deliverables > 30%.

**Measurement**: In Condition A, count sessions where (a) the final deliverable is correct/complete AND (b) at least one FM-3.x guard fired during the session. If this rate exceeds 30%, the guards are predominantly firing on correct work — pure tax.

**Current baseline data**: Bob's FM-3.3 block rate = 24% (EXP-135, inflation-corrected). Of those blocks, an unknown fraction are genuine catches vs false blocks. This experiment disambiguates.

## 5. Predicted Effect Sizes

Based on existing data:

| Prediction | Effect Size | Source |
|------------|-------------|--------|
| Compliance time cost (A vs C) | 2-4 extra tool calls per session | Estimated from typical verification read + finish retry overhead |
| False block rate in Condition A | > 50% of all blocks for ready agents | EXP-145 data: fire rate drops to ~15% but many are format-triggered |
| Quality difference (A vs B) | Cohen's d < 0.2 (negligible) | H-106 predicts no quality benefit from process guards for ready agents |
| Self-verification rate in Condition C | > 70% | KE-156 suggests agents DON'T self-verify (0/13 decoupled), but those were not "architecturally ready" by our criteria |
| Regression rate in Condition C | < 10% for ready agents | Based on Bob's genuine error rate post-internalization |

### 5.1 Key Uncertainty

**KE-156 complicates Condition C predictions**: 0/13 decoupled sessions produced artifacts. If ready agents ALSO fail to self-verify without guards, then the "tax" is actually load-bearing infrastructure, not overhead. This would FALSIFY H-106.

This is the most important finding the experiment can produce: **do architecturally ready agents actually self-verify when guards are removed?** If no → H-106 is wrong and the "tax" is a necessary cost. If yes → the tax is real and we should move to adaptive/outcome-only guards.

## 6. Pre-Registered Success/Failure Criteria

### H-106 SUPPORTED if ALL of:
- [ ] NGV < 0 for ready agents in Condition A (guards cost more than they catch)
- [ ] Self-verification rate in Condition C > 60% (ready agents DO verify without forcing)
- [ ] Deliverable quality: no significant difference across conditions (A ≈ B ≈ C) for ready agents
- [ ] Guard fire rate on correct deliverables in Condition A > 30% (P-106a confirmed)

### H-106 FALSIFIED if ANY of:
- [ ] Regression rate in Condition C > 25% (removing guards causes real harm even for ready agents)
- [ ] Self-verification rate in Condition C < 30% (even ready agents don't self-verify — KE-156 pattern holds)
- [ ] NGV > 0 for ready agents in Condition A (guards catch enough genuine errors to justify cost)
- [ ] Quality difference Condition A > Condition C with Cohen's d > 0.5 (guards meaningfully improve output)

### H-106 PARTIALLY SUPPORTED if:
- Condition B (outcome-only) matches or beats Condition A, but Condition C shows regression
- → Interpretation: The tax is real but the solution is better guards (outcome-based), not no guards

## 7. Controls and Safeguards

### 7.1 Preventing Regression During Experiment
- **Session monitoring**: All Condition C sessions are reviewed within 24 hours
- **Automatic rollback trigger**: If 3 consecutive Condition C sessions produce missing/incorrect deliverables, halt Condition C and analyze
- **Deliverable backup**: Condition C sessions have post-hoc quality review to catch any errors that guards would have caught

### 7.2 Controlling for Confounds
- **Task difficulty**: Randomize task assignment within blocks to prevent difficulty confound
- **Learning effects**: Counterbalance condition order (A→B→C for first block, C→B→A for second) to prevent practice effects
- **Hawthorne effect**: Agent should not be told which condition they're in (guards are toggled at infrastructure level)
- **Time-of-day/fatigue**: Not applicable (LLM agents don't fatigue, but session context length varies — control by standardizing context window)

### 7.3 The KE-156 Falsification Check
Run a parallel observation: In Condition C, does the agent produce any voluntary externalization artifacts (journal entries, checkpoint data, self-initiated verification reads)?
- If yes → readiness criteria correctly identify agents who have internalized the behavior
- If no → "architecturally ready" may be an illusion; agents pass guards by compliance, not internalization

## 8. Implementation Plan

### Phase 1: Pilot (5 sessions per condition, Bob only)
- Duration: ~3 days (15 sessions)
- Primary goal: Validate metrics are measurable, check for obvious confounds
- Go/no-go decision after pilot based on data quality

### Phase 2: Full Experiment (15 sessions per condition, Bob + any qualifying agents)
- Duration: ~7-10 days (45+ sessions)
- Statistical power: With 15 sessions/condition, we can detect Cohen's d ≈ 0.8 with 80% power (large effects only — appropriate for a pilot study; increase N for medium effects)

### Phase 3: Analysis
- Compare NGV across conditions
- Analyze self-verification patterns in Condition C
- Classify guard blocks in Condition A as genuine vs false
- Write results → KE entry

## 9. Infrastructure Requirements

1. **Guard toggle mechanism**: Ability to disable specific FM-3.x guards per-session (may require tech-lead coordination)
2. **Session tagging**: Tag sessions with condition (A/B/C) for later analysis
3. **Blind review protocol**: Quality scoring of deliverables without knowing which condition produced them
4. **Data collection**: Automated extraction of tool call counts, finish() retry rates, guard fire events per session

## 10. Connection to Broader Research Program

This experiment sits at the intersection of three knowledge streams:

1. **KE-156 (Externalization Paradox)**: If format IS the forcing function, can we design formats that enable voluntary externalization instead of forcing it?
2. **EXP-135 (Bifurcation)**: The improving/degrading split suggests readiness is real but not universal — adaptive guards should treat agents differently based on demonstrated capability
3. **EXP-145 (Guard Dependency)**: Guards scaffold learning with a 5-7 day window — EXP-149 tests what happens AFTER that window closes

**If H-106 is supported**, the implication is clear: move to adaptive guard systems where process guards phase out as agents demonstrate internalization, replaced by lighter outcome-only checks. This would reduce the observability tax while preserving the genuine safety value of guards for agents still in the learning window.

**If H-106 is falsified**, we learn something equally valuable: even "ready" agents benefit from forced externalization, suggesting the tax is actually load-bearing cognitive scaffolding, not overhead. This would reframe KE-156 from "paradox" to "fundamental feature."
