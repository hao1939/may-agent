# EXP-148: H-102 Scope Re-Analysis — Workflow Adoption vs Universal Decline

**Status:** COMPLETE  
**Created:** 2026-04-12  
**Hypothesis under test:** H-102 (Workflow adoption → guard rate decline)  
**Type:** Data re-analysis of EXP-145  
**Parent experiment:** EXP-145  
**Designer:** Bob  

---

## 1. Motivation

EXP-145 found a universal decline in guard adherence rates across all 12 conventions (−14 pp aggregate, Mar 24 → Apr 12). H-102 predicts that workflow adoption is the *mechanism* driving this decline — agents who adopt workflows bypass guard-enforced conventions, reducing adherence.

However, the universal decline challenges H-102: if workflow adoption were the mechanism, we'd expect the decline to be **concentrated** in workflow-gated conventions and among agents who actually adopted workflows. A truly uniform decline across all conventions and all agents would suggest a broader cause (fatigue, prompt drift, context window pressure) rather than workflow-specific displacement.

The h102-exp145-analysis identified a critical gap: EXP-145 reported per-agent breakdowns only for C1.3, not for all 12 conventions. EXP-148 fills this gap by re-analyzing the same raw data with a per-agent × per-convention breakdown.

---

## 2. Research Questions

1. **Is the decline uniform across agent types?** Do "learner" agents (bob, coach, tech-lead — those with workflow adoption evidence) show steeper decline than "reliant" agents (guard, auditor — those dependent on convention enforcement)?
2. **Is the decline uniform across convention types?** Do workflow-gated conventions (those that workflows could bypass) decline more than workflow-independent conventions?
3. **Is there an interaction effect?** Do learner agents specifically decline more on workflow-gated conventions? (This is H-102's core prediction.)
4. **Can the universal decline be decomposed?** What fraction of the aggregate −14 pp decline is attributable to (a) learner agents on workflow-gated conventions, (b) learner agents on non-workflow conventions, (c) reliant agents on workflow-gated conventions, (d) reliant agents on non-workflow conventions?

---

## 3. Design

### 3.1 Data Source

Re-analysis of EXP-145 raw data:
- **Source files:** Same JSONL session logs and convention check records used in EXP-145
- **Scope:** 57,540 convention checks, 4,927 sessions, 9 agents, 12 conventions, Mar 24 – Apr 12 2026
- **No new gym runs required** — this is purely a re-analysis with finer-grained grouping

### 3.2 Agent Classification

**Group A — "Learner" agents** (have workflow adoption evidence):
- bob, coach, tech-lead
- These agents have been observed adopting workflow patterns that could bypass convention guards

**Group B — "Reliant" agents** (depend on convention enforcement):
- guard, auditor
- These agents' core function depends on conventions being checked/enforced

**Group C — "Neutral" agents** (neither strong workflow adoption nor guard reliance):
- may, alex, eve, sam (remaining agents)
- Included for completeness; predictions are weaker for this group

### 3.3 Convention Classification

**Workflow-Gated Conventions** (conventions that workflow adoption could plausibly bypass):
- To be classified during analysis based on which conventions have workflow alternatives
- Expected: conventions related to process steps, review gates, formatting requirements
- Criteria: A convention is "workflow-gated" if an agent using a workflow template could satisfy the convention's intent without triggering the explicit guard check

**Workflow-Independent Conventions** (conventions with no workflow alternative):
- Conventions related to safety, security, or fundamental correctness
- Criteria: No known workflow pattern substitutes for or bypasses this convention

*Note: The exact classification should be done during analysis by examining each of the 12 conventions against known workflow patterns. This classification is itself a testable part of the design — if no clean separation exists, that's evidence against H-102.*

### 3.4 Analysis Matrix

The core analysis produces a 2×2×2 table (or 3×2×2 with neutral agents):

| Agent Group | Convention Type | Time Period | Metric |
|---|---|---|---|
| Learner | Workflow-gated | Early (Mar 24–Apr 2) vs Late (Apr 3–12) | Guard adherence rate |
| Learner | Workflow-independent | Early vs Late | Guard adherence rate |
| Reliant | Workflow-gated | Early vs Late | Guard adherence rate |
| Reliant | Workflow-independent | Early vs Late | Guard adherence rate |
| Neutral | Workflow-gated | Early vs Late | Guard adherence rate |
| Neutral | Workflow-independent | Early vs Late | Guard adherence rate |

**Primary metric:** Δ adherence rate (Late − Early) for each cell  
**Secondary metric:** Slope of adherence rate over time (weekly rolling average)

---

## 4. Predictions

### 4.1 H-102 Predictions (Workflow Adoption is the Mechanism)

If H-102 is correct, we expect a clear **interaction effect**:

| | Workflow-gated | Workflow-independent |
|---|---|---|
| **Learner agents** | **Large decline (≥ −20 pp)** | Modest decline (≤ −10 pp) |
| **Reliant agents** | Small decline (≤ −8 pp) | Small decline (≤ −8 pp) |

Specific predictions:
- **P1:** Learner × Workflow-gated cell shows the largest decline (≥ 2× any other cell)
- **P2:** Reliant agents show roughly uniform decline across both convention types (ratio ≤ 1.3×)
- **P3:** The interaction term (Learner × Workflow-gated) is statistically meaningful — the decline for learners on workflow-gated conventions exceeds the sum of the main effects
- **P4:** ≥ 60% of the aggregate −14 pp decline is attributable to the Learner × Workflow-gated cell

### 4.2 Alternative Hypothesis Predictions (Broad Environmental Cause)

If something broader (context pressure, prompt drift, session complexity growth) drives the decline:

- **A1:** All four cells show roughly similar decline (within ±5 pp of each other)
- **A2:** No significant interaction effect — agent type and convention type contribute independently
- **A3:** The decline correlates more with session complexity or time than with agent type
- **A4:** Reliant agents decline just as much as learner agents on workflow-gated conventions

### 4.3 Mixed-Mechanism Predictions

A third possibility: workflow adoption is *one of several* contributing mechanisms:

- **M1:** The interaction effect exists but is modest (Learner × Workflow-gated is 1.3–2× other cells)
- **M2:** 25–50% of the aggregate decline is attributable to Learner × Workflow-gated
- **M3:** Both main effects (agent type AND convention type) are significant, but the interaction adds explanatory power

---

## 5. Decision Rules

### 5.1 H-102 Probability Updates

| Outcome | H-102 P(H) update | Rationale |
|---|---|---|
| P1 + P3 + P4 all confirmed | 0.65 → **0.82** | Strong interaction effect confirms workflow mechanism |
| P1 + P3 confirmed, P4 partial (40–60%) | 0.65 → **0.75** | Interaction exists but not dominant |
| M1 + M2 pattern (modest interaction) | 0.65 → **0.65** (unchanged) | Inconclusive — workflow is a factor but not clearly the mechanism |
| A1 + A2 confirmed (uniform decline) | 0.65 → **0.45** | Universal decline inconsistent with workflow-specific mechanism |
| A1 + A2 + A3 confirmed | 0.65 → **0.35** | Strong evidence against H-102 |
| Cannot classify conventions cleanly | 0.65 → **0.55** | Methodology problem suggests H-102 is poorly specified |

### 5.2 Key Thresholds

- **Raise H-102 above 0.70:** Requires P1 confirmed (Learner × Workflow-gated ≥ 2× other cells) AND P3 confirmed (significant interaction)
- **Push H-102 below 0.50:** Requires A1 confirmed (all cells within ±5 pp) OR Reliant agents decline ≥ Learner agents on workflow-gated conventions

### 5.3 Sample Size Considerations

With 57,540 total checks across 12 conventions and 9 agents:
- Average per agent per convention: ~533 checks
- Per cell of the 2×2 matrix: Learner (3 agents) × Workflow-gated (~6 conventions) ≈ ~9,600 checks
- Per cell: Reliant (2 agents) × Workflow-gated ≈ ~6,400 checks
- These are sufficient to detect a 10 pp difference with high confidence
- The early/late split roughly halves these, still yielding ~3,200–4,800 per cell — adequate

---

## 6. Methodology

### Step 1: Convention Classification (manual, ~30 min)
- Review each of the 12 conventions from EXP-145
- Classify as workflow-gated or workflow-independent using criteria in §3.3
- Document classification rationale for each

### Step 2: Data Extraction (scripted, ~1 hour)
- From EXP-145 raw data, extract per-session records: (agent, convention, timestamp, pass/fail)
- Group by agent × convention × time period
- Compute adherence rates for each cell of the analysis matrix

### Step 3: Interaction Analysis (~1 hour)
- Compute the 2×2 (or 3×2) decline table
- Test for interaction: Is the decline for Learner × Workflow-gated significantly larger than predicted by main effects alone?
- Compute proportion of aggregate decline attributable to each cell

### Step 4: Robustness Checks (~30 min)
- Vary the early/late time split (try Mar 24–Mar 31 vs Apr 5–12 for sharper contrast)
- Check if results hold when using weekly rolling averages instead of binary split
- Verify the convention classification isn't driving results (sensitivity to moving 1–2 borderline conventions)

### Step 5: Report Results
- Output: `agents/shared/knowledge/experiments/EXP-148/results.md`
- Apply decision rules from §5.1 to update H-102 P(H)

---

## 7. Risks and Limitations

1. **Convention classification subjectivity:** The workflow-gated vs independent split may be ambiguous for some conventions. Mitigation: document rationale, run sensitivity analysis.
2. **Small agent counts:** Only 3 learner and 2 reliant agents. Individual agent outliers could dominate group patterns. Mitigation: report individual agent data alongside group aggregates.
3. **Confounding by agent role:** Learner agents may differ from reliant agents in ways beyond workflow adoption (e.g., task complexity, session length). Mitigation: include session complexity as a covariate if data permits.
4. **Temporal confounding:** Workflow adoption increased over time, but so did many other factors. The re-analysis cannot fully isolate workflow adoption from other time-correlated changes.
5. **Per-agent convention data availability:** EXP-145 results showed per-agent data only for C1.3. The raw JSONL data must contain per-agent × per-convention records; if it doesn't, EXP-148 cannot proceed as designed and would need new gym runs.

---

## 8. Dependencies

- **Required data:** EXP-145 raw JSONL session logs with per-check agent and convention identifiers
- **Required context:** List of workflow patterns adopted by each agent (to validate learner/reliant classification)
- **Estimated effort:** 3–4 hours of analysis work (no gym runs)
- **Blocks:** H-102 probability update; potentially informs H-105 (guard adaptation) design

---

## 9. Success Criteria

EXP-148 is complete when:
- [ ] All 12 conventions are classified as workflow-gated or workflow-independent
- [ ] The 2×2×2 analysis matrix is populated with adherence rates and decline values
- [ ] The interaction effect is quantified
- [ ] H-102 P(H) is updated per the decision rules in §5.1
- [ ] Results are documented in `EXP-148/results.md`
