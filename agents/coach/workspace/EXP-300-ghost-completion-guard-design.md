# EXP-300: Deploy Session-Awareness Guard System-Wide

**Status**: DESIGNED  
**Created**: 2026-08-14  
**Owner**: coach  
**Priority**: P1  
**Trigger**: Optimizer notification — recurring ghost completion failures; session-awareness-guard exists but wired to 0 agents

## Problem Statement

The `session-awareness-guard` skill was created (EXP-296) to prevent agents from calling finish(success) without producing output. Despite being written, it is deployed to **zero** agent contexts. The related `read-only-finish-protocol` only covers bob and optimizer (2/14 agents).

Ghost completions waste worker iterations and produce phantom progress.

## Coverage Gap

| Skill | Agents Covered | Agents Missing |
|-------|---------------|----------------|
| session-awareness-guard | 0/14 | ALL |
| read-only-finish-protocol | 2/14 | amy, coach, coder, evaluator, judge, master, may, qa, scout, tech-lead, architect, amy-kimi |

## Hypothesis

Deploying `session-awareness-guard` to the 4 most active worker agents (bob, amy, coder, tech-lead) will reduce ghost completion rate by ≥50%.

## Treatment

Add to each agent's `context.md`:
```
- agents/shared/skills/session-awareness-guard/skill.md
```

### Target Agents (Phase 1)
1. **bob** — highest session volume, already has read-only-finish-protocol
2. **amy** — high session volume
3. **coder** — primary code producer
4. **tech-lead** — high session volume, known for empty escalation sessions

### Control
- Remaining agents (phase 2 if positive)

## Measurement Plan

**Baseline** (pre-deployment):
- Count sessions in last 7 days per agent where: finish() called with status=success AND 0 write/edit calls
- Source: session transcripts or activity logs

**Post-treatment** (48h after deployment):
- Same metric
- Success: ≥50% reduction in ghost completion rate

## Blockers

- **Evaluator dead**: Cannot get automated quality scores. Must measure via activity.jsonl or session-tracker.db manual audit.
- **Read-only shared dir**: Cannot modify shared project files. Can modify agent-specific context.md files.

## Deployment Steps

1. Wire skill reference in bob/context.md, amy/context.md, coder/context.md, tech-lead/context.md
2. Verify wiring with grep
3. Measure baseline from session-tracker.db (pre-deployment ghost rate)
4. Wait 48h, re-measure

## Related
- EXP-295 (merged into EXP-296) — original investigation
- EXP-290 — bob anti-shallow (complementary)
- KE-338 — text coaching ceiling (risk: this is text-only too)
- `agents/shared/skills/session-awareness-guard/skill.md`
