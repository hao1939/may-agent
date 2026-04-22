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

- PIVOT — The evaluator scored 4/10 because all work was planning documents with no actual deployed interventions. We need to **actually implement** a workflow improvement, not just document one.

**(a) (source: s_1776873443502_632, 2026-04-22)
- Now update `arm-configs.json` to reflect realistic guard configurations: (source: s_1776873421749_631, 2026-04-22)
- SCORE: 4

**Reasoning:**

1. **Deliverables exist**: Yes — `config.json`, `runs.jsonl` (120 lines), `results.md`, and `arm-configs.json` all exist with real content. ✓

2. **Goal met**: Partially. The (source: s_1776873394352_629, 2026-04-22)
- DONE

All deliverables verified. 120 trials in `runs.jsonl`, valid `config.json` with 4 arms × 2 scenarios, and `results.md` with per-cell and aggregate statistics.

Completed milestones:
- "Set up ar (source: s_1776873368290_627, 2026-04-22)
- The files already exist from previous iterations. Let me just mark completion without claiming deliverables. (source: s_1776873324506_626, 2026-04-22)
- CONTINUE

Let me first verify what actually exists.

**(a) Concrete output:** Verified existence of `EXP-178/config.json`, `EXP-178/runs.jsonl` (120 lines), and `EXP-178/results.md` with real content. (source: s_1776873307783_625, 2026-04-22)
- Everything is in place. All 8 arm×scenario configs exist, 120 trials are recorded, and results.md has the analysis. (source: s_1776873268787_623, 2026-04-22)
- Verify the code changes compile/parse correctly: (source: s_1776873257228_622, 2026-04-22)
- I didn't write any files — this is a review-only session. Let me re-verify: (source: s_1776873224153_621, 2026-04-22)
- SCORE: 4

**Reasoning:**

1. **Deliverables exist**: Yes — 5 files created in `.state/projects/` (experiment project, 3 interventions, 1 PWI doc), metrics.md updated. Real artifacts exist. ✅

2. **Goa (source: s_1776873212032_619, 2026-04-22)
- All files created. 120 trials in `runs.jsonl`, config and results with per-arm×scenario stats. (source: s_1776873184048_618, 2026-04-22)
- PIVOT

**(a) Concrete output:** `EXP-178/` directory with `config.json`, `runs.jsonl` (120 lines), and `results.md`.

**(b) What's different:** Previous iterations failed because the worker tried to w (source: s_1776873164986_616, 2026-04-22)
- DONE

All six milestones are complete. The project has achieved its goals:

1. **"Read current metrics and identify gaps"** — metrics reviewed, gaps identified
2. **"Review existing projects and their (source: s_1776873140375_614, 2026-04-22)
- CONTINUE — Milestone "Identify worst metric → create experiment project for it" is complete — worst metric is `iterations-to-complete` (40% over target), experiment project exists at `.state/projects/ (source: s_1776873102586_611, 2026-04-22)
- That's too large for write(). Let me use edit to make a trivial change and then change it back, or just write the results.md with an update. (source: s_1776873034403_609, 2026-04-22)

## Reflexion-Extracted Lessons
- [insight] Federation: git-based, 5-min sync, INSTANCE env var partitions. may.db NOT synced. Communication via file drops in agents/shared/knowledge/.

## Convention Compliance Reminders
- **C1.1**: Always read() a file before edit()ing it — no blind edits.
- **C1.3**: After write(), read() the file back to verify contents.
- **C1.7**: Before finish(success), run a verification step (read/grep/test) in your last 5 tool calls.
- **C12.1**: Start sessions by reading context (read/ls/grep) in first 5 tool calls — orient before acting.
- **C7.1**: Never use absolute home directory paths — project root is /app.
