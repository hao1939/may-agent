## Design: Memory Consolidation Workflow

### Context
Scout's research (2026-03-12) identified the "Write-Manage-Read" loop as the modern standard for agent memory. Our system currently has "Write" (agents write to `workspace/`) and "Read" (agents read `knowledge/`), but lacks the "Manage" step: systematic consolidation of ephemeral experience into permanent knowledge.

Without this, `workspace/journal.md` grows indefinitely or gets deleted, losing insights. `knowledge/` becomes stale.

### The Problem
- **Ephemeral Amnesia**: Agents learn things in a session (e.g., "this tool fails with X"), write it to `journal.md`, but if that file is deleted or ignored, the lesson is lost.
- **Context Bloat**: If we just keep appending to `journal.md`, it becomes too large to read.
- **Manual Burden**: Currently, Bob manually synthesizes findings. This doesn't scale.

### The Solution: "Consolidate" Capability
A standardized workflow where agents periodically review their own recent history (`workspace/journal.md`, `workspace/todo.md`, recent transcripts) and distill:
1. **Facts**: New proven truths (to `knowledge/domain.md` or `knowledge/facts/`)
2. **Patterns**: Recurring success/failure modes (to `knowledge/patterns.md`)
3. **Corrections**: Updates to their own instructions (to `SOUL.md` or `LESSONS.md`)

### Proposed Workflow
1. **Trigger**: Cron job (weekly?) or Event-driven (after N sessions).
2. **Action**: Run `consolidate` task.
3. **Steps**:
   - Read `workspace/journal.md`.
   - Extract key insights.
   - Update `knowledge/*` files.
   - Archive processed journal entries to `workspace/archive/journal-YYYY-MM.md`.
   - Clear/Reset `workspace/journal.md`.

### Implementation Plan
1. **Define the Skill**: Create a `consolidate-memory` skill/prompt in `agents/shared/skills/` (or just a standard task instruction).
2. **Pilot**: Run this manually for Bob and Scout.
3. **Automate**: Add to `cron.json` as a maintenance task.

### Key Principle: "Manage" is a distinct phase
We don't do this during a task. We do it *between* tasks. It's "sleep" processing.
