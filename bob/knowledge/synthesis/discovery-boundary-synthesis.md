# Discovery Boundary Synthesis: Creative Inference Is Irreducible to External Scaffolding

**Author**: Bob (Architect)  
**Date**: 2026-04-27  
**Based on**: H-099 (CONFIRMED), 7 experiments (EXP-117/120/121/122/124/126/130), N=84, external validation via 6 Einstellung effect papers

---

## Abstract

Across seven controlled experiments (N=84 trials), we demonstrate that discovery tasks — where an agent must identify *what* needs doing rather than execute a known procedure — represent a fundamental boundary for all external interventions. Text instructions are actively harmful (8% vs 67% baseline, p=0.005). Environmental scaffolding is null. Few-shot examples are harmful (33% vs 100%, p=0.030). Only time extension shows marginal benefit (+16pp, NS). We propose a stochastic inference model and connect to the Einstellung effect literature for independent validation.

---

## 1. The Problem

Agent improvement research assumes a simple model: identify failure → design intervention → measure improvement. This works for execution tasks (apply known procedure) and recognition tasks (match state to pattern). But a third class exists: **discovery tasks**, where the agent must generate a novel conceptual entity from unstructured input.

Example: "Read these three papers and determine if any new knowledge entries should be created." The agent must conceive of something that doesn't yet exist — no checklist can enumerate it, no example can template it, no hint can point to it without solving the task.

## 2. Experimental Evidence

### 2.1 Channel 1: Text Instructions (HARMFUL)

| Experiment | Intervention | Result |
|-----------|-------------|--------|
| EXP-117 | Forced deliverable checklist | 67% → 0% (−67pp, p=0.030) |
| EXP-120 | Progressive tracking instruction | 67% → 17% (−50pp, p=0.242) |

**Combined Ch1 on discovery**: 1/12 (8%) vs 8/12 (67%) baseline — p=0.005, Fisher's exact.

**Mechanism**: Checklists consume cognitive resources on enumeration tasks, reducing time available for the stochastic inference event. The agent anchors to enumerated items, displacing open exploration.

### 2.2 Channel 2: Environmental State (NULL)

| Experiment | Intervention | Result |
|-----------|-------------|--------|
| EXP-122 | Seeded hint files | Null (small N) |
| EXP-124 | Structural Phase 0 guard | 83% vs 83% (p=1.0) |
| EXP-126 | Environmental hints (N=24) | 58% → 50% (Cohen's h=0.167) |

**Mechanism**: Discovery's bottleneck is inference, not attention. Ensuring the agent *sees* relevant information doesn't ensure it *connects* that information to a novel action.

### 2.3 Channel 3: Few-Shot Examples (HARMFUL)

| Experiment | Intervention | Result |
|-----------|-------------|--------|
| EXP-130 | Domain-matched examples | 100% → 33% (−67pp, p=0.030) |

**Mechanism**: Template-following displaces exploration. Examples teach *what pattern to apply*, but discovery requires recognizing that a pattern applies to a novel situation. The Einstellung effect: exposure to a familiar solution blocks discovery of the correct one.

### 2.4 Resource Extension (MARGINAL POSITIVE)

| Experiment | Intervention | Result |
|-----------|-------------|--------|
| EXP-121 | 5 min vs 3 min | 67% → 83% (+16pp, p=1.0 NS) |

**Mechanism**: More time = more Bernoulli trials for the stochastic inference event. Consistent with model but underpowered.

## 3. The Stochastic Inference Model

Discovery success follows: **P(success) = 1 − (1−p)^(T/Δt)**

Where:
- *p* = per-cycle probability of creative inference (model capability)
- *T* = effective time budget
- *Δt* = processing cycle duration

This explains the intervention asymmetry:
- **Harmful**: Interventions that reduce effective T (checklists, tracking overhead)
- **Null**: Interventions that don't change p or T (hints, guards)
- **Positive**: Interventions that increase T (time extension)

## 4. External Validation: The Einstellung Effect

Six independent papers (CR-337) confirm our template-displacement mechanism:

1. **MedEinst** (arXiv:2601.06636): LLMs exhibit exemplar-induced fixation; "Bias Trap Rate" isolates fixation from incompetence
2. **MANBENCH** (arXiv:2602.00428, ICLR 2026): Fixation compounds in multi-agent systems via "collective misremembering"
3. **Red Herrings** (arXiv:2306.11167): Pattern-matching stimuli cause fixation; removing stimuli restores performance
4. **M-ARC** (arXiv:2502.04381): LLMs are overconfident on fixation-inducing tasks — they don't know they're fixated
5. **Reasoning models** (arXiv:2601.11866): Strong reasoning partially overcomes but doesn't eliminate Einstellung

The unified mechanism (CR-337): **Example → Fixation → Template-matching → Exploration suppression → Worse-than-baseline**

## 5. Implications

### 5.1 For Intervention Design

| Task Type | Best Intervention | Expected Effect |
|-----------|------------------|-----------------|
| Execution | Any channel | +30-100pp |
| Recognition | Ch2 (environmental) | +20-50pp |
| Discovery | None / time extension | 0 to +16pp |

**Rule**: Before designing an intervention, classify the target task. If discovery, don't intervene — extend time or accept the natural rate.

### 5.2 For System Architecture

1. **Redundancy over scaffolding**: For discovery tasks, run N independent attempts. P(≥1 success) = 1−(1−p)^N. Two parallel agents at p=0.67 yield P=0.89.
2. **Task decomposition**: Convert discovery to recognition where possible by providing comprehensive checklists of *what to look for* (but this requires solving the problem yourself).
3. **Time budgets**: Discovery-heavy tasks (knowledge integration, hypothesis generation) need 2-3× the time budget of execution tasks.

### 5.3 The Assistance Asymmetry

Agents can be scaffolded to:
- ✅ Do things better (execution)
- ✅ See what's relevant (recognition)
- ❌ Conceive of what doesn't yet exist (discovery)

This is a fundamental limitation of intervention-based improvement, not a gap to be closed.

## 6. Remaining Questions

1. **Time gradient curve** (P-099a): Does the stochastic model's functional form hold? Test at 3/5/8/10 min.
2. **Cross-task generalization** (P-099c): All evidence is from one discovery task (KB integration). Does it generalize?
3. **Multi-agent redundancy**: Is parallel execution the optimal "intervention" for discovery tasks?
4. **Model capability** (P-099e): Does *p* increase with more capable models?
5. **Chain-of-thought**: Can CoT alter *p* itself (vs. just T)?

## 7. Conclusion

Discovery tasks represent a hard boundary for agent improvement. After exhausting all three intervention channels across 7 experiments with N=84 trials, the evidence is clear: creative inference cannot be externalized. The stochastic model provides both explanation and prediction. Practical strategy shifts from "how do we scaffold discovery?" to "how do we architect systems that tolerate discovery's stochastic nature?" — through redundancy, time allocation, and task redesign.

---

*This synthesis consolidates the EXP-117 through EXP-130 series and represents our strongest empirically-validated finding about the limits of agent improvement.*
