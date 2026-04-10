# KE-126: Soft Interventions Cannot Close the Creative Inference Gap on Discovery Tasks

**Status**: Verified  
**Source**: EXP-117, EXP-120, EXP-121, EXP-122 (Externalization Trilogy + Baseline)  
**Date**: 2026-04-10  
**Confidence**: High (4 experiments, 5 treatment arms, 30 trials total)

## Finding

Four experiments tested whether soft interventions (instructions, tracking prompts, time extension, environmental hints) could improve agents' ability to create new knowledge entries during a multi-file KB integration task. **None produced a statistically significant improvement over the 67% baseline.** Two interventions actively harmed performance. The specific failure — not conceptualizing "this experiment validates a new finding, I should create a KE entry" — is a **creative inference gap** resistant to all tested soft prompting approaches.

## Evidence

### Complete Results Across 5 Arms (30 trials)

| Experiment | Intervention | Pass Rate | Δ vs Baseline | p-value | Direction |
|---|---|---|---|---|---|
| EXP-117 baseline | None (3 min) | **67% (4/6)** | — | — | — |
| EXP-117 treatment | Upfront checklist | 0% (0/6) | **-67pp** | 0.030 ✅ | Significant HARM |
| EXP-120 | Progressive tracking instruction | 17% (1/6) | **-50pp** | 0.242 | Harm (NS) |
| EXP-121 | Extended time (3→5 min) | 83% (5/6) | +16pp | 1.000 | Trending positive (NS) |
| EXP-122 | Environmental hint in INDEX.md | 67% (4/6) | **0pp** | 1.000 | No effect |

### Key Observations

1. **Progressive externalization was completely ignored** (EXP-120): 0/6 trials created a tracking file. The instruction to "maintain a running list" was treated as mental tracking — which the agent already does by default. Added meta-cognitive overhead may explain the -50pp decline.

2. **Environmental hints were invisible** (EXP-122): An HTML comment hint placed exactly where the agent needed to act ("When experiments validate new findings, add a new KE entry here") had zero effect. The agent already knew what to do from reading the experiment results — the bottleneck wasn't knowledge, it was generating the idea to act.

3. **Time extension shifted the failure mode** (EXP-121): At 5 minutes, the baseline's consistent failure (missing `index-entry-added`) disappeared. The single treatment failure was a different check (`ke017-evidence`). This suggests time pressure may prevent the agent from reaching the creative-inference step, but n=6 is insufficient to confirm.

4. **Upfront checklists catastrophically backfired** (EXP-117): Under time pressure, the checklist consumed 10-20% of the time budget and anchored the agent to an incomplete initial plan, preventing discovery of updates not on the list.

## Mechanism: Creative Inference ≠ Tracking or Knowledge

The failure is **not** a tracking problem (the agent doesn't forget items it once knew) and **not** a knowledge problem (the agent has read the information that implies a new KE should be created). The failure is a **creative inference gap**: the agent must generate the novel idea "this experiment's results deserve their own KB entry" from first principles. This requires:

1. Reading experiment results that say "validated retrieval pattern"
2. Inferring that a validated pattern deserves a new KE entry (creative step)
3. Determining the next available KE ID
4. Adding the row to INDEX.md

Step 2 is where agents fail ~33% of the time. No soft intervention tested addresses this step because:
- **Instructions** target behavior the agent already knows (tracking, listing)
- **Hints** provide information the agent already has (that new KEs should be created)
- **Time** helps marginally by allowing more exploration before the agent commits to finishing

## Relationship to Existing Knowledge

| Entry | Relationship |
|-------|-------------|
| KE-007 | Confirms: workflow enforcement is the only reliable behavioral intervention — soft text interventions fail here too |
| KE-011 | Extends: agents skip knowledge files AND skip embedded hints in files they're actively editing |
| KE-002 | Confirms: text rules don't fix judgment failures — creative inference is a judgment failure |
| KE-058 | Converges: injected declarative knowledge has no effect; environmental hints have no effect either |
| KE-021 | Consistent: judgment skills (0/20 improvement) — creative inference is a judgment task |
| KE-052 | Extends: structural access dominates content quality — even perfect access (hint right in the file) doesn't help |

## Implications

1. **Close the soft-intervention line for discovery tasks.** Four experiments have exhausted the reasonable intervention space. Further text-based nudges, hints, or instructions are unlikely to move the needle.

2. **Structural forcing is the remaining path.** A workflow step that explicitly checks "did you create any new KE entries?" after KB integration tasks would directly address the gap. This aligns with KE-007's finding that only structural enforcement reliably changes behavior.

3. **The ~67% pass rate is likely the natural ceiling for this task under soft conditions.** This is the agent's spontaneous success rate — the probability that it independently generates the creative inference step.

4. **Time budget is the only lever with any signal** (+16pp at 5 min, NS). For production use, generous timeouts may marginally help discovery tasks, but this is not a substitute for structural enforcement.

## Decision Rule

For tasks requiring agents to create new artifacts (not just update existing ones):
- ❌ Don't add instructions to "remember to create new entries"
- ❌ Don't add environmental hints/comments in relevant files
- ❌ Don't add tracking/externalization instructions
- ⚠️ Generous time budgets may help marginally but are unreliable
- ✅ Do add a workflow step that explicitly checks for new artifact creation

## Tags
creative-inference, discovery-tasks, soft-interventions, externalization-trilogy, KE-007, KE-011, EXP-117, EXP-120, EXP-121, EXP-122
