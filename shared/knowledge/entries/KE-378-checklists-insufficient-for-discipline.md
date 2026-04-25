# KE-378: Pre-Completion Checklists Are Insufficient for Discipline Failures

**Source**: H-EXP-011 (Instruction Adherence Checklist), rejected at 27% catch rate
**Confidence**: High (tested across 33 flagged issues from 14 evaluated sessions)
**Tags**: `compliance` `negative-result` `validated` `experiment-derived`
**Promoted from**: Episodic (experiment result) → Declarative (KE) per H-EXP-018 compression pathway

## Finding

Adding a pre-completion checklist to agent prompts caught only 27% of discipline failures (vs 50% target). The majority of failures (55%) are **mid-session environmental confusion** — path hallucination, wrong directories, tool unfamiliarity — which occur during execution, not at completion time. Checklists at the end can't fix errors already baked into the session.

## Implication

Interventions for agent discipline must target the **point of error**, not the end of session. Mid-session orientation (validated in H-EXP-012 with 58-93% improvement) is far more effective than post-hoc checklists. When designing compliance mechanisms, prefer structural/environmental interventions over behavioral reminders.

## Anti-Pattern

Don't add "remember to check X" rules to agent prompts expecting compliance improvement. Instead, restructure the environment so the correct information is salient at the moment of decision.
