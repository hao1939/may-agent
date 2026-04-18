# Research Synthesis: Gate Stacking (EXP-129) × Einstellung/Fixation (DD-744/745/746/CR-337)

> **Cross-reference synthesis** — connects the EXP-129 gate-stacking hump curve with the Einstellung fixation literature to deepen understanding of H-098 (channel theory) and H-099 (discovery boundary).
> Date: 2026-04-11 | Author: Bob (Architect)
> Sources: EXP-129, EXP-130, DD-744, DD-745, DD-746, CR-337, H-098, H-099, KE-132, KE-133, KE-134

---

## 1. Summary of Each Thread

### Thread 1: EXP-129 Gate Stacking Results

EXP-129 tested whether stacking 1–4 forced-externalization gates on a single task causes a cliff function (sharp drop) as predicted by P-098c. **Result**: P-098c REJECTED. Instead of cliff decay, a "hump curve" emerges:

| Gates | Pass Rate | Duration |
|-------|-----------|----------|
| 1 | 86% (6/7) | 253s |
| 2 | 83% (5/6) | 379s |
| 3 | 100% (6/6) | 556s |
| 4 | 67% (4/6) | 755s |

Key findings:
- **No degradation up to 3 gates** — performance actually peaks at 3
- **At 4 gates**: mild degradation manifests as *implementation* quality loss (tests-pass), NOT judgment loss (contradiction-identified 5/5 at 4 gates)
- **Duration is linear**: +167s per gate, 3× cost at 4 gates vs 1 gate
- **Gate synergy**: related analytical gates (analysis → impact → risk) may function as progressive reasoning scaffolding rather than competing demands

### Thread 2: Einstellung/Fixation Literature (DD-744/745/746 + CR-337)

Three papers + one cross-reference establish that **LLMs exhibit the Einstellung effect** — fixation on familiar solution patterns that blocks discovery of better alternatives:

- **DD-744 (MedEinst)**: First rigorous benchmark. Counterfactual clinical pairs show frontier LLMs have severe "bias trap rates" — correct on control cases, wrong on trap cases where surface patterns mislead. ECR-Agent mitigates via structural dual-pathway reasoning.
- **DD-745 (MANBENCH)**: Fixation compounds in multi-agent systems. Individual fixation → collective false memory through social reinforcement. Cognitive anchoring achieves 74% reduction.
- **DD-746 (Red Herrings/OCW)**: Foundational demonstration. LLMs fixate on obvious-but-wrong connections in creative problem-solving. Removing misleading stimuli restores performance — proving stimuli, not difficulty, drive failure.
- **CR-337**: Synthesizes all three into the "template-as-ceiling" mechanism explaining EXP-130's -67pp result: few-shot examples act as Einstellung-inducing stimuli that create fixation on the example template.

---

## 2. Cross-Thread Connections

### Connection 1: Gate Synergy as Anti-Fixation Mechanism

**The surprising finding**: EXP-129's 3-gate arm achieved 100% — *better* than 1-gate (86%). Why would MORE structure HELP?

The Einstellung literature provides a compelling explanation. DD-744's ECR-Agent achieves fixation resistance through **dual-pathway perception**: forcing the agent to reason about both "what confirms" and "what disconfirms" the obvious answer. EXP-129's 3-gate sequence (analysis → impact assessment → risk catalog) inadvertently implements a similar multi-perspective structure:

1. **ANALYSIS.md** (gate 1): "List constraints, calculate if they can be simultaneously met" → establishes the problem structure
2. **IMPACT_ANALYSIS.md** (gate 2): "Who is affected by each design choice, what breaks?" → forces consideration of downstream consequences (alternative perspective)
3. **RISK_ASSESSMENT.md** (gate 3): "Enumerate implementation risks, likelihood, mitigation" → forces adversarial thinking about what could go wrong

Each gate forces a *different analytical lens* on the same problem. This is structurally similar to ECR-Agent's three-level causal reasoning (association → intervention → counterfactual). The gates don't just add overhead — they progressively break fixation by forcing perspective shifts.

**This explains the hump curve**: at 1 gate, the agent has one analytical perspective (sometimes sufficient). At 3 gates, it has three complementary perspectives that together prevent fixation on a single approach. At 4 gates, the IMPLEMENTATION_PLAN.md adds execution planning that doesn't provide a new analytical perspective — it just adds time cost, pushing the agent past an optimal reasoning-to-execution ratio.

### Connection 2: Gate Stacking and Fixation Resistance Are Channel-Specific

EXP-129 shows that *related analytical* Ch2 gates synergize. But EXP-130 shows that Ch3 examples *cause* fixation on discovery tasks (-67pp). DD-746 explains why: examples ARE the fixation-inducing stimuli.

The critical distinction:
- **Ch2 gates force the agent to GENERATE multiple analyses** → anti-fixation (each analysis is a fresh perspective)
- **Ch3 examples PROVIDE a completed analysis** → pro-fixation (the example IS the Einstellung stimulus)

This is a fundamental asymmetry: **generating** structure breaks fixation, while **receiving** structure induces it. The channel matters not just because of positional privilege (H-098's original claim) but because generation and reception have opposite effects on cognitive flexibility.

### Connection 3: The Discovery Boundary Is an Einstellung Boundary

H-099 claims discovery tasks resist all interventions because creative inference is irreducible. The Einstellung literature provides the mechanistic explanation for WHY interventions actively HARM:

- **EXP-117** (forced checklist, -67pp): The checklist creates Einstellung by enumerating known items, anchoring the agent to the "obvious" set and blocking discovery of novel items. This is DD-746's red herring effect — the enumerated items are "obvious connections" that block search for hidden connections.
- **EXP-130** (few-shot, -67pp): The examples create Einstellung by establishing a template pattern. This is DD-744's bias trap — the example acts as a "control case" pattern that the agent applies even when the "trap case" (novel task) requires a different approach.
- **EXP-120** (progressive tracking, -50pp): Tracking assumes known targets. The instruction to track creates Einstellung toward trackable (i.e., already-known) items.

The unifying insight: **on discovery tasks, ANY structured input risks becoming an Einstellung stimulus** because discovery requires generating genuinely novel representations, and structures provide patterns that block novelty.

### Connection 4: Collective Fixation Implications (DD-745)

DD-745's MANBENCH finding — that fixation compounds across agents — has implications for our multi-agent system:
- If Agent A fixates on a template during discovery (EXP-130 mechanism), their output enters shared context
- Agent B inherits A's fixation via the KB/handoff
- The fixation becomes "consensus truth" (DD-745's Mandela Effect lifecycle)

This means the discovery boundary isn't just a single-agent problem — it's amplified by our architecture. The Session 597/599 meta-case (confabulated "coder not registered" → Scout propagated) is a live instance. **Provenance tracking in compaction** (DD-745's recommendation) directly addresses this.

---

## 3. Impact/Novelty Ranking

### Tier 1: High Impact, Novel

1. **Gate synergy as anti-fixation** — The finding that multiple related analytical gates IMPROVE performance (not just avoid degradation) is novel and has immediate practical implications. It reframes Ch2 gate design from "necessary evil with overhead" to "progressive perspective-forcing that resists fixation." This is grounded in ECR-Agent's dual-pathway success (DD-744) and explains the hump curve mechanistically.

2. **Generation vs. reception asymmetry** — The insight that generating structure (Ch2) breaks fixation while receiving structure (Ch3) induces it is a new theoretical contribution that unifies EXP-129 and EXP-130 results. It explains why Ch2 and Ch3 have opposite effects on discovery tasks despite both being "helpful" on execution tasks.

### Tier 2: High Impact, Confirmatory

3. **Einstellung as the discovery boundary mechanism** — CR-337 + DD-744/745/746 ground H-099's "irreducibility" claim in established cognitive science. This doesn't change the practical recommendation (don't intervene on discovery tasks) but provides deep mechanistic understanding of WHY. Important for theoretical completeness.

4. **Collective fixation amplification** — DD-745's finding that fixation compounds across agents validates our error propagation concerns and motivates provenance tracking. High practical impact but the recommendation (provenance tracking) was already emerging from other evidence.

### Tier 3: Medium Impact

5. **Bias Trap Rate as evaluation metric** — DD-744's methodology (counterfactual pairs measuring fixation vs. competence) could improve our gym evaluation design. Medium priority: useful but not blocking.

6. **P-098c revision is complete** — The Ch2 budget is ≥3 related gates, not ~1. Practically important for production guard stacking decisions. Already integrated into H-098.

---

## 4. What Changes in the Overall Channel Theory Picture

### Before this synthesis:
- H-098 described three channels with effectiveness profiles
- H-099 described discovery as intervention-resistant
- These were treated as separate findings: channel theory for execution/recognition tasks, discovery boundary as a separate phenomenon

### After this synthesis:
- **The Einstellung mechanism UNIFIES channel theory and the discovery boundary.** Channel effectiveness is fundamentally about whether the intervention induces or breaks fixation:
  - Ch1 (system prompt): Neither induces nor breaks fixation — just ignored (insufficient salience)
  - Ch2 (forced ext.): BREAKS fixation by forcing generation of novel analytical artifacts → works on recognition, can synergize on judgment
  - Ch3 (few-shot): INDUCES fixation by providing template patterns → works when template IS the answer (behavioral), fails when it isn't (analytical), actively harms when novelty is needed (discovery)
  - Discovery tasks: All structured input risks Einstellung, so only unstructured time helps

- **The channel × task-type matrix gains a mechanistic explanation.** It's no longer just "this cell works, this doesn't" — there's a unifying theory (fixation dynamics) that explains every cell.

- **Gate design has a new principle.** When stacking Ch2 gates: use analytically RELATED but PERSPECTIVELY DISTINCT gates. Each gate should force a different analytical lens (analysis → impact → risk), not just add more of the same kind of analysis. This maximizes the anti-fixation benefit while minimizing pure overhead.

### Updated conceptual model:

```
Intervention Effectiveness = f(channel, task_type, fixation_dynamics)

Where:
- Channel determines the DELIVERY mechanism (ignored / generated / received)
- Task type determines whether the answer EXISTS in pattern space (execution/recognition) 
  or must be GENERATED de novo (discovery)
- Fixation dynamics determine whether the intervention BREAKS existing fixation 
  (Ch2 multi-perspective), INDUCES new fixation (Ch3 template), or is irrelevant (Ch1)
```

---

## 5. Next Experiment Priority

### Priority 1: EXP-E_DIVERSE — Unrelated Gate Stacking (tests fixation theory)

**Question**: Does the gate synergy effect depend on gates being analytically related? If the anti-fixation theory is correct, *unrelated* gates (e.g., analysis + style-check + performance-audit) should show LESS synergy because they don't provide complementary perspectives on the same problem.

**Design**: 3-arm test on contradictory-requirements:
- Arm A: 3 related analytical gates (EXP-129 Arm C replication)
- Arm B: 3 unrelated gates (analysis + code style audit + performance benchmark plan)
- Arm C: 3 adversarial gates (analysis + "what could go wrong" + "argue the opposite")

**Prediction**: 
- Arm A: ~100% (replication)
- Arm B: ~67-83% (unrelated gates add overhead without perspective benefit)
- Arm C: ~100% or higher quality (adversarial framing maximizes anti-fixation, per ECR-Agent's dual-pathway)

**Why this is highest priority**: Directly tests the anti-fixation mechanism. If Arm B degrades while Arm C maintains or improves, it confirms that gate *relevance and perspective diversity* (not just gate count) is the active ingredient. This would be a prescriptive result: design gates to provide complementary analytical perspectives, not just impose structure.

### Priority 2: P-099a — Time Gradient (tests stochastic model)

Already proposed in H-099. Run discovery task at 3, 5, 8, 10 minutes. If the stochastic inference model holds, we should see P(success) = 1-(1-p)^(T/Δt) with diminishing returns. This would validate that time is the only positive lever for discovery tasks and quantify the exact budget-performance tradeoff.

### Priority 3: Discovery Decomposition (§4.4 of WKWA-008)

Test whether providing a "search space" (categories of files to check) without providing the answer can convert discovery tasks into recognition tasks. This is the most practically impactful path — if it works, it provides a systematic approach to handling discovery tasks. If it fails, it confirms H-099's irreducibility even more strongly.

---

## 6. Summary

The EXP-129 gate-stacking results and the Einstellung/fixation literature are deeply connected through a shared mechanism: **fixation dynamics determine intervention effectiveness.**

| Finding | Source | Implication |
|---------|--------|-------------|
| 3 related gates synergize (100%) | EXP-129 | Multi-perspective generation breaks fixation |
| Examples cause -67pp on discovery | EXP-130 + CR-337 | Template reception induces fixation |
| ECR-Agent breaks fixation architecturally | DD-744 | Validates structural > content for anti-fixation |
| Fixation compounds across agents | DD-745 | Our multi-agent architecture amplifies the risk |
| Red herrings = the mechanism | DD-746 | Any pattern stimulus can block creative search |

**The bottom line**: Gate design should maximize perspective diversity (anti-fixation), not minimize gate count (the old P-098c guideline). For discovery tasks, the Einstellung mechanism explains why ALL interventions harm — they all provide patterns that block the novel inference the task requires. The next experiment should directly test whether gate perspective diversity (not just count) is the active ingredient.
