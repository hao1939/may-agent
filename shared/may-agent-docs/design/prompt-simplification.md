# System Prompt Simplification

## Current: 10 files, 36-52KB

```
SOUL.md (7-15KB) — 80% rules duplicated from common-sense.md, 20% identity
DOMAIN.md (2-8KB) — mix of rules + reference info
TOOLS.md (1-4KB) — redundant with tool schema descriptions
shared/LESSONS.md (4KB) — team rules
LESSONS.md (1-8KB) — agent rules
knowledge/INDEX.md (2-10KB) — references
shared/INDEX.md (3KB) — team knowledge
common-sense.md (9KB) — behavioral rules
[generated] Runtime env (0.3KB)
[generated] Available tools (0.1KB)
```

## Root cause

Not too many files — too much duplication. "Verify after write" appears in 11 files (10 SOUL.md + common-sense.md). "No cd" appears in 11 files. Agents wrote rules to their own SOUL.md that already existed in common-sense.md, and nobody cleaned up either copy.

## Proposed: 3 files, 10-15KB

### 1. `common-sense.md` (shared, ~5-8KB) — behavioral rules

Already exists. Already contains the right content. Already referenced by coach, convention checks, and cron jobs. Keep it.

Changes:
- **Deduplicate**: Remove rules that are now only needed here (not in SOUL.md)
- **Human-controlled**: Agents propose changes via requests, human approves. Add a comment at top: `<!-- Human-controlled. Agents: propose changes via agents.send("may", ...) -->`
- **Prune**: Remove rules that are already enforced by tooling (e.g., "don't exceed opBudget" — the system enforces this, the rule is noise)

### 2. `SOUL.md` (per-agent, ~1-3KB) — identity and domain

Slim down from 7-15KB to 1-3KB. Remove all generic rules (they're in common-sense.md). Keep:
- Who you are (2-3 sentences)
- What you specifically do (your responsibilities, not generic agent behavior)
- How you differ from other agents
- Agent-specific constraints (e.g., "coder: do not commit")
- Domain expertise summary (2-3 sentences from current DOMAIN.md)

### 3. `knowledge/INDEX.md` (per-agent, not in system prompt) — references

Already exists. Stop loading it into the system prompt. The agent reads it with `read()` when it needs references. SOUL.md mentions: "Your knowledge index is at knowledge/INDEX.md — read it when you need references."

### Files removed from system prompt

| File | Action |
|------|--------|
| DOMAIN.md | Merge 2-3 key sentences into SOUL.md. Rest → knowledge/ files. |
| TOOLS.md | Delete. Tool schema descriptions are sufficient. |
| shared/LESSONS.md | Proven lessons → common-sense.md rules. Delete file. |
| LESSONS.md (per-agent) | Proven → SOUL.md or common-sense.md. Delete file. |
| shared/INDEX.md | Don't load into prompt. Agent reads on demand. |
| knowledge/INDEX.md | Don't load into prompt. Agent reads on demand. |

### System prompt becomes

```
resolveSystemPrompt():
  1. SOUL.md (~1-3KB) — agent identity + domain
  2. common-sense.md (~5-8KB) — shared behavioral rules
  3. [generated] Available tools (~0.1KB)
  4. [generated] Runtime environment (~0.3KB)

Total: ~7-12KB (down from 36-52KB)
```

First user message (unchanged):
  - Session context (memory, checkpoint, active recall)
  - Task text

## What changes for coaching

Today:
```
Coach finds behavioral gap → writes rule to SOUL.md or LESSONS.md → rule stays forever
```

After:
```
Coach finds behavioral gap → tests in gym →
  Universal rule? → propose change to common-sense.md (human reviews)
  Agent-specific? → edit agent's SOUL.md (identity/constraints only)
  Knowledge? → write to knowledge/ files (not in prompt)
```

The key gate: **common-sense.md requires human approval**. This prevents the unbounded rule accumulation that got us to 52KB.

## What changes for optimization

- One shared file to audit (common-sense.md) instead of 9 SOUL.md files
- Per-agent SOUL.md is tiny (1-3KB) and focused — easy to verify
- Can measure: remove a rule, run gym, compare scores
- Prompt size is predictable: common-sense.md + SOUL.md + generated = X KB

## Migration

1. **For each agent's SOUL.md**: Extract identity (first ~20%). Delete everything that's already in common-sense.md. Merge 2-3 sentences from DOMAIN.md. Target: 1-3KB.
2. **Update resolveSystemPrompt()**: Load common-sense.md + SOUL.md only. Stop loading DOMAIN.md, TOOLS.md, LESSONS.md, INDEX.md files.
3. **Prune common-sense.md**: Remove rules enforced by tooling. Deduplicate. Target: 5-8KB.
4. **Run gym scenarios**: Verify quality doesn't drop.
5. **Delete deprecated files** from the loading path (keep on disk as archive).
6. **Update coach workflows**: New process for rule changes.
7. **Add prompt size logging**: Track system prompt size per session.

## Success criteria

- System prompt < 15KB for all agents (currently 36-52KB)
- Gym pass rates unchanged or improved
- common-sense.md has clear human-approval gate
- Coach has documented process for proposing rule changes
