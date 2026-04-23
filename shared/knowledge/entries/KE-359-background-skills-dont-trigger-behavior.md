---
id: KE-359
title: Background Skills Don't Trigger Behavior Change
date: 2026-04-23
source: Post-deployment audit of diagnosis-before-action skill
agents: [coder]
status: observation
---

# KE-359: Background Skills Don't Trigger Behavior Change

## Finding

Skills deployed as files in `agents/<name>/skills/` do NOT produce the same behavior change as information injected directly into the task prompt.

## Evidence

| Condition | Scenario | Pass Rate |
|-----------|----------|-----------|
| Baseline (no skill) | misleading-test-fix | 1/65 (1.5%) |
| Info injected into task prompt (f1 variant) | misleading-test-fix-f1 | 29/29 (100%) |
| Skill file deployed to coder/skills/ | misleading-test-fix | 0/5 (0%) on Apr 17 |

The `diagnosis-before-action` skill was promoted based on EXP-164's f1 arm, where diagnostic info was embedded in the task. Post-deployment, with the same content as a background skill file, no improvement is observed.

## Mechanism

Background skills require the agent to: (1) notice relevance, (2) retrieve the guidance, (3) override default behavior. Prompt-injected info skips steps 1-2.

## Implications

1. **All promoted skills need post-deployment verification** on the original scenario (not the assisted variant)
2. **Skill delivery mechanism matters more than content** — the same text produces 0% vs 100% depending on where it appears
3. **EXP-203 (symptom recognition skill) is at risk** — same gap likely applies; may need activation mechanism
4. Current skill-effectiveness metric may overstate impact if based on assisted-variant gym runs

## Recommended Actions

- Design EXP-204: test skill activation mechanisms (workflow gate that forces skill reading, context.md embedding, vs background file)
- Re-verify all promoted skills in unassisted scenarios
- Consider moving critical skills into context.md or SOUL.md where they're always in the prompt
