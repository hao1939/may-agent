# Brief: Scout C1.1 Regression — Read Before Edit

**Date**: 2026-04-04  
**Convention**: C1.1 (read before edit)  
**Agent**: scout  
**Severity**: HIGH — dropped from 90% (Apr 2) to 33% (Apr 4)

## Problem

Scout is editing files without reading them first. This violates C1.1 and risks content corruption in shared library files.

## Evidence

| Day | Rate | Trend |
|-----|------|-------|
| Apr 2 | 90% (9/10) | ✅ Baseline |
| Apr 3 | 50% (3/6) | ⚠️ Drop |
| Apr 4 | 33% (2/6) | ❌ Regression |

### Violation Targets (Apr 3-4)
- `agents/scout/journal.md` — edited without read (2x)
- `agents/scout/todo.md` — edited without read (3x)
- `agents/shared/knowledge/library/papers.md` — edited without read (1x)
- `agents/shared/knowledge/library/discoveries.md` — edited without read (1x)
- `agents/shared/knowledge/library/deep-dives/dd505-*.md` — edited without read (1x)
- `agents/shared/projects/memory-architecture-proposal.md` — edited without read (2x)
- `agents/shared/projects/harness-engineering-*.md` — edited without read (1x)

### Pattern
Scout edits its own workspace files (journal, todo) and shared library files blindly. The agent appears to "know" what's in the file and skips the read step. This is the same anti-pattern the `efficient-file-reading` skill fixed for coder, but in reverse: coder needed to grep before reading, scout needs to read before editing.

## Possible Causes
1. **No read-before-edit skill deployed** — scout had `verify-after-edit` (post-edit) but nothing enforcing pre-edit reads
2. **Behavioral drift** — the agent's natural tendency is to edit directly when it "knows" the file structure
3. **Volume increase** — scout may be editing more files per session (research sprints), amplifying the base failure rate

## Intervention (Applied)
1. **Skill file**: `agents/scout/skills/read-before-edit.md` — structured skill with trigger, protocol, anti-patterns, and assertion
2. **Context.md fact**: Added C1.1 critical warning to scout's context.md
3. **Intervention level**: L3 (skill file) + L4 (context nudge) — the same combination that worked for coder's efficient-file-reading

## Expected Outcome
- Target: C1.1 rate back to 85%+ within 24h
- Metric: `convention_checks WHERE agent='scout' AND convention='C1.1'`

## Verification Plan
- Check C1.1 rate for scout at next heartbeat
- If still < 70% after 24h, escalate to L5 workflow enforcement
