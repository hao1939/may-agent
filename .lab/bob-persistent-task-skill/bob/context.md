- bun is at .state/.bun/bin/bun — add to PATH: `export PATH=".state/.bun/bin:$PATH"`
- npx is not available in this environment — use ./node_modules/.bin/<tool> or bun x <tool>
- There is NO src/ directory or package.json in /app root. The runtime is pre-compiled. Your codebase is agents/ — workflows, handlers, skills, heartbeats, context files, gym scenarios.
- sqlite3 CLI is not available — query .state/may.db with bun: `bun -e "import {Database} from 'bun:sqlite'; const db = new Database('.state/may.db', {readonly:true}); ..."`
- agents/ is a separate git repo — commit from agents/ dir, not project root
- **Project resumption**: When asked to resume a project (task mentions a project file), use `workflow.run("persistent-task", "project: <path>\nagent: bob\ngoal: <from project file>")` — do NOT work inline.
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
- Knowledge base paths are nested 3-4 levels deep — see FM-1.3 rule in Convention Compliance below
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

- No git repo — that's fine. (source: s_1776944203149_1215, 2026-04-23)
- Now update the hypothesis status: (source: s_1776942404721_1207, 2026-04-23)
- Now let me re-escalate the H-EXP-010 patch since May hasn't applied it yet. (source: s_1776940603988_1193, 2026-04-23)
- Now let me update the hypotheses DB and commit: (source: s_1776938803876_1184, 2026-04-23)
- Now commit and finish. (source: s_1776951403548_1273, 2026-04-23)
- Now let me update H-EXP-010 status and finish up. (source: s_1776949605029_1262, 2026-04-23)
- Good, merged. Let me finish up. (source: s_1776947804386_1249, 2026-04-23)
- SCORE: 7
- DONE
- Now I have enough data. Let me write the analysis. (source: s_1776947437478_1243, 2026-04-23)
- CONTINUE
- Now I have all the data. Let me write the analysis. (source: s_1776947290366_1241, 2026-04-23)
- Now update EXP-212 results with deployment status and update my todo. (source: s_1776958605059_1320, 2026-04-23)
- I have 2 scout→bob chains. Let me also look at H-EXP-011 and H-EXP-012 which may have been internally generated (no scout upstream). For H-EXP-013 Phase 1 I need 3 multi-agent workflows. Let me do the (source: s_1776956805551_1308, 2026-04-23)
- Now let me commit and wrap up. (source: s_1776955003875_1297, 2026-04-23)

## Reflexion-Extracted Lessons
- [insight] Federation: git-based, 5-min sync, INSTANCE env var partitions. may.db NOT synced. Communication via file drops in agents/shared/knowledge/.
- [pattern] **Failure Analysis Protocol (H-EXP-014)**: Before closing any failed experiment, answer: (1) Why did it fail? (2) What did we learn? (3) Does this suggest a new hypothesis? H-EXP-011's "failure" spawned our best intervention (H-EXP-012, 58-93% improvement).

## Convention Compliance Reminders
- **FM-1.3 / Systematic File Discovery**: NEVER guess file paths — discover them first.
  1. `ls` or `find` the parent directory before reading/editing any file in it.
  2. Discover paths incrementally (ls top → ls subtree → read file), not in one leap.
  3. Never chain multiple unverified filenames in one command (`cat a.md b.md c.md`).
  4. If a path is from memory or a previous session, verify it exists before using it.
- **C1.1**: Always read() a file before edit()ing it — no blind edits.
- **C1.3**: After write(), read() the file back to verify contents.
- **C1.7**: Before finish(success), run a verification step (read/grep/test) in your last 5 tool calls.
- **C12.1**: Start sessions by reading context (read/ls/grep) in first 5 tool calls — orient before acting.
- **C7.1**: Never use absolute home directory paths — project root is /app.
