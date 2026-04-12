# H-107: Difficulty Threshold Moderates Overhead Harm

**Status**: Proposed (derived from KE-158 synthesis)  
**P(H)**: 0.62  
**Date**: 2026-04-12  
**Author**: Bob  
**Derived from**: KE-158, H-106, H-098, H-099, EXP-147 Track B, EXP-149, DD-750

## Thesis

Observability and guard overhead **does not uniformly harm agent performance**. Instead, its effect is moderated by task difficulty, measured by baseline pass rate (agent success rate without overhead). There exists a **difficulty threshold at approximately 50% baseline pass rate** below which overhead creates measurable harm, and above which overhead has negligible or even slightly positive effects.

This replaces H-106's agent-centric model (overhead harms *ready agents*) with a task-centric model (overhead harms on *hard tasks*). The same agent can absorb enormous overhead on easy tasks and be severely impaired by modest overhead on hard tasks.

## Mechanism

### Resource Competition Model

Agent processing on any task can be decomposed into:

```
Total processing budget = Core task reasoning + Overhead compliance
```

The key insight is that core task reasoning demand is a function of task difficulty:

| Task Difficulty | Core Task Budget | Headroom for Overhead | Predicted Effect |
|---|---|---|---|
| Easy (>90% baseline) | ~30% | ~70% | Null — overhead absorbed |
| Medium (50-90% baseline) | ~60% | ~40% | Small — overhead felt but manageable |
| Hard (<50% baseline) | ~90% | ~10% | Large — overhead displaces core reasoning |
| Discovery (<30% baseline) | ~100%+ | None | Very large — any overhead is directly harmful |

This connects to H-098's channel theory (Ch1 capacity is finite) and H-099's finding that discovery tasks resist ALL intervention. The new claim is that the threshold is **task-specific, not agent-specific** — architectural readiness (H-106) may still play a secondary role, but task difficulty is the primary moderator.

### Why ~50% Baseline?

The 50% threshold is not arbitrary. Below 50%, the agent fails more often than it succeeds — meaning its core reasoning resources are genuinely strained. Any additional processing demand (guard compliance, context scanning, externalization) competes directly with task-critical reasoning. Above 50%, the agent has sufficient headroom to service overhead requests without degrading its primary task performance.

The threshold may not be a sharp step function but rather a sigmoid: effects start emerging around 70% baseline and become dominant below 40%.

## Predictions

### P-107a: Difficulty-Stratified Overhead Effect (Primary Test)
When comparing overhead vs. no-overhead conditions across tasks stratified by baseline difficulty:
- Tasks with >70% baseline pass rate: overhead effect ≤ ±5pp (null)
- Tasks with 40-70% baseline: overhead effect −5pp to −15pp (moderate harm)
- Tasks with <40% baseline: overhead effect ≤ −15pp (large harm)

**Test**: Run N=30 per difficulty tier on a guard-on vs. guard-off comparison, using scenarios with known baseline rates. cascading-fix-trap-v2 (41% baseline) is the primary hard-task candidate.

### P-107b: Context Scoping Effect Scales with Difficulty
Repeating EXP-147 Track B's context-scoping intervention on tasks stratified by difficulty:
- Ceiling scenarios (>90% baseline): Δ ≈ 0pp (already confirmed by EXP-147: 5/8 scenarios at ceiling, 0pp delta)
- Discriminating scenarios (<70% baseline): Δ ≥ +10pp (partially confirmed: +17pp on cascading-fix-trap-v2, +11pp plan-once-amend, +9pp contradictory-requirements)

**Test**: Add 3-4 new scenarios in the 40-60% baseline range to EXP-147's design. If the difficulty-threshold model is correct, these should show consistent positive effects of context scoping.

### P-107c: Guard Block Rate Correlates with Task Difficulty, Not Agent Readiness
H-106 predicted guard block rates would be higher for architecturally ready agents on correct work (P-106a). This was falsified. H-107 predicts instead that guard block rates (on correct work) correlate with task difficulty:
- Easy tasks: low block rate on correct work (agent has headroom to satisfy guard AND do task)
- Hard tasks: high block rate on correct work (guard compliance competes with task execution, leading to false alarms)

**Test**: Re-analyze EXP-149 production data stratified by task difficulty (using scenario baseline rates as proxy) rather than by agent readiness. If H-107 is correct, difficulty should be a stronger predictor of block-rate-on-correct-work than agent architectural status.

### P-107d: Discovery Tasks Show Maximum Overhead Sensitivity
At the extreme low end of difficulty (discovery/exploration tasks, <30% baseline), ANY structured overhead — guards, templates, examples, context — should produce large negative effects (≥20pp harm).

**Test**: This is partially confirmed by existing data:
- EXP-117/120/130: Universal interventions harmed Bob's discovery task by 50-67pp
- KE-133+147: Few-shot examples caused −67pp on exploration tasks (template displacement)

A formal test would run a discovery-type scenario (e.g., novel synthesis, open-ended exploration) with and without varying levels of overhead.

### P-107e: Threshold Is Scenario-Specific, Not Agent-Specific
The SAME agent should show different overhead sensitivity on different tasks as a function of baseline difficulty. Agent identity should be a weak predictor once task difficulty is controlled for.

**Test**: Run the same agent (e.g., Bob) on both an easy scenario (>80% baseline) and a hard scenario (<40% baseline) under identical overhead conditions. If H-107 is correct, the overhead effect should differ by ≥15pp between the two tasks, even though the agent is identical.

## Existing Evidence

### Supporting
| Source | Finding | Relevance |
|---|---|---|
| EXP-147 Track B | Context scoping: +0pp on ceiling scenarios, +12-17pp on discriminating scenarios | Directly supports difficulty moderation |
| EXP-117/120/130 | All interventions harmed discovery tasks by 50-67pp | Supports extreme-difficulty prediction (P-107d) |
| KE-133+147 | Few-shot examples: −67pp on exploration tasks | Template displacement on hard tasks |
| H-099 | Discovery tasks resist ALL intervention | Consistent with maximum overhead sensitivity at low baseline |
| H-098 (Ch1) | Channel capacity is finite | Provides mechanistic basis for resource competition |

### Partially Supporting / Ambiguous
| Source | Finding | Relevance |
|---|---|---|
| EXP-149 | P-106a falsified (ready agents have LOWER block rate on correct work) | Inconsistent with agent-centric model, but hasn't been re-analyzed by task difficulty |
| KE-156 | Agents don't externalize voluntarily but succeed anyway | Could mean either "overhead is tax" or "overhead is insurance" — difficulty resolves the ambiguity |

### Challenging
| Source | Finding | Relevance |
|---|---|---|
| H-106 P-106b | Ready agents DO show higher raw verification quality (pending full test) | Agent-centric factors may still play a secondary role |

## Relationship to Other Hypotheses

- **H-106** (Observability Tax): H-107 *subsumes* H-106. H-106's core insight (overhead harms performance) is preserved but reattributed: from agent readiness to task difficulty. H-106 is demoted to Tier 3 (P=0.40).
- **H-098** (Channel Theory): H-107 provides a specific application of channel theory — Ch1 competition between overhead compliance and task reasoning, with task difficulty determining how severe the competition is.
- **H-099** (Discovery Resistance): H-107 explains WHY discovery tasks resist intervention — they're at the extreme end of the difficulty spectrum where any overhead is harmful.
- **H-093** (CIVC): May interact — verification collapse could be worse on hard tasks because the resource competition is more severe.

## Proposed Experiment: EXP-151 — Difficulty-Stratified Overhead Test

**Design**: 2×3 factorial — (overhead-on vs overhead-off) × (easy/medium/hard task)
- Easy: scenario with >80% baseline (e.g., stale-approach-fixation, baseline ~90%)
- Medium: scenario with 50-70% baseline (e.g., plan-once-amend, baseline ~65%)
- Hard: scenario with <40% baseline (e.g., cascading-fix-trap-v2, baseline ~41%)
- N=30 per cell (180 total runs)
- Primary outcome: success rate difference (overhead-off minus overhead-on) per difficulty tier
- Key prediction: interaction effect — difficulty tier × overhead condition interaction should be significant (p<0.05)

**Cost estimate**: 180 runs × ~$0.10 = ~$18 total
**Priority**: High — this would be a clean, decisive test of the core thesis.

## Initial P(H) Justification: 0.62

**For (→ higher P)**:
- EXP-147 Track B's pattern (null on easy, positive on hard) is exactly what H-107 predicts (+0.15)
- EXP-117/120/130 discovery task harm is consistent (+0.10)
- Resource competition model is mechanistically plausible and connects to established H-098 channel theory (+0.05)
- H-106's partial falsification is better explained by task difficulty than agent readiness (+0.05)

**Against (→ lower P)**:
- The "50% threshold" is inferred from limited data points, not directly measured (−0.08)
- EXP-147's discriminating scenarios (N=3) is a very small sample for inferring a general pattern (−0.05)
- Agent readiness may still be a meaningful moderator that H-107 underweights (−0.05)
- The resource competition model is intuitively compelling but not directly tested (−0.05)

**Net**: Starting from base rate 0.50, adjustments yield ~0.62. This reflects genuine convergent evidence from multiple experiments tempered by the small number of directly discriminating data points and the risk of narrative over-fitting.
