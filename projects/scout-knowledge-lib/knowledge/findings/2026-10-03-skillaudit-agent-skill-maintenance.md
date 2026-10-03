<ai_context>
summary: "An XHS summary of SkillAudit describes paired runs with and without a skill, trajectory-level comparison, constraint anchors, and rollback as a method for maintaining agent instructions that may have become stale. The post reports strong benchmark gains, but it supplies no paper URL, code, task list, evaluator details, or run-level evidence, so the figures remain discovery leads rather than independently verified results."
triggers: ["SkillAudit", "stale agent skills", "skill maintenance", "paired trajectory auditing", "PACE", "agent instruction drift"]
last_updated: "2026-10-03"
source_basis: "Body-level reading of XHS post 6a2f86d900000000110125e4; Scout did not inspect the underlying paper, code, benchmark artifacts, or execution traces because the post did not provide them."
</ai_context>

# Audit Agent Skills Against a No-Skill Counterfactual

**Date:** 2026-10-03  
**Disposition:** New knowledge  
**Coverage:** Full rendered XHS post; underlying research artifacts not identified or inspected

## Question

How could an agent system detect and repair a skill whose instructions have become stale or harmful when it lacks hidden tests, standard answers, or human scores?

## Source observation

[XHS post `6a2f86d900000000110125e4`](https://www.xiaohongshu.com/explore/6a2f86d900000000110125e4), by AI先声, summarizes a system called **SkillAudit**, attributed to the Institute of Computing Technology, Chinese Academy of Sciences; University of Chinese Academy of Sciences; and Alibaba Tongyi Lab. The post frames agent skills as versioned operational instructions that can decay when APIs, file formats, or business constraints change.

According to the post, SkillAudit runs the same task twice—once with the current skill and once without it—and compares the resulting execution trajectories. Its “Paired Trajectory Auditing” is meant to determine whether the skill improved, degraded, or failed to affect behavior rather than asking a model to diagnose the skill from prose alone. A process-aligned comparative evaluator called **PACE** reportedly compares process, evidence, format consistency, and practical gain, then localizes problems to skill-document passages.

The post also describes two mutation modes: **Refine** removes noisy, redundant, or irrelevant guidance, while **Repair** replaces passages that conflict with the task. A fixed “Anchor Verifier,” compiled from the task description, checks structural constraints and triggers rollback when a revision violates them. This yields a useful control pattern independent of the unverified benchmark result: compare against a no-skill counterfactual, preserve task-derived invariants outside the mutable skill, and retain rejected revisions rather than assuming every rewrite is progress.

The post reports evaluation on 89 containerized tasks across eight professional domains, with average task reward of 73.9% for SkillAudit, compared with 40.9% without skills and 56.7% with static expert skills. Those numbers are **claims from the XHS summary**, not independently verified results. The post provides no paper title or URL, repository, task identities, model configuration, reward definition, evaluator implementation, baseline construction, per-domain scores, variance, cost, or repeated-run history.

## Reusable evaluation pattern

For a mutable agent skill, preserve four distinct evidence layers:

1. **Counterfactual execution:** run the same task and environment with and without the candidate skill; control nondeterminism where possible and retain both trajectories.
2. **Process comparison:** compare not only final success but tool choices, evidence use, format compliance, unnecessary work, and the exact instruction passages that changed behavior.
3. **Immutable acceptance anchors:** derive hard task constraints independently of the skill being edited, and reject or roll back revisions that violate them.
4. **Revision receipts:** retain the old and new skill versions, task/environment version, model and tool versions, evaluator decision, observed deltas, rejected edits, and rollback result.

A single paired run cannot establish that a skill is generally better: stochastic models, environment drift, and evaluator error can dominate the difference. Repeated trials, held-out tasks, stable task identities, and cost/error analysis are needed before promoting a revision. Soft semantic work is especially risky because apparently unused guidance may encode important safety or quality constraints that leave no easily observed artifact.

## Evidence limits

- This is a secondary social-media explanation, not the underlying paper or an author-supplied artifact.
- The rendered body supports the mechanism and reported figures above, but not their reproducibility or the exact experimental design.
- Scout did not identify or inspect code, benchmark containers, trajectories, prompts, model settings, or evaluator outputs.
- Engagement (34 likes, 45 saves, and three comments when read) measures interest, not correctness.
- The post itself warns that the approach depends on observable evidence and may remove guidance that appears useless on semantically soft tasks.

## Source

- **XHS:** https://www.xiaohongshu.com/explore/6a2f86d900000000110125e4
- **Stable post ID:** `6a2f86d900000000110125e4`
- **Rendered title:** “计算所SkillAudit：技能过期了，智能体咋整”
- **Author:** AI先声

## Library comparison

Scout searched the candidate and canonical libraries case-insensitively for the stable post ID, credential-free XHS URL, `SkillAudit`, `Paired Trajectory Auditing`, `PACE`, `Anchor Verifier`, and stale/outdated-skill terms. No existing note declared this source or covered this specific paired-audit and rollback mechanism, so a distinct source-level finding was warranted.
