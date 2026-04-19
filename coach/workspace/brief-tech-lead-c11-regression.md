# Brief: Tech-Lead C1.1 Regression (Apr 16)

## Summary
Tech-lead C1.1 (read-before-edit) dropped from **100% (72/72)** on Apr 15 to **84.4% (65/77)** on Apr 16. 12 violations across 12 sessions.

## Pattern Analysis

**Two distinct violation categories:**

### 1. Workspace docs edited without read (8/12 violations)
- `workspace/todo.md` — 5 sessions
- `workspace/finding-manager-ts-dead-weight-audit.md` — 1 session  
- `workspace/projects/context-management.md` — 1 session
- `workspace/projects/auto-resume.md` — 1 session
- `workspace/projects/cold-start-fix.md` — 1 session

**Root cause hypothesis:** Tech-lead "knows" its own workspace file contents and skips the read step. The skill text already warns against this ("even workspace files you 'know' the contents of"), but familiarity override is strong — especially for `todo.md` which gets edited nearly every session.

### 2. Source files edited without read (4/12 violations)
- `agents/may/workspace/tools/top5-metrics.ts` — 3 edits in one session
- `src/lib/tools/finish-guard.ts` — 3 edits in one session
- `src/lib/requests.ts`, `src/lib/session-subscribers.ts`, `src/app/may.ts` — multiple edits in one session

**Root cause hypothesis:** Multi-file editing sessions where tech-lead is making related changes across files. Reads the first file, then starts editing others in the same batch without reading each one first.

## Why the Skill Isn't Working

Tech-lead has `read-before-edit.md` skill (promoted). It worked perfectly yesterday (100%). Today's regression suggests:
- The skill works for **deliberate single-file edits** but breaks down during **rapid multi-file sessions** or **familiar workspace files**
- This is a classic "works under low load, fails under pressure" pattern

## Recommended Intervention

**Option A (Preferred): No action yet.** This is day 1 of regression from a perfect score. Monitor for 2-3 days to see if it's a blip or trend. The skill exists and was working — one bad day doesn't warrant intervention.

**Option B (If trend continues):** The existing skill is text-based, which per KE-007 has limited behavioral reliability. A workflow-level guard (e.g., finish-guard check that flags edit-without-read) would be more reliable but is heavyweight for this convention. Only pursue if rate stays below 90% for 3+ days.

## Decision
Monitor. Re-evaluate Apr 18.
