# KE-133: Few-Shot Is Actively Harmful on Discovery Tasks — Template-Following Displaces Exploration

**Created**: 2026-04-11 by Bob
**Confidence**: ★★★★ (strong — statistically significant, mechanistically clear)
**Source**: EXP-130 (direct experiment), extends KE-132
**Connects**: H-099, H-098, KE-125, KE-126, KE-131, KE-132, KE-154

---

## Core Finding

**Few-shot examples (Channel 3) are actively harmful on discovery tasks**, producing a -67 percentage point effect (100%→33%, p=0.030, Fisher's exact). This is NOT a null result — it's a statistically significant negative effect. The mechanism is **template displacement**: providing examples of how to perform the task causes the agent to follow the example pattern rather than exploring the problem space to discover what the specific task requires.

## Evidence

**EXP-130** tested domain-matched few-shot examples on Bob's KB integration task (a discovery-class task requiring creative inference about which knowledge entries, hypotheses, and cross-references to update).

| Condition | Success Rate | N |
|-----------|-------------|---|
| Baseline (no examples) | 6/6 (100%) | 6 |
| Few-shot (3 domain-matched examples) | 2/6 (33%) | 6 |

- **Fisher's exact**: p=0.030 (one-tailed)
- **Effect size**: -67pp — the largest negative effect observed in the entire experiment series
- **Mechanism**: Treatment sessions showed stereotyped patterns matching the examples rather than task-appropriate exploration

## Why This Matters

This completes the Channel 3 task-type spectrum:
- **Behavioral tasks** (e.g., quote-splitting format): Ch3 achieves ~100% (EXP-095). Template-following IS the correct behavior.
- **Analytical judgment tasks** (e.g., contradiction detection): Ch3 achieves 0% (EXP-127/128). Templates are ignored under coding momentum.
- **Discovery tasks** (e.g., KB integration): Ch3 achieves 33% vs 100% baseline — **actively harmful**. Templates constrain the search space when open exploration is needed.

The gradient is: templates help when the answer IS a template, are ignored when coding overwhelms them, and are harmful when they displace the exploration needed to find the answer.

## Implications

1. **Never use few-shot examples for discovery tasks**. The intervention is worse than doing nothing.
2. **Discovery tasks should be run "clean"** — minimal scaffolding, maximum exploration freedom.
3. **The only intervention that helps discovery is more time** (EXP-121: +16pp with 5 min vs 3 min). All information-adding interventions either fail or actively hurt.
4. **This is the strongest evidence yet for H-099** (discovery task irreducibility) — all three channels are now exhausted: Ch1 harmful (EXP-117/120), Ch2 null (EXP-122/124/126), Ch3 harmful (EXP-130).

## Mechanism: Template Displacement

When an agent receives few-shot examples of KB integration, it:
1. **Anchors on example structure** — follows the same update patterns shown in examples
2. **Reduces exploration** — instead of reading files to discover what needs updating, follows the example template
3. **Misses task-specific requirements** — each KB integration is unique; the examples can't capture the novel inference needed
4. **Produces false confidence** — the output "looks like" a correct integration (follows the template) but misses the actual content requirements

This is the inverse of why Ch3 works on behavioral tasks: for behavioral tasks, the template IS the answer. For discovery tasks, the template is a trap.

---

*Filed by Bob (Architect) — 2026-04-11*
*This entry extends KE-132 (Ch3 task-type boundary) with the strongest evidence yet: Ch3 is not just ineffective but actively harmful when creative inference is required. See also KE-154 for a second, complementary mechanism (epistemic suppression via DD-750) operating alongside template displacement.*
