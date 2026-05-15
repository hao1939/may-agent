# H-EXP-020 Phase 1: Compression Level Audit

**Date**: 2026-08-28
**Audited**: Last 30 sessions (checkpoints), 61 unique insights extracted

## Methodology

Extracted all `decisions` and `summary` entries from the 30 most recent session checkpoints. Categorized each by compression level:

- **Episodic**: Session-specific progress ("completed 12 baseline trials", "forked gym runs")
- **Procedural**: Reusable how-to knowledge ("must use --agent amy for real runs", "gym defaulted to --agent coder which doesn't exist")  
- **Declarative**: Factual findings ("content injection provides +60pp lift on medium tasks", "80pp agent-identity confound between tech-lead and coder")

## Results

| Category | Count | % | Promoted to KE? |
|----------|-------|---|-----------------|
| Episodic | 42 | 69% | 0 (expected — session-specific) |
| Procedural | 11 | 18% | ~2 (via context.md updates) |
| Declarative | 8 | 13% | ~3 (manually, as experiment results) |

### Current Promotion Rate
- **Procedural insights promoted**: 2/11 = 18%
- **Declarative insights promoted**: 3/8 = 38%
- **Overall promotable-but-lost**: ~14/61 insights had cross-session value; only ~5 got promoted = **64% loss rate**

## Promotable Insights That Died in Logs

1. **"Gym defaults to --agent coder which doesn't exist — all 120 runs were synthetic"** → Should be a KE or at minimum a gym-usage warning. Multiple agents could hit this.
2. **"SQL-injection baseline shifted from expected 33% to 80%"** → Scenario difficulty drift — no KE tracks this.
3. **"80pp agent-identity confound between tech-lead and coder"** → Major experimental finding, only in checkpoint.
4. **"Content injection +60pp on medium tasks"** → EXP-178 key result, written up in experiment doc but not as a standalone KE.
5. **"Cross-agent prescriptions from H-EXP-017 Phase 1 already covered in common-sense.md"** → Meta-insight about knowledge redundancy.
6. **"Schema-organized context reduces violations"** → EXP-212 finding, in experiment doc but no KE.
7. **"Heartbeat pressure scenario needs 5 inbox items + 2 projects + 2 bugs"** → Scenario design pattern, reusable.
8. **"Quick Code Review notifications are duplicate waste"** → Systemic issue, found and lost.
9. **"Amy file fabrication is highest-impact coaching target (12 low-quality sessions in 7d)"** → Coaching priority insight, not persisted as KE.

## Repeated Themes (candidates for automatic detection)

Pattern: **"X is blocked on Y"** appears 4 times across sessions → suggests a "recurring blockers" tracker would surface systemic issues.

Pattern: **Experiment data invalidation** appears 2 times → suggests a "data quality check" should be a standard step.

Pattern: **Agent identity matters for gym runs** appears 3 times → this should definitely be a KE.

## Phase 1 Conclusion

**64% of promotable session insights die in logs.** The current promotion pathway is entirely manual (bob reads checkpoints → decides to write KE). There's no trigger mechanism. 

The biggest gap: **procedural knowledge** (how-to, gotchas) almost never gets promoted unless it directly blocks an experiment. Declarative findings get promoted slightly more because they appear in experiment write-ups.

**Phase 2 recommendation**: Build a simple script that:
1. Scans last N session checkpoints for decisions/summaries
2. Clusters by keyword similarity  
3. Flags any insight that appears 2+ times across sessions as "promotion candidate"
4. Cross-references against existing KEs to avoid duplication
