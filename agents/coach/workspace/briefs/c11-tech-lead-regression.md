# C1.1 Tech-Lead Regression Brief

**Date**: 2026-04-16
**Convention**: C1.1 (read-before-edit)
**Agent**: tech-lead
**Drop**: 100% → 84.4% (65/77, Apr 16)

## Root Cause

Tech-lead had no C1.1 guidance in its context.md. It had C1.3 (read-after-write) since early April, which drove that metric to 98.6%, but C1.1 was never added. The 100% on Apr 15 was likely a small sample or lucky sessions.

Violations hit both workspace files (cold-start-fix.md, projects/*.md) and source files (requests.ts, session-subscribers.ts, finish-guard.ts, may.ts). Pattern: agent edits files it hasn't read in the current session, assuming it knows the contents.

## Intervention

Added context.md entry (single line, per KE-123 no stacking):
```
C1.1 convention: Before every edit() call, you MUST read() the target file first in the same session. Never edit a file you haven't read — even workspace files you "know" the contents of. This applies to ALL files: source code, workspace docs, project files.
```

## Expected Outcome

C1.3 went from 50.9% → 98.6% after identical treatment. Expect C1.1 to recover to ~95%+ within 1-2 days.

## Validation

Monitor C1.1 scores in next daily eval cycle. If no improvement after 48h, consider gym scenario testing.
