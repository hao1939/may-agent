# KE-158: The Overhead Narrative Challenge — A Difficulty Threshold Reframes Guard Harm

**Date**: 2026-04-12  
**Author**: Bob  
**Rating**: ★★★★★ (Paradigm Revision)  
**Sources**: H-106 (P=0.40), EXP-147 Track B, KE-155, KE-156, KE-157, EXP-149 design, H-101, H-099

---

## Core Thesis

Our research program has developed a coherent narrative over the past two weeks: **guards/context/overhead harm agents**, especially architecturally ready ones. This narrative is now being challenged by experimental data. The data don't refute the harm story entirely — they refine it into something more nuanced and more useful: **overhead only matters when tasks are hard**.

This entry synthesizes three converging signals that challenge the overhead narrative, identifies the "difficulty threshold" as the real finding, and proposes how this reframes our active hypotheses.

---

## The Three Challenges

### Challenge 1: H-106 P-106a/P-106d Falsification (P dropped 0.65 → 0.40)

H-106 predicted that architecturally ready agents would have **higher** guard block rates among correct work (the "observability tax" = guards penalizing invisible-but-real verification). The data showed the **opposite**: ready agents have *lower* block rates on correct work (34.3% vs 53.5%, z = −7.53).

H-106 also predicted that correcting for inflation would reveal a steeper internalization curve (ready agents improving even faster than raw data suggests). Instead, the correction **flattened** the curve (slope −0.096 vs −0.132) — meaning the apparent improvement was partly an artifact of concentrated early-period tax blocks being removed.

**What this means**: The observability tax is not a uniform drag on ready agents. Ready agents are genuinely blocked less often on correct work, not more. The theoretical framework (DD-750, verbal overshadowing, 3× fidelity gap) remains sound, but its application to guard systems was overconfident.

### Challenge 2: EXP-147 Track B — Context Isolation Null Overall (+5.1pp, p=0.39)

P-120c predicted that scoping context to task-relevant information would improve success by ≥15pp. The aggregate result was +5.1pp (not significant). Five of eight scenarios hit ceiling (100% both conditions), contributing zero signal.

**But**: Among the three discriminating scenarios (all non-ceiling), scoped context outperformed full context consistently: +17pp (cascading-fix-trap-v2), +11pp (plan-once-amend), +9pp (contradictory-requirements). The weighted average across discriminating scenarios is ~+14pp — nearly meeting the threshold.

**What this means**: Context overhead doesn't matter on easy tasks. On hard tasks, it matters a lot. The aggregate null result masks a real and potentially large effect that only activates above a difficulty threshold.

### Challenge 3: The Voluntary Externalization Paradox (KE-156) Cuts Both Ways

KE-156 showed that agents don't externalize voluntarily (0/13 without forcing) but achieve 100% accuracy regardless. This was initially interpreted as evidence that forced externalization is pure tax.

But EXP-149's design reveals the uncomfortable implication: if agents don't self-verify without guards, and we can't see their reasoning, how do we know they're "architecturally ready" vs just lucky? The paradox cuts both ways:
- **If agents self-verify internally → guards are tax** (our narrative)
- **If agents don't self-verify but get lucky → guards are insurance** (the challenge)

The answer probably depends on — again — task difficulty. On easy tasks, even random approaches succeed. On hard tasks, invisible self-verification (or its absence) starts to matter.

---

## The Difficulty Threshold Model

The emerging pattern from all three challenges:

| Task Difficulty | Overhead Effect | Evidence |
|---|---|---|
| **Easy** (>90% baseline) | **Null** — overhead doesn't matter, agent succeeds regardless | EXP-147: 5/8 ceiling scenarios, 0pp delta |
| **Medium** (50-90% baseline) | **Small positive or null** — slight benefit to scoping/removing overhead | EXP-147: plan-once-amend (+11pp), contradictory-req (+9pp) |
| **Hard** (<50% baseline) | **Large** — overhead creates measurable harm | EXP-147: cascading-fix-trap-v2 (+17pp at 41% baseline) |
| **Discovery** (<30% baseline) | **Very large** — any structured overhead is harmful | EXP-117/130: −50pp to −67pp on discovery tasks |

**The threshold appears to be around 50% baseline pass rate.** Below this threshold, the agent's processing resources are genuinely constrained, and any overhead competes with the core task. Above it, the agent has headroom to absorb overhead without meaningful impact.

### Why This Makes Sense

Consider the resource competition model from KE-155:

```
Total processing budget = Core task reasoning + Overhead compliance

Easy tasks:   Core task needs 30% of budget → 70% headroom → overhead absorbed
Medium tasks: Core task needs 60% of budget → 40% headroom → overhead felt but manageable  
Hard tasks:   Core task needs 90% of budget → 10% headroom → overhead displaces core reasoning
Discovery:    Core task needs 100%+ of budget → any overhead is directly harmful
```

This is consistent with H-099 (discovery tasks resist ALL intervention) and H-098's channel theory (Ch1 capacity is finite). The new insight is that **the threshold is task-specific, not agent-specific**. The same agent can absorb enormous overhead on easy tasks and be severely impaired by modest overhead on hard tasks.

---

## Reframing the Active Hypotheses

### H-106 (Observability Tax): P = 0.40 — Needs Reformulation

H-106 as stated — "observability tax harms architecturally ready agents" — is too broad. P-106a and P-106d were falsified because the prediction was about agent type, not task difficulty. A reformulated version:

> **H-106-revised** (proposed): The observability tax primarily manifests on hard tasks (baseline <50%), regardless of agent architectural readiness. On easy tasks, both ready and unready agents absorb the tax without measurable harm.

This would explain why P-106a failed: even "ready" agents don't show elevated block rates on correct work overall, because most of their work is on easy-to-medium tasks where guards don't matter. The tax is real but concentrated in a small fraction of sessions.

**EXP-149 should be updated**: The critical test isn't ready-vs-unready agents — it's hard-vs-easy tasks. The pilot should stratify by task difficulty, not just agent readiness.

### H-101 (Architectural Readiness): P = 0.78 — Strengthened, Actually

The difficulty threshold model doesn't weaken H-101 — it sharpens it. Architectural readiness determines how agents *respond to learning*, not how they *respond to overhead*. The bifurcation (learners vs reliants) is real and robust (EXP-135/136/137). What the difficulty threshold adds is that the practical impact of the bifurcation only shows up on hard tasks.

### H-105 (Three-Layer Reasoning): P = 0.75 — Unaffected

The three-layer model describes a structural property of reasoning (latent → thinking → output fidelity loss). The difficulty threshold doesn't challenge this — it adds a condition for when the fidelity loss matters practically.

### H-103 (Format Tax): P = 0.45 — Makes More Sense Now

H-103's mixed results (format overhead lower than predicted overall, but real on some tasks) are perfectly explained by the difficulty threshold. The format tax exists but only manifests on hard tasks. EXP-144's findings (15-23% overhead) may represent an average across task difficulties, masking a larger effect on hard tasks and a negligible effect on easy ones.

### H-099 (Discovery Boundary): P = 0.90 — The Extreme End of the Threshold

Discovery tasks are the extreme case: baseline is so low that ANY overhead is harmful. H-099's finding (all channels harmful or null on discovery) is the difficulty threshold pushed to its limit. The −67pp from few-shot examples on discovery tasks (EXP-130) isn't a special "discovery mechanism" — it's the standard overhead harm amplified by extreme difficulty.

This is actually a simplification: we don't need a separate "discovery boundary" theory if the difficulty threshold explains it. Discovery tasks are just tasks where baseline pass rate is very low and therefore maximally sensitive to overhead.

---

## What's the Updated Best-Guess Theory?

### When Guards Help

1. **Agent is not ready AND task is hard**: Guard catches genuine errors that the agent would have missed. This is the classic scaffolding use case (EXP-145: fire rate peaks at 55.3%, reliants genuinely need the catch).
2. **Task is safety-critical regardless of difficulty**: Even if the agent would succeed without the guard, the cost of a miss is so high that the tax is worth paying (KE-155's "justified tax" category).
3. **Agent is learning**: During the 5-7 day internalization window (EXP-145), guards provide feedback that shapes architectural adaptation.

### When Guards Don't Matter

4. **Task is easy regardless of agent**: ≥90% baseline pass rate means guards fire rarely and catch nothing meaningful. The tax is near-zero but so is the benefit.

### When Guards Hurt

5. **Task is hard AND agent is ready**: The compliance overhead displaces core reasoning at exactly the moment the agent needs all its processing budget. This is the real observability tax — but it's task-gated, not agent-gated.
6. **Task is discovery-class**: Any structured overhead is harmful through the Einstellung/displacement mechanism (EXP-117, EXP-130).

### The Design Implication

Adaptive gating should be based on **estimated task difficulty**, not just agent readiness:

```
if task_difficulty == "easy":
    # Don't bother — guards won't fire and agent will succeed
    guards = minimal_or_none
elif task_difficulty == "medium":
    # Standard guards — modest benefit, modest cost
    guards = standard
elif task_difficulty == "hard":
    if agent_ready:
        # This is where the tax bites — use outcome-only guards
        guards = outcome_only  
    else:
        # Agent needs scaffolding — full process guards justified
        guards = full_process
elif task_difficulty == "discovery":
    # No guards — any overhead is harmful
    guards = none
```

---

## Key Uncertainties

1. **Where exactly is the threshold?** ~50% baseline is a rough estimate from three EXP-147 scenarios. More data needed across a wider difficulty range.
2. **Is the effect linear or threshold?** It could be a smooth curve (overhead harm proportional to difficulty) rather than a sharp threshold. The data is too sparse to tell.
3. **Does agent readiness interact with difficulty?** The model above treats them as independent dimensions, but they may interact. Ready agents might absorb more overhead on hard tasks than unready agents (or vice versa). EXP-149 could test this.
4. **Active recall confound**: EXP-147's context manipulation (119 vs 893 tokens) was small compared to active_recall injections (1,000-8,000 tokens). The difficulty threshold might be even sharper if we could control total injected context.

---

## Proposed Next Steps

1. **Reformulate H-106** as difficulty-threshold-gated rather than agent-readiness-gated. Keep P at 0.40 pending EXP-149 results (which should be updated to stratify by task difficulty).
2. **Consider a new hypothesis** (H-107 or next available): "Overhead harm scales with task difficulty, crossing from negligible to dominant at approximately 50% baseline success rate." This would be the formal statement of the difficulty threshold model.
3. **Update EXP-149 design**: Add task difficulty as a primary stratification variable. The current design only varies guard condition (A/B/C) and agent readiness. It should also systematically vary task difficulty.
4. **Hard-task follow-up from EXP-147**: Run N=50 per condition on cascading-fix-trap-v2 alone. This is the single highest-value experiment for validating the threshold, with 80% power to detect the observed +17pp effect.

---

## Meta-Observation: Narrative vs Data

This knowledge base has developed a compelling intellectual narrative: guards are overhead, externalization harms reasoning, ready agents are taxed by compliance. The narrative is built on real theoretical foundations (DD-750, KE-155, verbal overshadowing) and real empirical signals (EXP-117/130/136/137).

But the experimental tests of the narrative's predictions have been weak-to-null on aggregate metrics: H-106 P-106a/P-106d falsified, EXP-147 Track B null overall. The narrative is running ahead of the evidence.

This doesn't mean the narrative is wrong — it means it's **incomplete**. The difficulty threshold is the missing moderator. With it, the narrative becomes: "guards harm performance **on hard tasks**, are irrelevant **on easy tasks**, and are helpful **for agents still learning**." This is less dramatic than "guards harm agents" but more useful for system design.

The corrective lesson: when our theoretical predictions fail aggregate tests, look for moderators before abandoning the theory. The effect may be real but conditional.

---

## Connections

| Entry | Relationship |
|---|---|
| H-106 (P=0.40) | Direct challenge — P-106a/P-106d falsified. Difficulty threshold explains why: predictions were about agent type when the real moderator is task difficulty. |
| EXP-147 Track B | Null overall (+5.1pp), but +14pp on hard tasks. Primary evidence for the difficulty threshold. |
| KE-155 (Externalization Harm Boundary) | Precursor — identified when externalization helps vs hurts. KE-158 adds the difficulty dimension to that taxonomy. |
| KE-156 (Voluntary Externalization Paradox) | Complicates the threshold model — agents don't self-verify at any difficulty level, so guards may be insurance even on easy tasks. |
| KE-157 (Literature-Validated Tax) | Theoretical foundation remains sound. The literature's finding that externalization degrades reasoning is real — KE-158 adds that it only matters practically when tasks are hard. |
| H-101 (Architectural Readiness, P=0.78) | Compatible — readiness determines learning trajectory; difficulty determines when overhead costs matter. |
| H-099 (Discovery Boundary, P=0.90) | Subsumed as extreme case — discovery = maximally hard → maximally sensitive to overhead. |
| H-103 (Format Tax, P=0.45) | Explained — format tax is real but only manifests on hard tasks, explaining the mixed empirical results. |
| EXP-149 (Designed) | Should be updated to stratify by task difficulty, not just agent readiness. |

## Tags
`overhead-narrative` `difficulty-threshold` `guard-harm` `observability-tax` `paradigm-revision` `H-106` `EXP-147` `KE-155` `KE-156` `KE-157` `adaptive-gating`
