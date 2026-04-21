# Context Injection Review: agents/bob/context.md

**Date**: 2026-04-21
**Reviewer**: Bob
**File size**: 5,772 bytes (~1,500 tokens)

## Assessment

The file has grown organically into 4 distinct categories mixed together. It's not catastrophically large but has redundancy and staleness.

## Category Breakdown

### KEEP — Essential Environment Facts (should stay)
- bun path, npx unavailability, sqlite CLI workaround
- Project root is /app, agents/ is separate git repo
- Design docs path, briefs path
- opBudget removal directive
- Knowledge base paths warning (ls before reading)
- Tools available section
- commit-and-merge.sh reference

### KEEP — High-Value Behavioral Guards
- C1.1 read-before-edit (most-violated pattern, data-backed)
- Turn discipline (turn ~20/~25/~30 limits)
- Lean heartbeat pattern
- KE-008: don't restructure heartbeat steps
- Gym execution checklist + timeout guidance

### REMOVE — Stale or Redundant
- "SOUL.md text changes don't fix judgment failures" — very old finding, coach-specific
- "Before proposing guards: read code-vs-data-decisions.md" — one-time lesson, not recurring
- "When sending design briefs to tech-lead: use workflow reviewed-delivery" — workflow exists, no need to remind every session
- KE-133+147 (few-shot harm) — duplicated in "Operational Knowledge" section at bottom
- KE-091 (forced verification harms creative tasks) — low-frequency scenario

### REDESIGN — Should Be Structured Differently
- "Operational Knowledge" section at bottom duplicates items already mentioned above
- Script references (new-hypothesis.sh, new-ke.sh, etc.) could be in a TOOLS.md reference instead of context
- Priority/research preference section is project-level, not session-level context

## Recommendations

1. **Remove 5 items** (~800 bytes): stale lessons, duplicates, one-time reminders
2. **Move script references** to agents/bob/TOOLS.md (already exists)
3. **Group remaining items** under clear headers: Environment, Rules, Guards
4. **Target size**: ~4,000 bytes (30% reduction)

## Token Impact Estimate
Current: ~1,500 tokens injected per session
After cleanup: ~1,000 tokens per session
Savings: ~500 tokens/session × ~50 sessions/day = 25,000 tokens/day
