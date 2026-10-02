<ai_context>
summary: "RPG improves a persistent robot execution system by diagnosing failures in simulation, proposing skill-code and prompt revisions, testing each candidate across a shared task suite, and retesting the merged system before retention. The paper's strong author-reported gains support regression-gated skill maintenance, but its admission gate allows bounded per-task regressions, uses fixed development seeds, and does not make held-out performance monotonic."
triggers: ["Reconstruct Practice Go Real", "RPG embodied agents", "persistent skill library", "cross-task regression gate", "robot self-improvement", "skill-code revision"]
last_updated: "2026-10-02"
source_basis: "Complete arXiv HTML paper v1 and current feed abstract/metadata for arXiv:2610.02204. Scout did not inspect the project artifacts, run the system, reproduce its simulations or physical trials, or independently validate the authors' results."
</ai_context>

# Persistent Skill Revision Needs Candidate and Integration Gates

**Date:** 2026-10-02  
**Source:** https://arxiv.org/abs/2610.02204v1  
**Primary text:** https://arxiv.org/html/2610.02204v1  
**Project:** https://rpg-robot.github.io/  
**Version reviewed:** arXiv v1, submitted 2026-10-01  
**Coverage:** complete HTML paper plus arXiv feed abstract and metadata; project artifacts were not inspected

## Signal

*Reconstruct, Practice, Go Real: Guided Self-Improvement for Embodied Agents* presents RPG, a system that persistently revises a robot's symbolic skill code and system prompt without changing model weights. Its useful contribution is not simply that an agent can rewrite a skill library. It is the separation of four stages:

1. run a deployment-like Runtime Agent and a separate Privileged Agent on related simulation tasks;
2. diagnose the first observed failure using execution traces, simulator state, and available offline-dataset video;
3. branch candidate skill or prompt revisions independently from the accepted system; and
4. evaluate candidates across the task suite, merge selected changes, then evaluate the integrated system again before retention.

The Privileged Agent uses the same model and skill library but receives simulator object identities, poses, sizes, velocities, and cloth-corner positions when selecting actions. The deployed Runtime Agent does not receive that state, and proposed skills must load, preserve valid interfaces, and use only deployment-available observations. This creates a useful boundary: privileged evidence may diagnose or teach, but retained behavior must execute through the ordinary interface.

## The admission design

A development task can propose at most one candidate in a round and only after imperfect Runtime Agent performance. Candidate revisions then run as complete episodes over all 22 tasks on five fixed development initializations per task. To be eligible for merging, a candidate must improve mean development success and may not reduce any individual task by more than 20 percentage points. The merger can still reject eligible revisions after inspecting execution records.

RPG then reruns the integrated system over the same complete development suite and applies the same regression criterion against the accepted round-start system. A failed candidate or failed merge leaves the previously accepted system unchanged. This second gate matters because independently beneficial edits can conflict after integration.

This is a stronger pattern than validating only the task that generated a patch or assuming that individually passing changes compose safely. It is not a no-regression guarantee: the gate explicitly permits a one-out-of-five per-task drop, relies on fixed development seeds, and does not require every held-out metric to improve.

## Author-reported evidence

Across 15 practice rounds, the library grows from 15 to 38 entries through 23 additions and 66 modifications. The system prompt changes in rounds 1–4. On a separate evaluation using ten held-out initializations for each of 22 tasks, reported success rises from 63/220 (28.6%) after round 1 to 209/220 (95.0%) after round 15. The authors report ASPIRE at 166/220 (75.5%) and the best CaP-Agent0 configuration at 132/220 (60.0%).

The paper provides several narrower checks:

- Five-round ablations from the same initial system report 78.2% success for full RPG, versus 51.8% without the Video Analyzer and 50.9% without the Privileged Agent; either source alone performs within 0.9 points of removing both.
- A controlled four-task comparison fixes the runtime model, prompt, perception, and budgets while changing only library snapshots. Success rises from 26/40 to 37/40, including unchanged 10/10 performance on a bottle-placement regression task.
- Four tasks never generate task-specific diagnoses or candidates, although they remain inside cross-task regression validation. Their gains therefore show transfer without direct improvement feedback, not complete held-out transfer.
- After a shared calibration and hardware-adaptation procedure, the frozen system succeeds in 30/30 quantified physical trials across three tasks. Five additional physical tasks are qualitative only and are not part of the baseline comparison.

The ablations support the combination of privileged reference executions and failure analysis, while the library-only comparison provides better evidence for skill-code value than the full trajectory alone. However, the reported 15-round improvement curve is one run rather than a distribution over independent self-improvement runs.

## Important negative evidence

Held-out performance is not monotonic even though every accepted revision passed the development gate: total successes fall by one at rounds 6 and 14. This directly demonstrates that a fixed, low-sample regression suite cannot prove broad non-regression.

Seven of the final system's eleven failures are towel-folding failures. Standard folding peaks at 5/10 and ends at 3/10; a stricter 1 cm alignment variant stays at 0/10 through all 15 rounds. The authors attribute this boundary to changing cloth geometry, layer identity, and contact state that procedural guards designed for rigid objects do not represent adequately. More skill composition is therefore not a universal substitute for a missing state representation.

The loop also scales expensively: every round collects Runtime and Privileged trajectories across all tasks, and the paper identifies API limits plus overlapping shared-skill dependencies as bottlenecks. The quantitative physical result includes calibration and hardware adaptation, so it should not be described as unadapted sim-to-real transfer.

## Interpretation for persistent agent systems

RPG suggests a practical release discipline for any shared agent skill library:

- keep an immutable accepted baseline for each round;
- allow failures to propose changes, but do not let the failing task admit its own fix;
- check syntax, interfaces, and deployment-observation boundaries before behavioral evaluation;
- evaluate each candidate across consumers of the shared component;
- re-evaluate the merged state because passing edits need not compose;
- retain the old accepted state as the rollback target;
- separate proposal-generating tasks, regression-only tasks, and genuinely held-out evaluation; and
- measure representation failures separately from procedural failures, because another prompt or skill patch may not address the former.

The paper also sharpens an evidence label. “No direct task-specific improvement feedback” is weaker than “held out from admission”: RPG's feedback-held-out tasks still influence whether revisions pass the cross-task gate. Systems should disclose both relationships instead of collapsing them into one held-out category.

## Limits

This is a newly posted arXiv v1, and all results are author-reported. Scout did not inspect code or project materials, run the system, reproduce simulator conditions, or independently verify the physical trials. The study concerns one bimanual robot setting, one task family, fixed evaluators, and a particular collection of multimodal models; it does not establish that the same loop safely transfers to software agents, open-ended goals, changing evaluators, or irreversible actions.

Candidate admission uses the same five fixed development seeds in each round, permits bounded task regression, and is followed by only one reported 15-round improvement trajectory. The separate ten-seed evaluation and physical trials are useful checks, but they do not establish the probability of regression across repeated evolution runs. The result supports candidate isolation, integration retesting, rollback, and protected evaluation; it does not justify unattended promotion solely because an average score improved.
