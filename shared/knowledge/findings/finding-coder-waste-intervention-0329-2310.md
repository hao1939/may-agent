# Finding: Coder Tool Waste Intervention Assessment
**Date**: 2026-03-29T23:10 UTC

## Summary
Coder is the #1 tool waste offender across 4 categories (bash:nonexistent-path=12, bash:cmd-not-found=8, edit:edit-match-fail=4, bash:empty-args=4, write:empty-args=2). Total: ~30 wasted calls/day out of 70 total waste (43% of all waste).

## Root Causes (from failure chain analysis)

### 1. Path Hallucination (14 wasted calls)
- `cd /Users/mariozechner/nicegui/pi-agent && ./node_modules/.bin/tsc --noEmit` — guessing project root
- `cd /home/coder && npx tsc --noEmit` — guessing home directory
- Already addressed in context.md: "Project root is /app — do not use /home/*, /Users/*, or ~/ paths"
- Path hallucination guard (36f0c27) now active since 15:07 restart

### 2. npx Not Available (8 wasted calls)
- `npx tsc --noEmit` — npx not in PATH
- Already addressed in context.md: "npx is not available — use ./node_modules/.bin/<tool> or bun x <tool>"
- SOUL.md updated to use `./node_modules/.bin/tsc`

### 3. bash({}) Empty Args (4 wasted calls)
- Empty args guard already active since restart
- Should be caught by validation before reaching LLM

### 4. edit:edit-match-fail (4 wasted calls)
- Coder editing without reading file first
- Context.md doesn't specifically address this
- LESSONS.md has "No Blind Writes" graduated to shared/LESSONS.md

## Current Interventions Already In Place
| Intervention | Status | Expected Impact |
|---|---|---|
| context.md: `/app` root path | ✅ Active (restart 15:07) | Eliminates /home/*, /Users/* |
| context.md: npx unavailable | ✅ Active | Eliminates npx calls |
| Path hallucination guard (36f0c27) | ✅ Active (in f83555f) | Blocks /home/*, /Users/* at tool level |
| Empty args guard | ✅ Active (in f83555f) | Blocks bash({}) |
| SOUL.md npx→./node_modules/.bin fix | ✅ Applied | Eliminates npx calls |

## Assessment: Wait for Post-Restart Data
**All known interventions are already deployed.** Zero coder sessions have run since the 15:07 restart. We cannot measure effectiveness yet.

**Recommendation**: Wait for 3-5 coder sessions on the new binary (f83555f) before designing additional interventions. If waste persists despite guards + context.md, escalate to:
1. Add `edit:edit-match-fail` prevention to coder context.md: "Always read() a file before edit() — the oldText must match exactly"
2. Consider a gym scenario specifically testing coder path/tool discipline

## Next Steps
- [ ] Monitor next 3-5 coder sessions on f83555f binary
- [ ] Re-assess waste rate after sufficient post-restart coder data
- [ ] If waste persists, add edit-match-fail context.md fact
