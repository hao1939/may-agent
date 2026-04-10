# EXP-109: Production Observation Study — Multi-Dimensional Trajectory Analysis

**Status**: DESIGNED
**Date**: 2026-04-10
**Author**: Coach
**Type**: Observational study (production data, retrospective)
**Depends on**: KE-109 (gym-production gap), KE-110 (gym saturation), KE-111 (production evaluation architecture)
**Builds on**: DD-713 (4-pillar assessment), DD-714 (trajectory-aware grading), DD-715 (longitudinal analysis), DD-716 (externalization), CR-327 (5-layer stack)

---

## 1. Research Question

**What is the actual quality distribution of production agent sessions when assessed via multi-dimensional trajectory analysis, and how does this differ from the binary pass/fail picture provided by current evaluation?**

This is the foundational experiment for the post-gym-graduation pivot (KE-110 → KE-111). It transitions Coach from controlled gym experiments to observational production science.

### 1.1 Why This Experiment

The gym hit ceiling at 25/26 scenarios (96%) and all 7 multi-session scenarios at 91-100% (EXP-108). Meanwhile, production failure rates remain 10-14× higher than gym baselines (KE-107/KE-109). The existing evaluation system captures quality and efficiency scores for all sessions — but no one has systematically analyzed what these data reveal about production behavioral patterns.

**Preliminary finding**: An initial query reveals 93.2% of sessions rated "good" still have recorded process issues, and 438 sessions rated "good" or "acceptable" have FM failure codes. This suggests that production "success" masks significant process quality variation — exactly what DD-714 predicted.

### 1.2 What This Experiment Is NOT

- **Not a gym experiment**: No controlled arms, no synthetic scenarios
- **Not scoring new sessions**: Using the 19,062 existing evaluations in may.db
- **Not building new infrastructure**: Analyzing what we already capture
- **Not an intervention study**: Pure observation first, interventions come from findings

---

## 2. Hypotheses

### H1: Hidden Process Pathology (P-111a)
**≥30% of production sessions scored "good" have trajectory-level quality issues** invisible to the binary good/acceptable/needs_improvement verdict. Specifically: FM codes in issues, failure chains present, or efficiency < 0.6 despite quality ≥ 0.7.

- **Preliminary evidence**: Already 93.2% of "good" sessions have non-empty issues lists. But FM-code-bearing passing sessions = 438 total. Needs refinement by severity.

### H2: Behavioral Archetypes (P-111b)
**Production sessions cluster into 3-5 distinguishable behavioral archetypes** based on (quality, efficiency, FM-code-profile, failure-chain-depth, token-usage-pattern). These archetypes differ meaningfully from the gym's binary pass/fail.

### H3: Temporal Drift (Novel)
**Agent quality metrics show statistically significant temporal trends** — either improving (skill deployment effects), degrading (capability drift), or cyclic (task-difficulty variation). Weekly aggregates from existing data can test this.

### H4: Agent-Specific Failure Signatures (Novel)
**Each core agent has a characteristic FM-code distribution** distinct from others, reflecting role-specific failure modes rather than model-level weaknesses. This would mean interventions should be agent-specific, not universal.

### H0: Null
Current evaluation verdicts are well-calibrated — "good" sessions genuinely have minimal process issues, and there are no meaningful patterns beyond what the verdict already captures.

---

## 3. Data Sources

### 3.1 Primary: may.db evaluations table
- **19,062 total evaluations** (4,295 non-heuristic, 14,767 heuristic)
- **Fields**: sessionId, agent, quality, efficiency, productiveCalls, wastedCalls, verdict, issues (JSON array), overall (JSON object), usage (JSON object), failureChains (JSON array), evaluatedByHeuristic, createdAt
- **Date range**: 2026-03-01 through 2026-04-10 (6+ weeks)
- **Core agents**: bob (2,363), may (3,951), coach (2,479), tech-lead (1,897), optimizer (1,555), amy-kimi (990), scout (944), amy (875), qa (725), coder (326)

### 3.2 Secondary: ERROR_LOG.jsonl files
- **1,238 entries** across 10 agents
- **Fields**: timestamp, tool, error (with FM codes), critique, correction, context (session ID)
- **Rich narrative**: Evaluator-written human-readable critiques and corrections

### 3.3 Tertiary: Session metadata
- **1,763 session directories** in .state/sessions/history/
- **meta.json**: agent, task, timestamps, model, cost
- **session.jsonl**: Full conversation transcripts (for deep dives on outliers)

---

## 4. Analysis Protocol

### Phase 1: Descriptive Statistics (Priority: Immediate)

**4.1 Multi-Dimensional Quality Distribution**
```
For each core agent (bob, may, coder, tech-lead, optimizer, scout, qa, coach):
  - Quality score distribution (histogram, quartiles, skewness)
  - Efficiency score distribution
  - Quality × Efficiency scatter (identify quadrants)
  - Verdict distribution (good/acceptable/needs_improvement/skipped)
  - Process issues in "passing" sessions (H1 primary test)
```

**4.2 FM Code Taxonomy Analysis**
```
For each FM code (FM-1.1 through FM-5.4):
  - Frequency across all non-heuristic evaluations
  - Agent-specific frequency (H4 test)
  - Co-occurrence patterns (which FM codes appear together)
  - Severity distribution (FM codes in good vs needs_improvement sessions)
```

**4.3 Token/Cost Efficiency**
```
From usage JSON field:
  - inputTokens, outputTokens, cost, turns distributions
  - Cost-per-quality-point by agent
  - Token usage patterns in high-quality vs low-quality sessions
```

### Phase 2: Temporal Analysis (Priority: High)

**4.4 Weekly Trend Analysis (H3 test)**
```
For each week in the 6-week range:
  - Average quality, efficiency by agent
  - FM code frequency shifts
  - Verdict distribution changes
  - Test for trend significance (Mann-Kendall or linear regression)
```

**4.5 Event-Correlated Analysis**
```
Identify known intervention timestamps:
  - Few-shot pipeline deployment (2026-04-05 approx)
  - Commit guard deployment (2026-04-04 approx)
  - Skill promotions (2026-04-03)
Measure quality/efficiency before vs after each intervention
```

### Phase 3: Behavioral Clustering (Priority: Medium)

**4.6 Feature Extraction**
```
Per non-heuristic session, extract:
  - quality, efficiency (continuous)
  - FM code vector (binary: which FM codes present)
  - failure_chain_depth (from failureChains JSON)
  - cost, turns, tokens (from usage JSON)
  - result_delivered (from overall JSON)
  - verdict_numeric (good=3, acceptable=2, needs_improvement=1)
```

**4.7 Clustering (H2 test)**
```
- K-means with k=3,4,5 on standardized features
- Silhouette analysis to determine optimal k
- Characterize each cluster (name the archetypes)
- Compare cluster distribution gym vs production
```

### Phase 4: Deep Dives (Priority: As-Needed)

**4.8 Outlier Analysis**
```
Identify sessions that are:
  - High quality but low efficiency (good process, wasteful execution)
  - Low quality but high efficiency (fast but wrong)
  - "Good" verdict but high FM code count (hidden pathology — H1 core)
  - Zero-cost sessions (skipped/crashed — what happened?)
Sample 5 from each quadrant for manual transcript review
```

---

## 5. Implementation

### 5.1 Analysis Script: `agents/coach/workspace/exp109-production-analysis.sh`

A shell script using bun + SQL queries against may.db that generates:
1. Summary statistics (Phase 1)
2. Weekly trend tables (Phase 2)
3. Feature matrix CSV for clustering (Phase 3)
4. Outlier session IDs for deep dives (Phase 4)

### 5.2 Output Artifacts

| Artifact | Path | Description |
|----------|------|-------------|
| Summary report | `agents/coach/workspace/exp109-summary-report.md` | Phase 1 results |
| Trend analysis | `agents/coach/workspace/exp109-temporal-trends.md` | Phase 2 results |
| Cluster profiles | `agents/coach/workspace/exp109-behavioral-archetypes.md` | Phase 3 results |
| Deep dive notes | `agents/coach/workspace/exp109-deep-dives.md` | Phase 4 results |
| Full results | `agents/shared/knowledge/experiments/EXP-109/results.md` | Synthesis |

### 5.3 Success Criteria

| Criterion | Threshold | Rationale |
|-----------|-----------|-----------|
| H1 testable | FM-code-bearing "good" sessions quantified | Core question |
| H2 testable | Silhouette score ≥ 0.3 for some k | Meaningful clusters |
| H3 testable | ≥4 weekly data points with N≥20 each | Sufficient temporal resolution |
| H4 testable | FM distributions differ by agent (χ² p < 0.05) | Agent-specific patterns |

---

## 6. Predictions

| ID | Prediction | Testable By | Expected |
|----|-----------|-------------|----------|
| P-111a | ≥30% of "good" sessions have process quality issues | Phase 1 § 4.1 | **Likely confirmed** — preliminary shows 93.2% with issues |
| P-111b | 3-5 behavioral archetypes distinguishable | Phase 3 § 4.7 | Moderate confidence |
| P-111c | Pass^3 < Pass@3 by ≥20pp | Requires multi-trial data (future) | Deferred — single-trial data |
| P-111d | Environment snapshots reveal ≥2 new FM types | Requires new capture (future) | Deferred — infrastructure needed |
| P-109a | FM-3.3 (299 instances) dominates production failures | Phase 1 § 4.2 | High confidence — already see this |
| P-109b | Quality improving over time (skill deployment effects) | Phase 2 § 4.4 | Moderate — W12 spike suggests yes |
| P-109c | Bob and coder have distinct FM profiles | Phase 1 § 4.2 | High confidence |
| P-109d | Token cost correlates weakly with quality (r < 0.3) | Phase 1 § 4.3 | Moderate |

---

## 7. Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Phase 1 | This session | Summary statistics + H1 result |
| Phase 2 | This session | Temporal trends + H3 result |
| Phase 3 | Next session | Clustering + H2 result |
| Phase 4 | As-needed | Deep dives on most interesting findings |
| Synthesis | After Phase 3 | Full results.md + knowledge entry |

---

## 8. Ethical/Methodological Notes

- **Observational bias**: We're analyzing evaluations that were themselves automated — the evaluator agent has its own biases (KE-104). Results should be interpreted as "what our evaluation system captures," not ground truth.
- **Heuristic vs non-heuristic**: 76% of evaluations are heuristic (rule-based). We analyze non-heuristic primarily, heuristic secondarily, and note where they diverge.
- **Survivorship bias**: Sessions that crash before completion may not have evaluations. The 19K evaluations represent sessions that ran long enough to be scored.
- **No intervention confound**: Unlike gym experiments, we can't control for confounding variables (task difficulty, time of day, context length). This is observational science — correlations, not causation.

---

## 9. Connection to Coach's Mission

This experiment transitions Coach from **controlled experimentation** (gym → ceiling) to **observational science** (production → insights). The findings directly inform:

1. **Where to focus interventions**: Which FM codes and which agents need the most help?
2. **Whether deployed mechanisms work**: Do few-shot, commit guard, promoted skills show up in production quality trends?
3. **What the gym missed**: What production failure patterns have no gym analog?
4. **Next experiment design**: EXP-110+ will target the specific failure modes and agents identified here.

This is the first step of KE-111's 5-layer production evaluation architecture: establishing Layer 3 (behavioral pattern detection) and Layer 4 (longitudinal analysis) using existing Layer 1-2 data.
