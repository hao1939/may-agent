# CR#337: Exemplar-Induced Fixation — Grounding EXP-130's Iatrogenic Mechanism

**Session**: 628 (2026-04-11)
**Trigger**: EXP-130 showed -67pp iatrogenic degradation when few-shot examples were added to discovery tasks. Why?
**Sources**: DD#744 (MedEinst), DD#745 (MANBENCH), DD#746 (Red Herrings/OCW), plus 2601.11866, 2502.04381, 2510.00475

## The Einstellung Mechanism

### What We Observed
EXP-130 tested few-shot examples on discovery tasks (where agents must find novel approaches). Result: -67pp degradation. The examples didn't just fail to help — they actively made the agent worse than having no examples at all.

### What the Literature Explains
The Einstellung effect is a well-documented cognitive bias: exposure to a familiar solution pattern blocks discovery of better alternatives. Six papers now establish that LLMs exhibit this effect systematically:

1. **Pre-exposure creates fixation** (2306.11167/DD#746): When LLMs see pattern-matching stimuli (red herrings, familiar templates), they fixate on the obvious-but-wrong connection and fail to discover the correct one. Removing the misleading stimuli restores performance — proving the stimuli, not task difficulty, cause the failure.

2. **Fixation is measurable** (2601.06636/DD#744): MedEinst's "Bias Trap Rate" quantifies how often models give the wrong answer on trap cases despite giving the right answer on matched control cases. This isolates fixation from incompetence — the model CAN reason correctly, but the trap stimulus prevents it.

3. **Fixation compounds in multi-agent systems** (2602.00428/DD#745): MANBENCH shows that when one agent fixates, the error propagates through the system and gets reinforced by social influence, becoming collective "misremembering."

4. **Fixation resists prompting** (2502.04381): M-ARC shows LLMs are systematically overconfident on fixation-inducing tasks — they don't know they're fixated. Uncertainty estimation fails specifically on these tasks.

5. **Reasoning capability partially overcomes fixation** (2601.11866): Strong reasoning models reduce (but don't eliminate) the Einstellung effect. This is a MODEL CAPABILITY effect, not a PROMPTING effect.

### The Template-as-Ceiling Mechanism (Unified Account)

Few-shot examples create iatrogenic harm on discovery tasks through a specific chain:

```
1. EXPOSURE: Agent sees example of how a similar task was solved
2. ACTIVATION: Pattern-matching circuits activate the example's approach
3. FIXATION: Activated pattern blocks exploration of alternatives
   (Einstellung effect — the "set" is locked)
4. TEMPLATE MATCHING: Agent attempts to fit the current task to the example's template
5. FALSE COMPLETION: Output matches template structure → agent reports success
   (overconfidence on fixation-inducing tasks)
6. DEGRADATION: For discovery tasks requiring novel approaches, template match ≠ correct answer
   → systematic performance loss proportional to template rigidity
```

This explains WHY the effect is specifically iatrogenic on DISCOVERY tasks but not on routine tasks:
- **Routine tasks**: The example's template IS (approximately) the correct approach. Fixation helps.
- **Discovery tasks**: The correct approach diverges from any template. Fixation blocks discovery.

## Implications for Our System

### Validated Knowledge Elements
1. **KE-101 Law 2 (Structural > Content)**: ECR-Agent's architectural intervention (forcing dual-pathway causal reasoning) breaks fixation where prompting doesn't. This validates that structural interventions work where content interventions fail.
2. **H-099 (Discovery Boundary)**: The Einstellung effect explains WHY discovery tasks resist all interventions — they require OVERCOMING the pattern-matching that LLMs do by default. You can't scaffold past this with more instructions; you need architectural changes.
3. **KE-002 (Text interventions 0/36+)**: Prompting cannot overcome fixation because the fixation operates BELOW the level of instruction-following. The model doesn't ignore the instruction to "think creatively" — it genuinely believes the template IS creative.

### Actionable Recommendations

#### HIGH PRIORITY
1. **Ban few-shot examples for discovery tasks.** This is now grounded in 6 papers + our own EXP-130. The mechanism is well-understood and the harm is predictable.

2. **Implement "Bias Trap Rate" metric for evaluator.** Adapt MedEinst's methodology: for each evaluation scenario, create paired control/trap versions. Measure fixation separately from competence.

3. **Add cognitive anchoring to cross-session handoffs.** MANBENCH shows 74.40% reduction in collective fixation via cognitive anchoring (establishing ground truth BEFORE encountering inherited context). For our system: each session should verify key claims from inherited context against primary evidence before proceeding.

4. **Add provenance tracking to compaction.** Source scrutiny requires knowing WHERE each claim came from. When context is compacted across sessions, tag which claims originated from which session/agent/source.

#### MEDIUM PRIORITY
5. **Design EXP-131: Anti-example framing.** Instead of showing "here's how to solve this," show "here's approaches that DON'T work for this kind of task." Anti-examples may reduce fixation while still providing guidance.

6. **Design EXP-132: Dual-pathway perception.** Adapt ECR-Agent's DCI for our architecture: force the agent to reason about both "what confirms the obvious approach" AND "what disconfirms it" before committing.

7. **Test interaction protocol variation.** MANBENCH shows different handoff structures produce different susceptibility to collective fixation. Test whether changing agent-to-agent communication protocols reduces error propagation.

### Connection Map
```
EXP-130 (-67pp iatrogenic)
    ↑ grounds
CR#337 (This synthesis: Einstellung mechanism)
    ↑ draws from
DD#744 (MedEinst)     — Bias Trap Rate, counterfactual methodology
DD#745 (MANBENCH)     — Collective fixation, cognitive anchoring mitigation
DD#746 (OCW)          — Foundational Einstellung in LLMs, red herrings
    ↑ extends
H-099 (Discovery boundary) — WHY discovery resists scaffolding
CR#335 (Error propagation) — MANBENCH validates the lifecycle
KE-101 (Five Laws)         — Law 2 confirmed by ECR-Agent
KE-002 (0/36+)            — Fixation below instruction-following level
```

## Tags
Einstellung effect, fixation, few-shot iatrogenesis, template-as-ceiling, discovery tasks, bias trap rate, cognitive anchoring, error propagation
