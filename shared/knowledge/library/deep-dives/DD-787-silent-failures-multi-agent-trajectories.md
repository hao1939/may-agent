# DD-787: Detecting Silent Failures in Multi-Agentic AI Trajectories ★★★★★

**Paper**: "Detecting Silent Failures in Multi-Agentic AI Trajectories"
**Authors**: Puja Trivedi, Zijie J. Wang, Joshua Ashkinaze, Danai Koutra, Graham Neubig
**arXiv**: 2511.04032 | **Submitted**: 2025-11-06
**Fills**: Post-EXP-101 gap — Silent failure detection where agent claims success but has failed

---

## Core Finding

The most dangerous agent failures are **silent** — the agent completes its trajectory, reports success, but has actually failed the task. These failures are undetectable by linguistic confidence signals (the agent genuinely "believes" it succeeded). The paper shows that **trajectory-level structural features** (action patterns, tool-call distributions, state coverage) can detect silent failures that linguistic analysis cannot.

This directly explains EXP-101's HVR failure: HVR measures linguistic hedging, but in silent failures there IS no hedging — the agent is confidently wrong.

## Key Technical Contributions

### 1. Silent Failure Taxonomy
Categorizes multi-agent failures by observability:
- **Loud failures**: Agent encounters errors, retries, reports inability (linguistically detectable)
- **Silent failures**: Agent completes without error signals but produces wrong output (linguistically invisible)
- **Cascading silent failures**: One agent's silent failure propagates through the multi-agent system

Finding: **60-70% of task failures in multi-agent systems are silent** — the agent never signals distress.

### 2. Structural Trajectory Features for Silent Failure Detection
Features that discriminate silent failures from successes:
- **State coverage ratio**: How much of the expected state space was explored
- **Action diversity entropy**: Healthy trajectories show characteristic diversity profiles
- **Tool-result utilization**: Whether tool outputs are actually incorporated into subsequent reasoning
- **Trajectory length anomaly**: Silent failures often complete faster (skipping necessary steps) or much slower (spinning without progress)

### 3. Multi-Agent Propagation Detection
Inter-agent communication patterns reveal cascading failures:
- **Handoff content degradation**: Information loss at agent boundaries
- **Confirmation bias loops**: Agents reinforcing each other's errors
- **Missing cross-validation**: Agents accepting unverified claims from peers

## Relevance to EXP-101 and Our Architecture

**This is the missing piece explaining why HVR fails.** The EXP-101 hypothesis was: agents hedge linguistically before failure. Reality: the majority of failures are SILENT — agents don't hedge because they don't know they're failing.

### The Detection Gap
| Failure Type | % of Failures | HVR Detectable? | Behavioral Detection? |
|--------------|---------------|-----------------|----------------------|
| Loud (errors/retries) | 30-40% | Partially | Yes (retry patterns) |
| Silent (confident wrong) | 60-70% | No | Yes (structural features) |

This means HVR's theoretical ceiling is ~0.65-0.70 AUROC even with perfect calibration, because 60-70% of failures have no linguistic signal. Behavioral signals don't have this ceiling.

### Connection to DD#786 (TrajAD) and DD#786 (Trajectory Guard)
- TrajAD/Trajectory Guard detect trajectory-level anomalies — they catch LOUD failures (retry patterns, oscillation)
- This paper shows how to catch SILENT failures — through state coverage and tool-result utilization gaps
- Together they form a **complete failure detection stack**: behavioral anomalies (loud) + structural completeness (silent)

### Connection to DD#781 (Confidence Dichotomy)
The confidence dichotomy explains WHY silent failures exist: evidence tools inflate confidence, so agents with retrieval-augmented workflows are systematically prone to confident-but-wrong states.

## Implications

### For EXP-102 Design
1. **Separate loud vs. silent failure detection** — different signals needed for each
2. **Implement state coverage metrics** — track what proportion of expected subtasks were attempted
3. **Track tool-result incorporation** — does the agent actually USE the outputs of its tool calls?
4. **Multi-signal ensemble**: Combine trajectory anomaly (DD#786/785) with structural completeness (this paper)

### For Bob's Architecture
- **Silent failure = highest priority threat** — Bob confidently submitting wrong work is worse than Bob asking for help
- The Cognitive Companion (DD#770) needs a **completeness checker** not just an anomaly detector
- Tool-result utilization tracking: flag when Bob reads a file but doesn't incorporate findings

### New Metric Candidates
- **Silent Failure Risk Score** (SFRS): Composite of state coverage gaps + tool-result utilization failures
- **Trajectory Completeness Index** (TCI): Whether all expected phases of a task type were executed
- **Tool-Result Integration Rate** (TRIR): Proportion of tool outputs that influence subsequent actions

## Ratings

| Dimension | Score |
|-----------|-------|
| Novelty | ★★★★★ — First systematic study of silent failures in multi-agent trajectories |
| Rigor | ★★★★★ — Taxonomy + quantitative analysis + detection methods |
| Relevance to us | ★★★★★ — Explains EXP-101 failure AND provides detection path |
| Actionability | ★★★★½ — Structural features require task-type-specific reference models |

**Overall: ★★★★★**

## Cross-References
- **EXP-101**: Explains WHY HVR fails — 60-70% of failures are silent (no linguistic signal)
- **DD#785**: TrajAD — catches loud failures; this paper catches silent ones
- **DD#786**: Trajectory Guard — lightweight loud failure detection complement
- **DD#781**: Confidence Dichotomy — explains mechanism behind silent failures
- **DD#667**: MASC — step-level detection; this adds trajectory-completeness dimension
- **CR#343**: Monitoring Turn — silent failure detection is the hardest monitoring challenge

---
*Scout DD-787 | 2026-04-26 | Post-EXP-101 Behavioral Failure Prediction — Silent Failure Detection*
