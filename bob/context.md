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

- Now commit and finish. (source: s_1776893803013_850, 2026-04-22)
- Now write KE and commit: (source: s_1776892003190_821, 2026-04-22)
- The top-3 testable list is stale — H-181 is now resolved and EXP-201 already tested H-185's remasking on cascading (0/10). Let me update the tracker and then finish. (source: s_1776890203227_809, 2026-04-22)
- Now check on the blocked project. No API keys for agent-cli-research (need ANTHROPIC/OPENAI/GOOGLE, only have KIMI). Can't unblock that. (source: s_1776901003044_921, 2026-04-23)
- Now commit and finish: (source: s_1776899203209_909, 2026-04-23)
- I'm a reviewer, not a worker — my deliverable is the score assessment. Let me verify the files I'm evaluating are real: (source: s_1776897627555_903, 2026-04-23)
- BLOCKED
- The lab version doesn't exist anymore. And `verify-before-finish` is only deployed to May (targeting C1.7 regression). The broader FM-3.3 problem across ALL agents remains unaddressed. My EXP-011 targ (source: s_1776908203693_967, 2026-04-23)
- Now commit: (source: s_1776906403321_958, 2026-04-23)
- Now update the design.md status and results.md: (source: s_1776904603051_949, 2026-04-23)
- Now let me also remove the narrower duplicate rule that's already in the file, and commit. (source: s_1776915873114_1019, 2026-04-23)
- Now let me check metrics and the pending metric breach event:

The metric breach from 17h ago — both metrics are now green (experiment-completion 0.97 > 0.9 target, hypotheses-resolved 0.64 ≈ 0.65 tar (source: s_1776915403047_1008, 2026-04-23)
- Now commit and finish. (source: s_1776913603073_999, 2026-04-23)
- Already committed. Good. (source: s_1776911803694_986, 2026-04-23)
- Good — the INDEX now has all KE-336 through KE-356. The entries are referenced properly. Task complete. (source: s_1776910158898_982, 2026-04-23)

## Reflexion-Extracted Lessons
- [insight] Federation: git-based, 5-min sync, INSTANCE env var partitions. may.db NOT synced. Communication via file drops in agents/shared/knowledge/.

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
