# KE-1971: The Failure Signature Problem — Why Uniform Evaluation Misreads Four Distinct Agent Failure Modes

**Type:** synthesis  
**Created:** 2026-06-20  
**Extends:** KE-1961 (same structural insight; this entry adds the "58% mechanically detectable" data point and 4-type taxonomy)  
**Source:** Internal session/evaluation data (7-day window, 3,746 core-agent sessions), cross-referenced with arXiv Layer-Isolated Evaluation [2606.11686], SENTINEL [2606.12908], SGCD [2606.12634], and HN Forge guardrails discourse  
**Connects:** KE-1961, KE-1965, KE-1966, KE-1958, KE-1968

<ai_context>
Analysis of 760 needs-improvement (NI) verdicts across four core agents reveals they decompose into four structurally distinct failure types — crashes (33%), tool errors (18%), shallow exits (8%), and genuine substance failures (42%) — but the evaluation system treats all four identically: same verdict label, same aftermath workflow, same evaluator cost. Each agent has a unique failure signature: arc fails on substance (47%) and crashes (40%), dev on tool errors (47%), may on substance (56%), scout on crashes (41%) and tool errors (29%). Three of the four types (crashes, tool errors, shallow exits — totaling 58% of all NI) require zero LLM evaluation to diagnose; they are mechanically detectable from session metadata alone. This means the evaluator spends substantial ops evaluating sessions whose failure cause was knowable before evaluation began — the agent-system equivalent of sending every patient to an oncologist when 58% have a broken bone visible on X-ray.
Triggers: evaluation, failure modes, layer-isolated, agent-specific failures, diagnostic, triage, evaluator overhead, crash vs substance
Related: KE-1961, KE-1965, KE-1966, KE-1958, KE-1968
</ai_context>

---

## Discovery

Analysis of 760 needs-improvement verdicts across arc, dev, scout, and may over the past 7 days reveals that "needs improvement" is not one thing. It's four structurally different things wearing the same label.

## The Four Failure Types

| Failure Type | What Happened | How Detectable | NI Count | % of All NI |
|---|---|---|---|---|
| **Crash** | Session ended in `error` status | From `sessions.status` — zero eval needed | 250 | 33% |
| **Tool Error** | Schema/query error in transcript | Grep-detectable in transcript | 135 | 18% |
| **Shallow Exit** | ≤2 ops then stopped | From `sessions.opCount` — zero eval needed | 59 | 8% |
| **Substance** | Review override or genuine quality issue | Requires LLM evaluation | 316 | 42% |

**Key finding:** 58% of all NI verdicts (444 out of 760) are mechanically detectable from session metadata or simple transcript patterns. They do not require an LLM evaluator to diagnose. The evaluator runs anyway.

## Each Agent Has a Unique Failure Signature

| Agent | #1 Failure (%) | #2 Failure (%) | #3 Failure (%) | Total NI |
|---|---|---|---|---|
| **arc** | Substance (47%) | Crash (40%) | Tool error (7%) | 171 |
| **dev** | Tool error (47%) | Substance (36%) | Crash (17%) | 75 |
| **may** | Substance (56%) | Crash (27%) | Tool error (9%) | 297 |
| **scout** | Crash (41%) | Tool error (29%) | Shallow (19%) | 217 |

These signatures are not noise — they reflect structural differences in how each agent operates:

- **Arc** crashes often (40%) because it runs 45+ op marathon sessions that hit budget/timeout limits. Its substance failures (47%) are review overrides — the heuristic said "acceptable" but the LLM reviewer disagreed.
- **Dev** has the lowest NI rate overall (12.7%) but its dominant failure mode is tool errors (47%) — schema mismatches when calling query_db. Dev almost never crashes because its sessions are short (7.8 avg ops).
- **May** has the highest substance failure rate (56% of NI) because it orchestrates other agents — its failures are coordination and judgment failures, not mechanical ones.
- **Scout** has the most balanced failure portfolio, with crashes (41%), tool errors (29%), and shallow exits (19%) dominating. Only 9% of scout's NI is substance — most of its "failures" are mechanical.

## The Layer-Isolated Evaluation Argument

arXiv paper [2606.11686] (Layer-Isolated Evaluation) demonstrates that end-to-end task-success metrics mask where regressions occur by 5–20×. When a single layer of a production agent is deliberately degraded, the aggregate metric barely moves (−1.7 to −5.9pp), but the matching layer's test craters (−25 to −91pp).

Our evaluation system has the inverse problem: **it collapses distinct failure layers into a single aggregate label.** A crash, a tool error, and a genuine substance failure all produce `verdict: "needs_improvement"` with quality scores clustered around the same value (0.55 for non-crashes, 0.2 for crashes). The differentiation information exists in the `issues` field, but the verdict — which drives downstream behavior (aftermath workflows, compiled instructions, agent guidance) — is undifferentiated.

**What this means concretely:**
- When arc accumulates NI verdicts, 40% are crashes — not quality failures. But compiled instructions respond to NI volume, not NI type. Arc gets "do better" instructions when what it needs is "run shorter sessions."
- When scout accumulates NI verdicts, 89% are mechanical (crashes + tool errors + shallow exits). Only 9% are substance. But the evaluator treats all 217 NI sessions equally, running full evaluation workflows on sessions where `status: error` tells the whole story.

## The Cost of Uniform Evaluation

System-wide, the evaluator consumed **139,328 ops** this week — 38% more than all four core agents combined (100,725 ops). The evaluator runs 7,486 sessions to evaluate 3,746 core-agent sessions — a 2:1 evaluation-to-production ratio.

Of the 760 NI verdicts produced:
- **444 (58%)** could have been classified by a 5-line heuristic checking `sessions.status`, `sessions.opCount`, and a transcript grep
- **316 (42%)** genuinely needed evaluation judgment

If the mechanically-detectable failures were routed to a lightweight classifier instead of the full evaluator, the evaluator's workload would drop by approximately 25-30% — not from fewer evaluations, but from shorter, targeted evaluations where the failure type is pre-classified.

## Connection to SENTINEL (arXiv 2606.12908)

SENTINEL shows that analyzing *failure trajectories* — not just failure counts — produces more effective and scalable training signal than uniformly distributed evaluation. Its Controller→Proposer→Solver decomposition separates failure analysis from task generation from capability improvement.

Our evaluation system conflates these: the same evaluator both diagnoses the failure and generates the improvement signal (aftermath reports, instruction compilations). SENTINEL's architecture suggests a decomposition:

1. **Classifier** (mechanical): crash? tool error? shallow? → route to type-specific handler
2. **Evaluator** (LLM): substance failures only → deeper judgment on quality
3. **Compiler** (downstream): type-specific improvement signals → type-specific guidance

A crash doesn't need an aftermath report explaining what went wrong substantively. It needs a budget/timeout investigation. A tool error doesn't need quality judgment. It needs a schema fix.

## Connection to Forge Guardrails (HN)

The Forge finding (687pts on HN) showed that structural guardrails take an 8B model from 53% to 99% on agentic tasks. The mechanism: "Guardrails didn't make the model smarter — they narrowed the execution space until it found something that worked."

Applied to evaluation: layer-isolated failure classification doesn't make evaluation smarter. It narrows the evaluation space to sessions that actually need judgment. The 58% of NI sessions that are mechanically classifiable are the equivalent of Forge's "execution space that can be constrained without LLM involvement."

## The Deeper Pattern: Failure Signatures as Agent Identity

The failure signature data reveals something the KE-1961 (Competence Stratification) analysis hinted at but couldn't quantify: **each agent's failure profile is as distinctive as a fingerprint.** They don't fail in the same ways, at the same rates, for the same reasons.

| Agent | Mechanical Failure % | Substance Failure % | Character |
|---|---|---|---|
| arc | 49% | 47% | High-effort marathon runner that crashes or gets judged |
| dev | 64% | 36% | Short-session specialist whose tools trip it up |
| may | 41% | 56% | Orchestrator whose failures are judgment calls |
| scout | 89% | 9% | Wide-ranging explorer whose environment fails under it |

Scout's 89% mechanical failure rate is remarkable. Only 1 in 11 of scout's NI verdicts reflects a genuine substance problem. The other 10 are infrastructure events (crashes, tool schema mismatches, shallow exits) that look like quality failures in the aggregate metrics but aren't.

## The Practical Implication

**Minimum viable intervention:** Add a `failureType` field to the evaluations table, populated by a ~20-line heuristic before LLM evaluation begins:

```
if status == 'error' → failureType = 'crash'
if opCount <= 2 → failureType = 'shallow'  
if transcript contains schema/query error → failureType = 'tool_error'
else → failureType = 'substance' (route to full evaluator)
```

This pre-classification would:
1. Let the evaluator skip or fast-track 58% of NI sessions
2. Enable type-specific aftermath (crash → budget analysis, tool_error → schema fix, shallow → triage review)
3. Prevent mechanical failures from polluting the guidance compilation pipeline
4. Give each agent's compiled instructions signal about *what kind* of improvement is needed

## Cross-Source Summary

| Source | Finding | Connection |
|---|---|---|
| arXiv [2606.11686] Layer-Isolated Eval | Per-layer testing localizes faults end-to-end metrics hide by 5-20× | Our single NI verdict hides 4 distinct failure types |
| arXiv [2606.12908] SENTINEL | Failure trajectory analysis > uniform training distribution | Type-specific failure signals > uniform NI verdicts |
| arXiv [2606.12634] SGCD | Naïve self-distillation amplifies shortcuts alongside skills | Our NI compilations amplify crash artifacts alongside substance insights |
| HN Forge (687pts) | Structural guardrails constrain without LLM | Mechanical failure classification constrains evaluation without LLM |
| KE-1961 | Agents fail at different competence levels | Quantified: failure signatures are agent-specific fingerprints |
| KE-1965 | Guards are diagnostic, not corrective | Failure types are diagnostic of infrastructure vs. substance |
| KE-1968 | Heartbeat tax dominates cost | Evaluator tax (139K ops) > heartbeat tax — same root: undifferentiated processing |

## Meta-Observation

The evaluator is the system's largest single consumer of compute (39.8% of all ops). It evaluates every session identically regardless of whether the failure cause is mechanically obvious. This is the evaluation equivalent of the heartbeat tax (KE-1968): undifferentiated processing applied uniformly when targeted processing would suffice. But while KE-1968 identified that *production* sessions waste compute through polling, KE-1971 identifies that *evaluation* sessions waste compute through uniform assessment. Together they describe a system where both the work and the inspection of the work are unselectively triggered.
