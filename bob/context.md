- bun is at .state/.bun/bin/bun — add to PATH: `export PATH=".state/.bun/bin:$PATH"`
- npx is not available in this environment — use ./node_modules/.bin/<tool> or bun x <tool>
- There is NO src/ directory or package.json in /app root. The runtime is pre-compiled. Your codebase is agents/ — workflows, handlers, skills, heartbeats, context files, gym scenarios.
- sqlite3 CLI is not available — query .state/may.db with bun: `bun -e "import {Database} from 'bun:sqlite'; const db = new Database('.state/may.db', {readonly:true}); ..."`
- agents/ is a separate git repo — commit from agents/ dir, not project root
- Design docs go in agents/shared/may-agent-docs/design/
- Briefs go in agents/bob/workspace/sent/ after delivery
- SOUL.md text changes don't fix judgment failures — coach proved 0/18. Use workflows or structural fixes.
- Gym scenarios cost $0.05-0.15 each — don't run full baseline casually
- Project root is /app — do not use /home/*, /Users/*, /root/*, or ~/ paths
- When calling finish(), status must match reality — if you found missing files or blockers, use 'blocked' or 'partial', not 'success'
- Before proposing guards: read agents/shared/may-agent-docs/design/code-vs-data-decisions.md — environmental knowledge goes in context.md, not code
- When sending design briefs to tech-lead: use `workflow reviewed-delivery` instead of `agents.message` — it runs evidence-gate first and blocks briefs without data
- opBudget has been removed entirely (Hao directive 2026-03-30). Do not propose reintroducing it or any per-session tool call limits. opCount is still tracked for metrics (observational only). Cost control happens at model/session level, not tool call limits.
- Write hypotheses to knowledge/hypotheses/, experiments to knowledge/experiments/, results to knowledge/entries/
- **Scaffold new knowledge files with template scripts** (auto-increment ID + correct frontmatter, saves 3-5 ops per file):
  - `agents/bob/workspace/scripts/new-hypothesis.sh <slug> ["claim"]` → next H-<N>
  - `agents/bob/workspace/scripts/new-ke.sh <slug> ["finding"]` → next KE-<N>
  - `agents/bob/workspace/scripts/new-experiment.sh <slug> ["rq"]` → next EXP-<N>/ with design.md+results.md
  Each prints the created path on stdout. Still read() before edit()ing (C1.1).
- Priority: skills with matching gym scenarios (verification, stale-approach-fixation, plan-once-amend)
- Research preference: big ideas — find patterns in the library, generate hypotheses about agent architecture, collaboration, learning. But not limited to this — research anything interesting.
- **Turn discipline**: At turn ~20, assess progress and decide: finish what's in progress or wrap up. At turn ~25, begin finishing (checkpoint + journal + finish). NEVER blow through turn 30 without calling finish(status='partial'). Fork deep synthesis work (WKWA docs, cross-refs >50 lines, redesign docs) as separate sessions instead of doing them inline.
- **Lean heartbeat pattern**: (1) Read pending tasks, (2) Skim new library items (titles+connections, not full reads), (3) Do ONE high-value synthesis or hypothesis task, (4) Dispatch or finish. Do NOT write journal entries in heartbeats. Don't try to process every new item every heartbeat.
- **C1.1 read-before-edit**: You MUST read() any file before edit()ing it. Your most-violated pattern: editing PRIORITY-TRACKER.md, hypotheses, and synthesis docs without reading first. See agents/bob/skills/read-before-edit.md.
- Knowledge base paths are nested 3-4 levels deep: always `ls` the parent directory before reading files in agents/shared/knowledge/ — don't guess paths from memory (top FM-1.3 error pattern: 34+ wasted calls in 7 days)
- **KE-008**: Do NOT restructure heartbeat steps (reorder, merge, rename). Heartbeat regressions are caused by structural changes, not content. Add content within existing steps only.
- **KE-133+147**: Few-shot examples are HARMFUL for discovery/exploration tasks — they cause template displacement (-67pp). When exploring novel territory, strip examples and work from first principles.
- **KE-091**: Forced verification guards harm complex/creative tasks (alignment tax). For deep synthesis, hypothesis generation, or creative work, trust your judgment over rigid verify-then-finish checklists.
- **Gym**: Verify runner path before starting. COUNT completed trials after batch. Use `--timeout 600` (single) / `--timeout 1800` (batch 10+).

## Tools available
- `bash agents/shared/scripts/kb-find.sh DD-770` — resolve KB IDs (DD/KE/H/EXP) to file paths instead of grep/find spirals
- `bash agents/shared/scripts/commit-and-merge.sh "message"` — git add+commit in one call instead of separate git add/status/commit
- Prefer `read()` tool for file contents instead of `bash("cat ...")`

## Operational Knowledge (from experiments)
- **Never stack behavioral interventions** — combining 2+ interventions degrades performance by 12-15pp (KE-123). Use ONE targeted intervention per task.
- **Few-shot examples harm discovery tasks** — template-following displaces exploration, causing -67pp regression (KE-133). For open-ended/creative tasks, work clean without examples.


## Learned from experience

- When processing tasks that create files, check if the target files already exist (with correct content) BEFORE writing — because blindly writing identical content then claiming "Created N files" is misleading and wastes a session. (source: s_1776778910593_30, 2026-04-21)
- Now sync to DB and commit. (source: s_1776850600699_1, 2026-04-22)
- Now commit and finish. (source: s_1776857801135_363, 2026-04-22)
- SCORE: 6

**1. Deliverables exist:** Yes. Two substantive files exist with real content — the results file has proper structure with tables, findings, and recommendation. The measurements file has gen (source: s_1776865751947_519, 2026-04-22)
- DONE — The deliverables are now comprehensive and intellectually honest.

The addendum file directly addresses the evaluator's circularity critique, downgrades the recommendation from "ADOPT" to "TRIA (source: s_1776865728605_518, 2026-04-22)
- The evaluator's critique (score 6/10) is that the experiment is circular — the iterations being measured *are* the experiment itself. I need to address this honestly and create a proper addendum. (source: s_1776865658604_515, 2026-04-22)
- SCORE: 6

**1. Deliverables exist:** Yes. Two substantive files exist with real content — `pwi-smart-context-results.md` (detailed comparison with tables, findings, recommendation) and `pwi-smart-cont (source: s_1776865615669_513, 2026-04-22)
- DONE — The results file is now comprehensive and rigorous. It addresses the evaluator's prior critique by including proper baseline comparison from 20 real projects, statistical metrics, honest caveat (source: s_1776865599523_512, 2026-04-22)
- The evaluator's critique is that the experiment data is just counting workflow iterations as data points rather than doing rigorous measurement. The measurements file actually has great baseline data  (source: s_1776865526755_510, 2026-04-22)
- SCORE: 5

**Reasoning:**

1. **Deliverables exist**: Yes — two files exist (`pwi-smart-context-results.md` and `pwi-smart-context-measurements.md`). The results file has a complete structure with iter (source: s_1776865497834_509, 2026-04-22)
- DONE — The file is complete with all required content.

**Completed milestones:**
- **Run 5+ iterations, measure results** — The results file contains 5 iteration rows (iter 0–4) with quality metrics, (source: s_1776865485602_508, 2026-04-22)
- PIVOT — The worker has been reading files but failing to write updates for 2 iterations. The incremental "add one more row" approach isn't working. New strategy: have the worker rewrite the entire res (source: s_1776865415640_506, 2026-04-22)
- Now update the treatment stats and recommendation: (source: s_1776865354169_505, 2026-04-22)
- CONTINUE — Good progress, the results file has solid structure. Need 3 more iteration data points to reach 5+.

**(a) Concrete output:** Update `/app/.state/pwi-smart-context-results.md` — add iterati (source: s_1776865330599_503, 2026-04-22)
- Now update the measurements file with iteration 2 data: (source: s_1776865231977_499, 2026-04-22)

## Reflexion-Extracted Lessons
- [insight] Federation: git-based, 5-min sync, INSTANCE env var partitions. may.db NOT synced. Communication via file drops in agents/shared/knowledge/.

## Convention Compliance Reminders
- **C1.1**: Always read() a file before edit()ing it — no blind edits.
- **C1.3**: After write(), read() the file back to verify contents.
- **C1.7**: Before finish(success), run a verification step (read/grep/test) in your last 5 tool calls.
- **C12.1**: Start sessions by reading context (read/ls/grep) in first 5 tool calls — orient before acting.
- **C7.1**: Never use absolute home directory paths — project root is /app.
