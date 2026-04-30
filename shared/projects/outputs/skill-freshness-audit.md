# Skill Freshness Audit

**Generated:** 2026-04-29  
**Total unique skill files:** 185  
**Stale (30+ days without update):** 0 (0%)  
**Oldest files:** 6 days (2026-04-23)

## Summary Stats

| Agent | Count | Oldest (days) | Stale |
|-------|-------|---------------|-------|
| shared | 80 | 5 | 0 |
| bob | 16 | 5 | 0 |
| tech-lead | 15 | 5 | 0 |
| amy | 11 | 5 | 0 |
| coach | 10 | 5 | 0 |
| coder | 10 | 6 | 0 |
| scout | 9 | 5 | 0 |
| optimizer | 8 | 5 | 0 |
| evaluator | 7 | 5 | 0 |
| may | 6 | 5 | 0 |
| amy-kimi | 5 | 5 | 0 |
| qa | 4 | 5 | 0 |

## Key Finding

**No skills are stale by the 30-day threshold.** The entire skill corpus was created or bulk-updated within the last 6 days (since 2026-04-23). This suggests either:
1. The system was recently initialized/deployed
2. A bulk migration or sync operation touched all files recently

This means "staleness" is not currently a useful pruning signal. Alternative quality signals needed:
- Whether the skill is actually referenced/loaded in agent configs
- Whether the skill has evidence of effectiveness (test results, evaluations)
- Whether the skill is a duplicate (many skills appear in both `shared/` and agent-specific dirs)

## Duplication Analysis

Many skills exist as both shared library copies AND agent-specific copies:
- `verify-before-finish` → 9 copies (shared + 8 agents)
- `evidence-over-narrative` → 6 copies (shared + 5 agents)
- `verify-after-edit` → 8 copies (no shared canonical)
- `read-before-edit` → 5 copies (no shared canonical)
- `obstacle-pivot` → 5 agent copies + shared
- `plan-once-amend` → 5 agent copies + shared
- `state-check-before-action` → 5 agent copies + shared
- `know-when-blocked` → 5 agent copies + shared

## Archived/Deprecated Skills (in shared/skills/archive/)

| Category | Count |
|----------|-------|
| untested | 7 |
| disproven | 3 |
| unreferenced | 6 |
| **Total archived** | **16** |

## Full Inventory

| Skill File | Agent | Last Modified | Days | Stale |
|-----------|-------|---------------|------|-------|
| task-instruction-compliance.md | coder | 2026-04-23 | 6 | no |
| diagnosis-before-action.md | coder | 2026-04-23 | 6 | no |
| work-session-scaffold.md | coach | 2026-04-23 | 5 | no |
| verify-quantitative-claims.md | scout | 2026-04-23 | 5 | no |
| verify-after-edit.md | tech-lead | 2026-04-23 | 5 | no |
| verify-after-edit.md | scout | 2026-04-23 | 5 | no |
| verify-after-edit.md | qa | 2026-04-23 | 5 | no |
| verify-after-edit.md | optimizer | 2026-04-23 | 5 | no |
| verify-after-edit.md | may | 2026-04-23 | 5 | no |
| verify-after-edit.md | coach | 2026-04-23 | 5 | no |
| verify-after-edit.md | bob | 2026-04-23 | 5 | no |
| verify-after-edit.md | amy-kimi | 2026-04-23 | 5 | no |
| verification/evaluation-2026-03-19.md | shared | 2026-04-23 | 5 | no |
| verification/SKILL.md | shared | 2026-04-23 | 5 | no |
| tool-interface-protocol/SKILL.md | bob | 2026-04-23 | 5 | no |
| tool-discipline/SKILL.md | shared | 2026-04-23 | 5 | no |
| search-governance.md | scout | 2026-04-23 | 5 | no |
| red-team/SKILL.md | coach | 2026-04-23 | 5 | no |
| read-only-finish-protocol.md | optimizer | 2026-04-23 | 5 | no |
| read-only-finish-protocol.md | bob | 2026-04-23 | 5 | no |
| read-before-edit.md | tech-lead | 2026-04-23 | 5 | no |
| read-before-edit.md | scout | 2026-04-23 | 5 | no |
| read-before-edit.md | qa | 2026-04-23 | 5 | no |
| read-before-edit.md | may | 2026-04-23 | 5 | no |
| read-before-edit.md | bob | 2026-04-23 | 5 | no |
| post-delivery-readback-verification.md | tech-lead | 2026-04-23 | 5 | no |
| patrol.md | evaluator | 2026-04-23 | 5 | no |
| monitor-session.md | evaluator | 2026-04-23 | 5 | no |
| materialize-findings-concise.md | scout | 2026-04-23 | 5 | no |
| manage-backups.md | evaluator | 2026-04-23 | 5 | no |
| log-error.md | coach | 2026-04-23 | 5 | no |
| knowledge-base-navigation.md | bob | 2026-04-23 | 5 | no |
| gym-execution-checklist.md | bob | 2026-04-23 | 5 | no |
| generate-test-case.md | qa | 2026-04-23 | 5 | no |
| finish-before-cleanup.md | tech-lead | 2026-04-23 | 5 | no |
| find-before-read.md | scout | 2026-04-23 | 5 | no |
| file-safety/SKILL.md | shared | 2026-04-23 | 5 | no |
| evidence-over-narrative.md | tech-lead | 2026-04-23 | 5 | no |
| evidence-over-narrative.md | scout | 2026-04-23 | 5 | no |
| evidence-over-narrative.md | optimizer | 2026-04-23 | 5 | no |
| evidence-over-narrative.md | coach | 2026-04-23 | 5 | no |
| evidence-over-narrative.md | bob | 2026-04-23 | 5 | no |
| error-handling/SKILL.md | shared | 2026-04-23 | 5 | no |
| detect-drift/SKILL.md | evaluator | 2026-04-23 | 5 | no |
| deliverable-checklist.md | optimizer | 2026-04-23 | 5 | no |
| delegation-metrics.md | evaluator | 2026-04-23 | 5 | no |
| cross-reference-source-code.md | bob | 2026-04-23 | 5 | no |
| coder-edit-discipline/SKILL.md | shared | 2026-04-23 | 5 | no |
| blocked-capability-escalation/SKILL.md | may | 2026-04-23 | 5 | no |
| batch-processing.md | optimizer | 2026-04-23 | 5 | no |
| README.md | tech-lead | 2026-04-23 | 5 | no |
| README.md | shared | 2026-04-23 | 5 | no |
| README.md | optimizer | 2026-04-23 | 5 | no |
| README.md | may | 2026-04-23 | 5 | no |
| README.md | bob | 2026-04-23 | 5 | no |
| README.md | amy | 2026-04-23 | 5 | no |
| README.md | amy-kimi | 2026-04-23 | 5 | no |
| knowledge-dedup-check.md | scout | 2026-04-25 | 4 | no |
| convention-compliance.md | coder | 2026-04-25 | 4 | no |
| verify-before-finish.md | scout | 2026-04-26 | 3 | no |
| verify-before-finish.md | qa | 2026-04-26 | 3 | no |
| verify-before-finish.md | may | 2026-04-26 | 3 | no |
| verify-before-finish.md | bob | 2026-04-26 | 3 | no |
| LIBRARY.md | shared | 2026-04-26 | 3 | no |
| task-compliance/skill.md | shared | 2026-04-26 | 3 | no |
| multi-file-discovery-completeness.md | coder | 2026-04-26 | 3 | no |
| prerequisite-gap-protocol.md | optimizer | 2026-04-26 | 3 | no |
| security-awareness-when-editing.md | tech-lead | 2026-04-26 | 3 | no |
| establish-working-directory.md | amy | 2026-04-26 | 3 | no |
| persistent-task-workflow.md | bob | 2026-04-26 | 3 | no |
| score.md | evaluator | 2026-04-26 | 2 | no |
| LIBRARY.md | bob | 2026-04-27 | 2 | no |
| verification.md | tech-lead | 2026-04-28 | 1 | no |
| verification.md | coder | 2026-04-28 | 1 | no |
| verification.md | bob | 2026-04-28 | 1 | no |
| verification.md | amy | 2026-04-28 | 1 | no |
| state-check-before-action.md | tech-lead | 2026-04-28 | 1 | no |
| state-check-before-action.md | coder | 2026-04-28 | 1 | no |
| state-check-before-action.md | bob | 2026-04-28 | 1 | no |
| state-check-before-action.md | amy | 2026-04-28 | 1 | no |
| plan-once-amend.md | tech-lead | 2026-04-28 | 1 | no |
| plan-once-amend.md | coder | 2026-04-28 | 1 | no |
| plan-once-amend.md | bob | 2026-04-28 | 1 | no |
| plan-once-amend.md | amy | 2026-04-28 | 1 | no |
| obstacle-pivot.md | tech-lead | 2026-04-28 | 1 | no |
| obstacle-pivot.md | coder | 2026-04-28 | 1 | no |
| obstacle-pivot.md | bob | 2026-04-28 | 1 | no |
| obstacle-pivot.md | amy | 2026-04-28 | 1 | no |
| know-when-blocked.md | tech-lead | 2026-04-28 | 1 | no |
| know-when-blocked.md | coder | 2026-04-28 | 1 | no |
| know-when-blocked.md | bob | 2026-04-28 | 1 | no |
| know-when-blocked.md | amy | 2026-04-28 | 1 | no |
| establish-working-directory.md | tech-lead | 2026-04-28 | 1 | no |
| verify-before-finish.md | tech-lead | 2026-04-28 | 0 | no |
| verify-before-finish.md | optimizer | 2026-04-28 | 0 | no |
| verify-before-finish.md | evaluator | 2026-04-28 | 0 | no |
| verify-before-finish.md | coder | 2026-04-28 | 0 | no |
| verify-before-finish.md | coach | 2026-04-28 | 0 | no |
| verify-before-finish.md | amy | 2026-04-28 | 0 | no |
| reading-metrics.md | tech-lead | 2026-04-29 | 0 | no |
| reading-metrics.md | coach | 2026-04-29 | 0 | no |
| reading-metrics.md | amy | 2026-04-29 | 0 | no |
| reading-metrics.md | amy-kimi | 2026-04-29 | 0 | no |
| closing-the-loop.md | tech-lead | 2026-04-29 | 0 | no |
| closing-the-loop.md | coach | 2026-04-29 | 0 | no |
| closing-the-loop.md | amy | 2026-04-29 | 0 | no |
| closing-the-loop.md | amy-kimi | 2026-04-29 | 0 | no |
| creating-projects.md | tech-lead | 2026-04-28 | 0 | no |
| creating-projects.md | coach | 2026-04-28 | 0 | no |
| creating-projects.md | amy | 2026-04-28 | 0 | no |
| creating-projects.md | amy-kimi | 2026-04-28 | 0 | no |
| epistemic-checkpointing.md | coder | 2026-04-29 | 0 | no |
| breadcrumb-action.md | may | 2026-04-29 | 0 | no |
| adversarial-hypothesis-template/SKILL.md | bob | 2026-04-29 | 0 | no |
| infrastructure-map.md | coach | 2026-04-29 | 0 | no |
| context-rule-gym-ceiling.md | coach | 2026-04-29 | 0 | no |
| post-fix-review/skill.md | shared | 2026-04-28 | 0 | no |
| reading-metrics/skill.md | shared | 2026-04-29 | 0 | no |
| closing-the-loop/skill.md | shared | 2026-04-29 | 0 | no |
| creating-projects/skill.md | shared | 2026-04-29 | 0 | no |

*Note: ~70 shared skills with identical 2026-04-26 timestamps omitted for brevity (all 3 days old, not stale). See Summary Stats for full accounting.*

## Recommendations for Next Steps

1. **Staleness is not the right signal** — use reference/activation analysis instead
2. **Deduplication is the real win** — ~40 skills exist as copies across agents; consolidate to shared + symlinks
3. **Measure effectiveness** — which skills are loaded in sessions? Which correlate with better outcomes?
4. **Archive candidates** — the 16 already-archived skills plus unreferenced agent-specific copies
