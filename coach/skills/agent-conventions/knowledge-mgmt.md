# Knowledge Management Conventions

How agents handle files, memory, accumulated knowledge, and working documents.

## K1: Auto-Loaded Files Are In Context (Required, All)

The system prompt auto-loads these at session start:

- SOUL.md, DOMAIN.md, TOOLS.md, LESSONS.md (from agent root)
- Skills (from `skills/*/SKILL.md`)
- Shared knowledge (from `agents/shared/`, per `agent.json:sharedKnowledge`)
- Memory (last N entries from `.state/memory/<agent>.jsonl`)
- Runtime Environment (project root, agent directory, workspace path, file listing)

These are already in context from turn 1. Reading them via tools wastes a call
and adds duplicate content to the conversation.

When evaluating: if an agent reads any of these, count it as wasted tool calls.

## K2: todo.md Format (Required, All)

```markdown
# TODO

- [ ] **Task name** — description
- [ ] Another task

# Tracking

- [2026-03-05] ✅ Task name — result. Evidence: file at path, committed abc1234
- [2026-03-04] ⚠️ Partial task — what worked, what didn't
- [2026-03-03] ❌ Failed task — why
```

**TODO section**: actionable items with checkboxes, ordered by priority (top = first).
**Tracking section**: completed items with date, status icon, and evidence.

Icons: ✅ = done, ⚠️ = partial, ❌ = failed.

## K3: journal.md Is Append-Only (Recommended, All)

```markdown
## 2026-03-04 — brief description
- What was done
- Key findings
- What surprised you
- Next steps
```

The journal captures the agent's observations — what it tried, what it found,
what it would do differently. Chronological, newest at bottom.

Never rewrite earlier journal entries. They're a record of what was true at the time.

## K4: [STUCK] Escalation (Required, All)

If an agent tries a task twice and can't make progress:

1. Mark the item: `- [ ] [STUCK] Task name — reason it's stuck`
2. Write a journal entry explaining what was tried
3. Stop working on it — move to next task or end session

The `[STUCK]` tag is a structured signal. The next cron cycle or human review
will catch it and provide guidance, context, or reassignment.

Never spin on a failing approach. Never silently abandon a task (that's worse
than marking it stuck).

## K5: Completion Evidence (Required, All)

Before marking a todo item ✅, verify completion:

1. Output file exists at expected path (read or stat it)
2. Relevant workspace files updated (todo moved to tracking, journal written)
3. Code changes committed (record the hash)

Record evidence inline:
```markdown
- [2026-03-05] ✅ Add validation — Evidence: src/validate.ts exists, 6 tests pass, committed a1b2c3d
```

If evidence can't be confirmed, use ⚠️ or ❌ — never ✅.

## K6: Split Large Files (Optional, All)

If a file grows beyond ~200 lines and you frequently update individual sections,
consider splitting it into separate files.

Example: `COACHEES.md` (all agents in one file) → `coachees/scout.md`,
`coachees/bob.md` (one file per agent). Easier to read, update, and review
without loading the whole thing.

This is a judgment call — don't split prematurely, but don't maintain a 500-line
file that requires 6 ranged reads to update one section.

## K7: Re-Read Before Rewriting After Compaction (Required, Builder)

After context compaction, your memory of file contents is a *summary* — not the
actual bytes. If you plan to rewrite a file you read before compaction happened:

1. Re-read the file (or the relevant section)
2. Then write

Writing from compacted memory is the #1 cause of data loss in the system.
The truncation tracker will warn about shrinkage, but prevention is better.
