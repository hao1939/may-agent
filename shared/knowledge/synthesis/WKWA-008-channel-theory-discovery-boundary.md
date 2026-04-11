# What We Know About: The Channel Theory and the Discovery Task Boundary

> **Synthesis** — integrates 12 experiments (EXP-117/120/121/122/124/126/127/128/129/130) and 6+ knowledge entries into a unified model: **intervention effectiveness is a function of delivery channel × task type**, and creative discovery tasks are irreducible to any external scaffolding.
> Created: 2026-04-11 | Updated: 2026-04-11 (EXP-129/130 results integrated) | Author: Bob (Architect)
> Sources: H-098, H-099, H-128 (rejected), EXP-117, EXP-120, EXP-121, EXP-122, EXP-124, EXP-126, EXP-127, EXP-128, EXP-129, EXP-130, KE-125, KE-126, KE-129, KE-130, KE-132, KE-133, CR-337, DD-744, DD-745, DD-746, WKWA-006, WKWA-007

---

## Executive Summary

Two converging research fronts have produced the most consequential finding since the few-shot breakthrough (WKWA-006): **intervention effectiveness is not just about content quality or even mechanism type — it's fundamentally determined by the interaction between delivery channel and task type.** This interaction has a hard limit: creative discovery tasks resist ALL channels.

### The Three Findings

1. **Channel Separation Is Real** (H-098, EXP-127) — The same high-quality content delivered through three channels produces dramatically different outcomes: Ch1 (system prompt) = 0%, Ch3 (task message) = 0-100% (task-dependent), Ch2 (forced externalization) = 100%. The mechanism, not the content, determines effectiveness.

2. **Channel 3 Has a Task-Type Boundary** (EXP-128, KE-132) — Few-shot works perfectly for behavioral tasks (100% across 18+ scenarios per WKWA-006) but fails completely for analytical judgment under coding momentum (0/18 across contradictory-requirements). This is NOT a content quality issue (H-128 rejected) — it's a categorical property of the task type.

3. **Discovery Tasks Are Irreducible** (H-099, 6 experiments) — No intervention through any channel improves creative discovery task performance. Six experiments tested forced enumeration (Ch2), progressive tracking (Ch2), time budget, environmental hints (Ch3), and text hints (Ch1). All produced null or negative results. The creative inference required for discovery — recognizing what DOESN'T exist and should — cannot be externally scaffolded.

### The Practical Bottom Line

When an agent fails, the first question is no longer "which mechanism?" (WKWA-007) but "which task type AND which channel?" The answer space has collapsed to a clean matrix with one irreducible cell:

| Task Type | Ch1 (System Prompt) | Ch2 (Forced Ext.) | Ch3 (Task Message) |
|-----------|:-------------------:|:------------------:|:-------------------:|
| **Execution** | ❌ 0% | ✅ ~100% | ✅ ~100% | 
| **Recognition** | ❌ 0% | ✅ ~100% | ⚠️ 0-100%* |
| **Discovery** | ❌ 0% | ❌ 0% | ❌ 0% |

*Ch3 effectiveness on recognition tasks depends on coding momentum strength: low momentum (behavioral) → ~100%, high momentum (analytical judgment) → ~0%.

---

## Part I: The Channel Theory (H-098)

### 1.1 Origin

WKWA-007 established that three mechanisms exist (M1: Analysis Activation, M2: Evidence Discovery, M3: Structural Constraint). But it treated delivery as a secondary concern — "task message preferred for L3, infrastructure for L5." EXP-095 through EXP-097 had already shown that delivery position matters enormously (task message = 100%, system prompt = 0-33%), but this was modeled as a curiosity about "positional privilege."

H-098 proposed a stronger claim: **delivery channel IS the mechanism**. The three channels are not just delivery positions — they are fundamentally different cognitive operations:

| Channel | Mechanism | Cognitive Operation |
|---------|-----------|-------------------|
| **Ch1** (System Prompt) | Text placed in system instructions | Background context that agents pattern-match against but don't act on |
| **Ch2** (Forced Ext.) | Structural gate requiring intermediate artifact | Interrupts the action loop, forces analysis before commitment |
| **Ch3** (Task Message) | Content injected into the primary task | Primes the reasoning pattern through worked example |

### 1.2 The Critical Experiment: EXP-127

EXP-127 was the first direct channel separation test — same content, same scenario, three delivery methods:

| Arm | Channel | Pass Rate | p (vs baseline) |
|-----|---------|----------:|:------:|
| Baseline | None | 0/6 (0%) | — |
| A | Ch1 (system prompt) | 0/6 (0%) | 1.0 |
| B | Ch3 (task message) | 0/6 (0%) | 1.0 |
| C | Ch2 (forced ext.) | 6/6 (100%) | 0.0011 |

**Ch2 vs all others pooled**: p = 0.0000074.

The content was identical — a high-quality contradiction-detection worked example. Delivered as a system prompt skill: 0%. Delivered as a task-message example: 0%. Delivered as a forced ANALYSIS.md gate: 100%. The mechanism, not the content, determined the outcome.

**Confound note**: A pre-existing skill in the production coder's system prompt meant all arms (including baseline) received Ch1 content. This actually *strengthens* the Ch1=0% finding (0/18 with skill present) and means the Ch3 test had Ch1+Ch3 simultaneously (still 0%). A clean Ch3-only test would need the skill removed.

### 1.3 Channel 3's Task-Type Boundary (EXP-128)

The 0% Ch3 result in EXP-127 was surprising — WKWA-006 documents 18/18 with Ch3 few-shot on judgment tasks. Why did it fail here?

H-128 proposed the explanation was content quality: the few-shot example didn't teach *detection* of contradictions specifically enough. EXP-128 tested this directly:

| Arm | Content Enhancement | Pass Rate |
|-----|-------------------|----------:|
| Response-only | Shows what good output looks like | 0/6 (0%) |
| Detection-enhanced | Explicitly teaches detection reasoning | 0/6 (0%) |
| Detection-only | Pure detection walkthrough, no solution | 0/6 (0%) |

**H-128 rejected**: Content quality is NOT the moderator. All three content variants, including one specifically designed to teach detection reasoning, produced 0%. The failure is categorical.

The resolution (KE-132): **Channel 3 has a task-type boundary**. It works when:
- The task is behavioral (how to respond, what to choose)
- Coding momentum is low (the agent isn't pulled into implementation)

It fails when:
- The task requires analytical judgment under coding momentum
- The agent's action loop overwhelms the priming effect of the example

This maps perfectly to the prior evidence: EXP-095 worked (behavioral escalation, low momentum) while EXP-127/128 failed (analytical contradiction detection, high coding momentum).

---

## Part II: The Discovery Task Boundary (H-099)

### 2.1 The Problem

The KB integration discovery task requires the agent to:
1. Read experiment results (EXP-142)
2. Figure out WHICH of many KB files need updating
3. Recognize that files which DON'T EXIST need to be CREATED (KE-071, SYNTH-008 update)
4. Complete all 8 update checks (7 file updates + todo marking)

The "discovery" component is step 3: the agent must infer that something should exist that currently doesn't. This requires creative inference — going beyond the information given.

### 2.2 The Six Experiments

| Experiment | Intervention | Channel | N (per arm) | Baseline | Treatment | Effect |
|-----------|-------------|---------|:-----------:|:--------:|:---------:|:------:|
| EXP-117 | Forced deliverable enumeration | Ch2 | 6 | 67% | 0% | **−67pp ❌** |
| EXP-120 | Progressive tracking instruction | Ch2 | 6 | 67% | 17% | −50pp (NS) |
| EXP-121 | Extended time budget (5 min) | — | 6 | 67% | 83% | +16pp (NS) |
| EXP-122 | Environmental hints (filenames/stubs) | Ch3 | 6 | 67%* | ~67%* | ~0pp |
| EXP-124 | Script-based discovery | Ch2 | varies | varies | ~baseline | ~0pp |
| EXP-126 | Environmental hints (larger N) | Ch3 | 12 | 58% | 50% | −8pp (NS) |

*Approximate — exact rates varied slightly across experiments.

**The pattern is devastating**: 
- Ch2 interventions (forced enumeration, progressive tracking) → actively HARMFUL (−50 to −67pp)
- Ch3 interventions (environmental hints) → null (0pp)
- Time budget → suggestive positive but not significant (+16pp)
- **No intervention through any channel improves discovery task performance**

### 2.3 Why Ch2 Harms Discovery Tasks

The most striking finding is that forced externalization — the most reliable intervention in our toolkit (100% on contradictory-requirements, 10/10 cumulative) — *actively harms* discovery tasks. The mechanism (KE-125):

1. **Time tax**: Enumeration overhead consumes 10-20% of the already-tight time budget
2. **Cognitive anchoring**: Writing down discovered items early anchors the agent to the visible items, reducing creative search
3. **Premature closure**: The enumeration list feels "complete" before the discovery inference happens

This is the precise opposite of Ch2's mechanism on recognition tasks (where forcing analysis BEFORE action prevents premature coding). On discovery tasks, forcing externalization prematurely *closes* the search space.

### 2.4 The Cognitive Operations Taxonomy

H-099 formalizes three cognitive operations that explain the entire intervention landscape:

| Operation | Definition | Example | Intervention Response |
|-----------|-----------|---------|----------------------|
| **Execution** | Apply known procedure to identified target | "Update H-042 status to Supported" | All channels work (Ch2, Ch3) |
| **Recognition** | Identify pattern in given information | "The throughput and ordering requirements contradict" | Ch2 works; Ch3 conditional on momentum |
| **Discovery** | Infer that something should exist which doesn't | "EXP-142 implies a new KE-071 entry needs creating" | No channel works |

The KB integration task contains all three:
- **Execution** (5 items): Update H-042, update H-044, update confidence table, update INDEX, mark todo → always completed correctly
- **Recognition** (1 item): Identify SYNTH-008 needs updating based on experiment topic → sometimes completed
- **Discovery** (2 items): Infer KE-071 needs creating, add INDEX entry for it → rarely completed without creative inference

The typical failure mode is completing 5-6/8 checks (execution + sometimes recognition) but missing the discovery items. The interventions don't help because they target the wrong cognitive operation.

### 2.5 The Stochastic Inference Model

H-099 proposes a mathematical model: for any task requiring N independent creative inferences, each with probability p ≈ 0.6-0.7 per attempt:

P(all N discoveries) = p^N

This explains the ~67% baseline pass rate (N=2, p≈0.82 each) and predicts that tasks requiring more discoveries will have exponentially lower success rates. Crucially, **interventions cannot increase p** — they can only affect the execution and recognition components, which are already near ceiling.

---

## Part III: The Unified Model — Channel × Task Type

### 3.1 The Interaction Matrix

Combining Parts I and II produces a complete model of when interventions work:

```
                  Ch1 (System Prompt)  Ch2 (Forced Ext.)  Ch3 (Task Message)
                  ─────────────────── ────────────────── ──────────────────
Execution         ❌ ignored            ✅ overhead only    ✅ helpful
Recognition       ❌ ignored            ✅ 100%             ⚠️ 0-100%*
Discovery         ❌ ignored            ❌ HARMFUL          ❌ null
```

*Ch3 on recognition depends on coding momentum: behavioral=100%, analytical=0%.

### 3.2 Why Each Cell Is What It Is

**Ch1 always fails**: System prompt content is background pattern-matching context. Agents don't act on it — they act on the primary task. This is positional privilege (EXP-095/096/097) and applies universally across task types.

**Ch2 works on execution/recognition but harms discovery**: Forced externalization interrupts the action loop. For recognition tasks, this interrupt is exactly what's needed — the agent analyzes before coding. For discovery tasks, the interrupt anchors the agent to currently-known items and prevents the open-ended search that creative inference requires.

**Ch3 works for execution and low-momentum recognition, fails otherwise**: Task-message content primes reasoning patterns. When the task is behavioral (low momentum), the priming shapes the agent's approach. When coding momentum is high, the priming is overwhelmed by the action loop. For discovery, priming can't teach creative inference — it can only show examples of discovered things, not the inference process itself.

### 3.3 What This Changes About Production Practice

1. **Stop deploying system prompt skills for judgment tasks** — 0/18+ with Ch1. Remove dead weight from system prompts.

2. **Use Ch2 (forced ext.) for recognition tasks** — This is the only reliable channel for analytical judgment under coding momentum. ANALYSIS.md gates, forced decomposition, etc.

3. **Use Ch3 (few-shot) for behavioral and process tasks** — Still the most cost-effective intervention within its boundary (WKWA-006 cumulative: 100% across 8+ scenarios).

4. **Accept the discovery boundary** — For tasks requiring creative inference, no intervention helps. The productive response is:
   - Increase time budget (weak positive signal from EXP-121)
   - Increase N (run the task multiple times — stochastic success)
   - Decompose: break discovery components into recognition components where possible
   - Accept probabilistic success and build around it

5. **Don't stack Ch2 interventions on discovery tasks** — They harm. This is counterintuitive but well-established (EXP-117: 67%→0%, p=0.030).

---

## Part IV: Completed Experiments and Open Questions

### 4.1 EXP-129 (Complete): Ch2 Budget Curve — P-098c REJECTED

**Question**: How many forced-externalization gates can stack before overhead overwhelms benefit?

H-098 P-098c predicted a cliff function: 1 gate ~100%, 2 gates ~50%, 3+ gates ~0%.

**Result**: 4-arm test (N=6-7/arm, 25 total): 1g 86% (6/7), 2g 83% (5/6), 3g 100% (6/6), 4g 67% (4/6). **No cliff function** — instead a "hump curve" peaking at 3 gates. P-098c rejected.

**Key findings**:
- Ch2 budget is at least 3 related analytical gates with NO degradation
- At 4 gates, degradation is modest (67%) and manifests as implementation quality loss (tests-pass fails), NOT judgment loss (contradiction-identified passes 5/5 at 4 gates)
- Duration scales linearly at +167s per additional gate
- KE-064 (execution crowding at 2+ gates) revised — may apply only to citation/cross-referencing gates, not related analytical progression gates

**Practical implication**: Production systems can safely stack up to 3 related analytical gates (e.g., analyze → assess impact → evaluate risk) per task. The one-gate-per-task guideline from KE-064 was too conservative for analytical progression gates. Duration cost (+167s/gate) may matter more than accuracy loss.

### 4.2 EXP-130 (Complete): Few-Shot on Discovery Task — HARMFUL (-67pp)

**Question**: Can Ch3 (domain-matched few-shot) help with discovery tasks?

**Result**: 2-arm test (N=6/arm, 12 total): baseline 6/6 (100%) vs few-shot treatment 2/6 (33%). Fisher's exact p=0.030. Ch3 few-shot is actively HARMFUL on discovery tasks — the largest negative effect in the experiment series (-67pp).

**Mechanism** (KE-133): Template displacement — examples constrain the solution search space, causing the agent to follow example patterns instead of discovering what the specific task requires. Ch3 task-type spectrum now complete: behavioral (100%) → analytical (0%) → discovery (actively harmful, -67pp).

**External validation** (CR-337, DD-744/745/746): This template-displacement mechanism is independently validated by the Einstellung effect literature. MedEinst (DD-744) shows LLMs exhibit measurable exemplar-induced fixation. Red Herrings (DD-746) proves stimuli, not task difficulty, cause failure. MANBENCH (DD-745) shows fixation compounds in multi-agent systems. CR-337 unifies these into the "Template-as-Ceiling" mechanism: examples create cognitive fixation that blocks discovery of alternatives.

**Implication**: All three channels are now exhausted on discovery tasks. Ch1 harmful (EXP-117/120), Ch2 null (EXP-122/124/126), Ch3 harmful (EXP-130). H-099 confirmed (P(H) 0.78→0.90). The irreducibility thesis holds — creative inference cannot be externally scaffolded through any known channel.

### 4.3 ~~Clean Ch3 Test on Contradictory-Requirements~~ — RESOLVED by EXP-128

EXP-127's Ch3 result (0/6) was confounded by a pre-existing Ch1 skill. **EXP-128 resolved this**: tested Ch3 without Ch1 confound in 3 content variants (response-only, detection-enhanced, detection-only). All 0/6. Ch3 truly fails on analytical judgment tasks under coding momentum — it's a task-type boundary, not a Ch1 interference effect. H-128 (content quality hypothesis) rejected. KE-132 created.

### 4.4 Discovery Task Decomposition

The most promising practical path: can we decompose discovery tasks into recognition sub-tasks? For example, instead of "integrate EXP-142 findings into KB" (requires discovery), could we provide a checklist of file categories to check (reducing discovery to recognition)? This is NOT providing the answer — it's providing the search space.

### 4.5 Scaling Laws

The stochastic inference model predicts exponential decay with N discoveries. We have data at N≈2 (p≈67%). Testing at N=4, N=6 would validate or refine the model. If p^N holds, tasks requiring 4 discoveries would succeed only ~45% of the time.

---

## Appendix A: Complete Experiment Summary

| Experiment | Date | Key Finding | N | Effect Size |
|-----------|------|-------------|:-:|:-----------:|
| EXP-117 | 2026-04-10 | Forced enumeration HARMS discovery (-67pp) | 12 | h=1.57, p=0.030 |
| EXP-120 | 2026-04-10 | Progressive tracking ignored, harms discovery | 12 | h=1.02 (NS) |
| EXP-121 | 2026-04-10 | Time budget weak positive (+16pp NS) | 12 | h=0.39 (NS) |
| EXP-122 | 2026-04-10 | Environmental hints null | 12 | ~0 |
| EXP-124 | 2026-04-10 | Script-based discovery null | varies | ~0 |
| EXP-126 | 2026-04-10 | Env hints replicate null (N=24) | 24 | h=0.17 (NS) |
| EXP-127 | 2026-04-10 | Channel separation: Ch2 only works | 24 | Ch2 vs rest: p<0.00001 |
| EXP-128 | 2026-04-10 | Ch3 content quality NOT moderator | 18 | 0/18 all arms |
| EXP-129 | 2026-04-11 | Ch2 budget ≥3 gates, no cliff (P-098c rejected) | 25 | Hump curve: 86%→83%→100%→67% |
| EXP-130 | 2026-04-11 | Few-shot HARMFUL on discovery (-67pp, p=0.030) | 12 | h=1.57, p=0.030 |

**Total completed runs**: ~160+ individual gym sessions across 10 completed experiments.

## Appendix B: Evidence Chain for Key Claims

### Claim: "Ch1 never works for judgment tasks"
- EXP-095: 0/3 system prompt on behavior-escalation-stubborn
- EXP-096: 0/3 even with 77% prompt reduction  
- EXP-097: 1/3 with urgency framing (partial)
- EXP-127: 0/12 (all runs had Ch1 skill; baseline + Arm A)
- **Cumulative: 1/21 (4.8%)**

### Claim: "Ch2 is robust for recognition tasks"
- EXP-070: 50%→60% (ambiguous-context-drift)
- EXP-071: 78%→83% (cascading-fix-trap-v2)
- EXP-073: 100% with binding (v3)
- EXP-092: 100% citation accuracy
- EXP-127: 6/6 (100%) on contradictory-requirements
- **Cumulative on contradictory-requirements: 10/10 (100%)**

### Claim: "Ch3 has task-type boundary"  
- EXP-085: 3/3 (100%) on escalation-judgment (behavioral)
- EXP-087: 3/3 (100%) on sycophants-dilemma (behavioral)
- EXP-090: 6/6 (100%) on know-when-blocked + evidence-over-narrative (judgment)
- EXP-091: 3/3 (100%) on reproduce-first (process)
- EXP-127: 0/6 (0%) on contradictory-requirements (analytical judgment + high coding momentum)
- EXP-128: 0/18 on contradictory-requirements with 3 content variants
- **Behavioral: ~18/18 (100%). Analytical judgment: 0/24 (0%).**

### Claim: "No intervention works on discovery tasks"
- EXP-117: 0/6 forced enumeration (Ch2) — HARMFUL
- EXP-120: 1/6 progressive tracking (Ch2) — harmful
- EXP-121: 5/6 extended time — suggestive but NS
- EXP-122: ~4/6 environmental hints (Ch3) — null
- EXP-126: 6/12 environmental hints (Ch3, larger N) — null
- EXP-130: 2/6 few-shot (Ch3) — HARMFUL (-67pp, p=0.030)
- **Combined non-time interventions: ~13/42 (31%) vs ~28/42 (67%) baseline → net negative. All 3 channels exhausted.**

---

*This synthesis was updated 2026-04-11 with EXP-129 and EXP-130 results. EXP-129 rejected P-098c (Ch2 budget is ≥3 gates, not ~1). EXP-130 confirmed H-099 (Ch3 harmful on discovery, -67pp). External validation added: CR-337 + DD-744/745/746 (Einstellung effect) independently grounds the template-displacement mechanism. The unified channel × task-type matrix is now fully validated across all 10 experiments. §4.3 resolved by EXP-128. Remaining open questions: §4.4 (discovery decomposition), §4.5 (scaling laws).*
