# Skill Pruning Complete — 2026-04-08

**Commit**: `331b21ef` on agents/main  
**Audit**: `skill-pruning-audit-2026-04-08.md`  
**Knowledge Entry**: KE-025 (instruction overhead paradox)

## What Was Done

Removed 23 skill files (90KB) from Coach and Evaluator per the audit recommendations.

### Coach: 16 files removed (79KB savings)
- `agent-conventions/` — 7 files (43KB) — reference docs redundant with `docs/agent-convention.md`
- `convention-exercises/` — 4 files (15KB) — unused templates (0 outcome references)
- `growth-cycle.md`, `reactive-lesson.md`, `micro-reward.md`, `transient-skill.md` — near-zero usage methodology
- `red-team.md` — duplicate of `red-team/SKILL.md`

### Evaluator: 7 files removed (11KB savings)
- `detect-drift.md` — duplicate of `detect-drift/SKILL.md`
- `manage-backups/SKILL.md` — duplicate of `manage-backups.md`
- `detect-p53-drift/SKILL.md` — dead (missing .cjs entrypoint)
- `drift-controller/SKILL.md` — orchestration logic already in heartbeat
- `challenge-agent.md`, `revert-change.md`, `verify-skill.md` — 0-1 delegations

## Verification

### Coach remaining (4 files, 14.8KB):
| File | Size |
|------|------|
| `red-team/SKILL.md` | 4.3KB |
| `consolidate-memory.md` | 4.5KB |
| `verify-after-edit.md` | 3.1KB |
| `log-error.md` | 2.8KB |

### Evaluator remaining (6 files, 21.6KB):
| File | Size |
|------|------|
| `monitor-session.md` | 10.9KB |
| `score.md` | 5.8KB |
| `manage-backups.md` | 2.1KB |
| `detect-drift/SKILL.md` | 1.4KB |
| `patrol.md` | 747B |
| `delegation-metrics.md` | 640B |

## Impact Summary
- Coach system prompt skill content: **94KB → 15KB (84% reduction)**
- Evaluator system prompt skill content: **33KB → 22KB (33% reduction)**
- Total savings: **~90KB of instruction overhead removed**

## Follow-up Items
1. **Monitor Coach/Evaluator sessions** for 24-48h to confirm no regressions
2. **Phase 4**: Trim `monitor-session.md` (10.9KB) to essential usage instructions (~3KB)
3. **Fix `ops-receipts.jsonl`** — only 11 lines, last written 2026-03-14, drift detection pipeline non-functional
4. **Fix `compliance-snapshot.json`** — doesn't exist, patrol always reports CRITICAL
