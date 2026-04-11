# DD#746: Red Herrings — Exploring Einstellung Effect and Creative Problem Solving in LLMs

**Source**: arXiv:2306.11167 (Naeini et al., Jun 2023, v4 Nov 2023)
**Rating**: ★★★★
**Relevance**: Foundational paper establishing that LLMs exhibit Einstellung fixation. Built-in red herrings = deliberate distractors that test pattern override.

## Key Findings

### LLMs Are Fixated by Red Herrings
Using the Only Connect Wall (OCW) dataset — from a quiz show where clue words must be grouped by hidden connections, with deliberately misleading cross-connections (red herrings):

1. **Fixation demonstrated**: LLMs systematically fail when red herrings are present — they fixate on the most obvious (but wrong) connections rather than discovering the correct ones.
2. **Creative problem solving failure**: The task requires associative thinking (Mednick's Remote Associates Test formulation) — finding hidden connections across heterogeneous domains. LLMs fail at exactly the kind of lateral thinking discovery tasks require.
3. **Randomization test**: When red herrings are removed (OCW-Randomized), performance improves — confirming that the misleading stimuli, not task difficulty, drive the failure.

### Cognitive Neuroscience Framework
The paper bridges cognitive neuroscience to LLM behavior:
- **Einstellung paradigm**: Prior exposure to misleading stimuli impedes performance on subsequent problems
- **Fixation effect**: Once a pattern is activated, it blocks access to alternative interpretations
- **Pre-exposure matters**: In cognitive studies, fixation is experimentally induced by pre-exposing participants to orthographically similar incorrect words — directly analogous to few-shot examples

### Key Insight: Red Herrings Are Structural
The red herrings in OCW are not random noise — they are deliberately designed cross-connections that are MORE obvious than the correct connections. This is exactly the structure of:
- Few-shot examples in EXP-130 (example provides obvious template, correct approach requires divergence)
- MedEinst trap cases (surface pattern matches familiar diagnosis, correct diagnosis requires evidence override)

## Relevance to Our System

### Foundational Grounding for H-099
This is the original paper establishing that LLMs exhibit fixation effects in creative problem solving. H-099 claims "discovery tasks resist all interventions" — OCW shows WHY: these tasks require the agent to OVERCOME fixation, and fixation is inherent to how LLMs process patterns.

### EXP-130 Mechanism Explanation
Few-shot examples create red herrings — they establish the "obvious" connection pattern. When the actual task requires a different pattern:
- The example BLOCKS discovery by activating the wrong associations
- The agent fixates on template-matching rather than genuine exploration
- Result: -67pp iatrogenic degradation

### Template-as-Ceiling = Red Herring Fixation
The "template-as-ceiling" mechanism from EXP-130 is precisely the red herring fixation effect:
1. Example provides template (= pre-exposure to misleading pattern)
2. Agent activates template-matching associations (= fixation on obvious connection)
3. Agent fails to discover novel approach (= creative problem solving failure)
4. Agent declares success based on template match (= false sense of completeness)

## Actionable Lessons

1. **HIGH**: When designing few-shot examples for agentic tasks, include DIVERSE examples with deliberately different approaches — reduces single-pattern fixation.
2. **MEDIUM**: For discovery tasks, avoid giving examples at all (validated by EXP-130). Better to give ANTI-examples ("here's what NOT to do") if guidance is needed.
3. **MEDIUM**: OCW dataset could be used as a diagnostic for LLM creative reasoning capability — test whether our agents can solve lateral thinking problems.

## Cross-References
- **EXP-130**: Few-shot iatrogenesis. OCW explains the cognitive mechanism (red herring fixation).
- **H-099**: Discovery tasks irreducible to scaffolding. OCW is the foundational demonstration.
- **DD#744 (MedEinst)**: Clinical domain instantiation of the same fixation effect.
- **DD#745 (MANBENCH)**: Collective version — multi-agent systems amplify individual fixation.
- **KE-002**: Text interventions 0/36+. Prompting cannot overcome fixation; it may amplify it.

## Tags
Einstellung effect, fixation, red herrings, creative problem solving, Remote Associates Test, Only Connect Wall, cognitive bias, foundational
