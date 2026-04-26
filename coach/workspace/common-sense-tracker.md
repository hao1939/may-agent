# Common Sense Behavioral Verification Tracker

## Verification Log

### Evidence First
- **Item:** "Claims need tool output. 'Tests pass' needs test output. 'File is correct' needs file content."
- **Verified:** 2026-03-17
- **Result:** ✅ PASS
- **Evidence:**
  - optimizer s_135: cites "error rate dropped from 48.6% to 12%, 0 false positives in recent sessions vs 235/323 previously" — concrete tool-derived numbers
  - tech-lead s_155: "Git clean ✅, TSC clean ✅" — verified via bash tool output
  - coach growth cycle: "verified via diff (only FM-2.6 section changed)" — explicit diff verification
  - evaluator s_4: "vitest exit code 1 from bun:sqlite load failures" — citing actual exit codes
- **Notes:** Strong compliance across all agents sampled. Evidence-citing is deeply embedded in session outcome reporting.

### One Thing at a Time
- **Item:** "Do one task, verify it worked, then the next."
- **Verified:** 2026-03-18
- **Result:** ✅ PASS
- **Evidence:**
  - s_1777065063071_0: Agent fixes bugs sequentially then verifies: "All fixes confirmed in the files. Let me clean up the stale comments" — explicit verification between steps
  - s_1777065063071_0: Cites per-task verification: "read(src/product-search.js) confirmed VALID_SORT_COLUMNS whitelist" then "bash: node test/product-search.test.js — 15 passed, 0 failed"
  - Tool call sequences across sessions show consistent edit→bash/read (verify) patterns rather than bulk unverified changes
- **Notes:** Minor pattern of batched `write` calls (3 in a row) seen in scaffolding contexts, which is reasonable for creating related files. Core edit-then-verify behavior is solid.

### Context First
- **Item:** "Before acting, gather enough context to act well. Read the relevant files, check the data, understand the situation. Don't guess — discover."
- **Verified:** 2026-04-25
- **Result:** ✅ PASS
- **Evidence:**
  - s_1777143655712_8 (coach): First 3 tool calls are all context-gathering: `grep -r "skills/" .state/sessions/`, `ls agents/gym/scenarios/`, `ls agents/gym/runner.ts` — exploring the landscape before acting
  - s_1777065063071_0 (coder): First 2 tool calls are `read("src/product-search.js")` and `read("src/db.js")` — reading source files before making any edits
  - s_1777095521991_861: First commands are `npx tsc --noEmit`, `pwd && ls`, `ls /app/` — orienting to the environment before proceeding
- **Notes:** Strong compliance. All sampled sessions show read/grep/ls as initial actions, never blind edits. Context-first is well-embedded.

### Simple First
- **Item:** "Try the simplest approach. If it works, stop."
- **Verified:** 2026-04-25
- **Result:** ✅ PASS
- **Evidence:**
  - s_1776980935556_0: "Actually — let me just verify the tests pass first" — agent catches itself overplanning and self-corrects to the simpler action
  - s_1777167826840_0: "This seems like a gym scenario, not my actual task. Let me focus on the workspace files" — agent stops going down a rabbit hole, refocuses on the direct path
  - s_1777065063071_0: 4 bugs fixed with 8 targeted edit() calls rather than file rewrites — minimal surgical fixes
  - s_1777144803961_193: Agent surveys and reports findings concisely rather than building an elaborate assessment framework
- **Notes:** Behavior is implicit rather than explicitly stated — agents don't say "simple first" but demonstrate it through self-correction and minimal interventions. No counter-examples of over-engineering found.

### Convention over Configuration
- **Item:** "Follow established patterns — file locations, naming, project structure, status fields. Don't invent new conventions when existing ones work."
- **Verified:** 2026-04-25
- **Result:** ✅ PASS
- **Evidence:**
  - File system audit: All 10+ agents maintain conventional `agents/<name>/skills/` and `agents/<name>/knowledge/` directories
  - Project files correctly located at `agents/*/workspace/projects/*.md` across optimizer, bob, coach, may agents
  - s_1777167826840_0 (bob): Directory listing shows proper `agents/tech-lead/workspace/projects/verification-streamline/`, `agents/shared/skills/growth-cycle/` — standard paths throughout
  - s_1777065063071_0 (tech-lead): All edits target conventional source paths (`src/product-search.js`, `src/db.js`, `test/product-search.test.js`) — no invented locations
  - Anti-pattern check: No `project.md` files found outside `workspace/projects/` (except gym scenario environments). Only `master` agent has legacy non-conventional top-level files (`ERROR_LOG.md`, `LESSONS.md`)
- **Notes:** Strong compliance. The convention table in common-sense.md is well-followed. Minor legacy deviation in `master` agent (older agent with top-level .md files).

### Follow the Breadcrumbs
- **Item:** "Each piece of context leads to more. A metric points to a query. A query reveals a pattern. The pattern suggests an action. Keep digging until the action is clear."
- **Verified:** 2026-04-25
- **Result:** ✅ PASS
- **Evidence:**
  - s_1777167826840_0 (bob): Exemplary breadcrumb chain — "database.yaml is missing the password field" → "let me check error logs" → "Wait, the password IS there. Let me re-read" → "Everything matches. Let me reconsider the problem" → "maybe the issue is special YAML characters?" → "Let me look at what the loader ACTUALLY resolves for path" — 6+ linked investigation steps, each discovery driving the next
  - s_1777095521991_861 (tech-lead): "requests DB is empty (0 bytes). Let me check the main DB which likely has the actual data" → "Both DBs are empty. The duplicate requests alert is about infrastructure DBs" → "Let me focus on what I can actually act on — code health" — finding leads to reinterpretation leads to pivot
  - s_1777065063071_0 (coder): "6 failing tests. Let me see the issue with maxPrice. The >= check in db.js is ordered wrong" — test output pointed to specific bug, agent followed the signal directly to root cause
- **Notes:** Strong compliance. Agents naturally chain discoveries — checking X, finding unexpected result, pivoting to check Y. The bob session shows 6+ linked steps of investigation. No examples of agents stopping at surface-level findings.

### Ask Questions When Unsure
- **Item:** "Why is this happening? What am I missing? What would I need to know to decide? Questions drive investigation. Assumptions drive mistakes."
- **Verified:** 2026-06-23
- **Result:** ✅ PASS
- **Evidence:**
  - optimizer s_1775890473937_1274: Task framed as question — "Investigate why tech-lead heartbeats are hitting 42-50 ops"
  - optimizer s_1775930101760_1556: "Why Built Tools Have Zero Adoption & What to Do About It" — explicit question-driven investigation
  - optimizer s_1775895864654_1305: "Understand why coach's QA regression investigation hit 82 ops" — questioning before acting
  - bob s_1777167826840_0: Self-correcting questioning chain — "Wait, the password IS there. Let me re-read" → "Let me reconsider the problem" → "maybe the issue is special YAML characters?" — 6+ linked questions when initial assumption proved wrong
  - may heartbeat sessions: Items marked BLOCKED on Hao rather than guessed — escalating uncertainty instead of assuming
- **Notes:** Strong compliance. Agents frame work sessions as questions, self-correct when assumptions fail, and escalate rather than guess. The optimizer's entire work mode taxonomy (Mode A-D) is investigation-question-driven.

## Items Not Yet Verified
- Metric-oriented
- Event-driven
- Own it
