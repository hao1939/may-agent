# Lens D — Markdown-parsing regex fragility in handler/cron code

**Session:** s_1776434478606_380  •  **Date:** 2026-04-17

## Objective
Yesterday's P0 was `STATUS_RE` in `project-resume.ts` silently matching 1/4 active projects
because one variation of markdown (`**Status:** value` vs `**Status**: value`) wasn't anticipated.
Find other handler regexes with the same class of failure: silently return 0 matches on
"valid-looking" markdown input, no log, no error, downstream degrades quietly.

## Files examined
- `agents/may/handlers/project-resume.ts` (reference — STATUS_RE at `project-resume.ts:38`, already fixed)
- `agents/may/handlers/daily-brief.ts`
- `agents/may/handlers/lessons-graduation.ts`

(Broader grep across all 33 handlers — only these two plus `heartbeat-context.ts:97` (session-id
regex, not markdown) contained meaningful `.match(...)/.exec(...)` usage on `.md` content.)

---

## Finding 1 — `daily-brief.ts:114-116` "Top issue" extractor

### Code
```ts
// daily-brief.ts:113-117
const content = readFileSync(analysisPath, "utf-8");          // bob/workspace/analysis.md
const match = content.match(/##\s+(?:Top|#1|1\.).*?\n\n(.*?)(?:\n\n|\n##)/s);
if (match) topIssue = match[1].split("\n")[0].trim().substring(0, 120);
else { const sm = content.match(/##\s+Executive Summary\s*\n\n(.*?)(?:\n\n)/s);
       if (sm) topIssue = sm[1].trim().substring(0, 120); }
```

Default on no-match (`daily-brief.ts:110`): `let topIssue = "No analysis available";`
No log / no warn on failure.

### Verdict: **(a) actually fragile** — reproducible silent failure.

### Evidence
Current `agents/bob/workspace/analysis.md:1-8` begins:
```
# Analysis: System Failure Patterns (2026-04-17)
...
## 1. Executive Summary

**Good rate (24h): 80.6% ...
```

Today the **primary** regex matches via the `1.` alternative. But:

1. **Fallback regex is already dead.** Its literal is `## Executive Summary`, but the current
   file uses `## 1. Executive Summary` (`analysis.md:5`). The primary regex's `1.` branch is
   the only thing keeping this working. If bob ever renumbers (e.g., drops the "1. "
   prefix, or re-titles to `## Overview`), BOTH regexes fail silently.

2. **Silent failure on blank-line variations.** Both regexes require the section body to be
   terminated by `\n\n` (blank line) or `\n##`. Reproducible break:
   - If the Executive-Summary section's first paragraph is immediately followed by a
     markdown **table** or **list** with no intervening blank line (a common generator
     output), the capture group swallows up to the next `##` — then `.split("\n")[0]` is
     correct but the logic still works.
   - If the body *starts* with a table/list with no blank line between heading and body
     (`## 1. Executive Summary\n| col | ...`), the `\n\n(.*?)` requirement fails → no match
     → "No analysis available" with no warning.

3. **Non-greedy + multi-line quirk.** `(?:Top|#1|1\.).*?\n\n` with the `s` flag lets `.*?`
   span newlines. On a file where the *next* heading happens to be `## 1. Something Else`
   further down, the regex still latches onto the first `## 1.` heading — that's fine today,
   but any heading starting with `## Top` or `## #1` anywhere earlier in the doc would hijack
   the match.

### Concrete failing input
Save as `bob/workspace/analysis.md`:
```
# Analysis
## Executive Summary
| Metric | Value |
|--------|-------|
| Good   | 80%   |

## 2. Findings
...
```
(Heading has no "1." / "Top" / "#1" prefix, and no blank line between heading and table.)
Both regexes return null → daily brief prints `Top issue: No analysis available` with no log.

### Severity: **medium**
Silent degradation of a daily human-facing notification, 0% error rate in logs.

### Recommended action (follow-up, NOT this session)
Replace with a small parser: split on `^## ` headings, for each section grab first
non-blank non-list line as summary. Or: if match fails, log a warning with the file's
first heading so the next agent can notice.

---

## Finding 2 — `lessons-graduation.ts:85-89` & `:175-176` convention-id regex

### Code
```ts
// lessons-graduation.ts:85-89
const conventionPattern = /\bC(\d+)\b/g;
let match: RegExpExecArray | null;
while ((match = conventionPattern.exec(sharedContent)) !== null) {
  sharedConventionIds.add(`C${match[1]}`);
}
```
Same pattern re-used per-agent at `lessons-graduation.ts:175` (`agentConventionPattern`) to
detect duplicates of shared conventions inside each agent's `LESSONS.md`.

### Verdict: **(a) actually fragile — but dormant.**
Latent silent-mismatch bug: will fire as soon as anyone adopts the `Cx.y` sub-convention
naming scheme inside a per-agent `LESSONS.md`.

### Evidence
The regex `\bC(\d+)\b` captures *only* the integer part. `\b` (word boundary) sits between
the digit and a following `.` (non-word), so against input `"C1.3 convention"`:
- Match: `C1`, captured group `1`.
- The `.3` is silently discarded.

Sub-numbered conventions are in active use in context — see
`agents/tech-lead/context.md:1` mentions of **C1.1** and **C1.3** (passed in via the session
brief above). They do not yet appear inside any `agents/*/LESSONS.md` file
(`grep -cE '\bC[0-9]+\.[0-9]+' agents/*/LESSONS.md` → 0 hits at time of writing), so the
bug is currently latent.

### Concrete failing input
`agents/shared/common-sense.md` contains: `C3.1 apply-suggestion convention`
`agents/coder/LESSONS.md` later gains a line: `Drop C3.2 – superseded by X`

Current logic will:
1. Parse shared → `sharedConventionIds = {"C3"}` (losing the `.1`).
2. Parse coder → see `C3` via `\bC3\b` inside `C3.2`.
3. Flag coder as duplicating shared `C3` — a **false positive**.

Conversely if shared gains `C3.1` and agent legitimately duplicates `C3.1`, the handler
conflates both to `C3` and raises the same "duplicate" — **correct outcome by accident**,
masking the real miss.

### Severity: **low / dormant**
Handler output is an advisory issue list emitted from a cron job — no one is currently
auto-acting on it, so a false positive is self-limiting. But it fits the Lens-D pattern
exactly: silently-wrong with no log, triggered by valid markdown the author never tested
against.

### Recommended action (follow-up, NOT this session)
Change regex to `/\bC(\d+(?:\.\d+)?)\b/g` and treat `C3` and `C3.1` as distinct ids.

---

## Summary table

| Location                                    | Class          | Severity      | Failure mode                                                        |
|---------------------------------------------|----------------|---------------|---------------------------------------------------------------------|
| `project-resume.ts:38`                      | fixed          | (reference)   | STATUS_RE — already patched yesterday                               |
| `daily-brief.ts:114-116`                    | (a) fragile    | medium        | Silent `"No analysis available"` if bob renames/reformat heading    |
| `lessons-graduation.ts:86,175`              | (a) fragile    | low (dormant) | `Cx.y` conflated with `Cx` → false-positive duplicate-convention   |

Two independent handler regexes share the **same anti-pattern**: they read markdown that
other agents write, assume one formatting variant, and on mismatch return null with no
log. Both are one-line fixes.

## Follow-ups (do NOT do this session)
- [ ] Fix `daily-brief.ts:114-116` — add warn-log on no-match, broaden heading tolerance.
- [ ] Fix `lessons-graduation.ts:86,175` — extend regex to capture `Cx.y`.
- [ ] Consider a shared `md-parse` utility for handlers so these three (STATUS_RE, top-issue,
      convention-id) live in one place with tests — dispatch separately if the pattern
      recurs again.
