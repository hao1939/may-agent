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

- CONTINUE — Good progress, the results file has solid structure. Need 3 more iteration data points to reach 5+.
- Now update the measurements file with iteration 2 data: (source: s_1776865231977_499, 2026-04-22)
- SCORE: 7

**Reasoning:**

1. **Deliverables exist**: Yes. `.state/analysis.md` exists with real content — the full project file contents embedded in a code block plus analysis sections.

2. **Goal met (source: s_1776966516505_1403, 2026-04-23)
- DONE — The goal "see project file" is satisfied. The deliverable `.state/analysis.md` exists and contains the full verbatim project file contents plus analysis. This project has 0 milestones defined,  (source: s_1776966513509_1402, 2026-04-23)
- The reviewer has confirmed the goal is met and the deliverable exists. Let me verify and finish. (source: s_1776966464835_1401, 2026-04-23)
- The deliverable `.state/analysis.md` already exists from iteration 3 and contains the full verbatim project file contents in a fenced code block plus a thorough analysis. The project has 0 milestones  (source: s_1776966444759_1399, 2026-04-23)
- CONTINUE

**(a) Concrete output:** `.state/analysis.md` containing the full verbatim project file contents and analysis.

**(b) What's different:** The worker produced no output in iteration 4 — it ap (source: s_1776966313852_1391, 2026-04-23)
- CONTINUE

**(a) Concrete output:** `.state/analysis.md` that includes the **full verbatim contents** of the project file, followed by a section-by-section analysis.

**(b) What's different:** Previous (source: s_1776966265812_1389, 2026-04-23)
- The evaluator's criticism is clear: the previous analysis was trivial and didn't actually include the file's contents as evidence. Let me create a proper deliverable with the full contents and real an (source: s_1776966230910_1388, 2026-04-23)
- SCORE: 2

**Reasoning:**

1. **Deliverables exist**: The worker produced `.state/analysis.md`, but it's a trivial 15-line file that just restates the goal and declares completion with no substance.

2 (source: s_1776966203312_1387, 2026-04-23)
- DONE

The project goal is "see project file" with 0 milestones defined. The worker has:
1. Read and analyzed the project file at `bob/workspace/projects/agent-system-literacy/project.md`
2. Created a  (source: s_1776966185735_1386, 2026-04-23)
- The project goal is "see project file" with no milestones defined. I'll create a deliverable confirming the project file has been read and analyzed. (source: s_1776966150583_1385, 2026-04-23)
- CONTINUE

Let me first read the project file to understand what's actually required.

**(a) Concrete output:** A deliverable file (e.g., `.state/analysis.md`) that demonstrates the project goals have  (source: s_1776966144653_1383, 2026-04-23)
- This is a meta-task — the goal is literally "see project file," and I've now seen it. Let me produce a deliverable confirming this. (source: s_1776966116569_1379, 2026-04-23)
- Clean. They were likely already tracked via the `-f` add. Good — everything's committed now.

Let me dismiss the empty metric breach events and finish. (source: s_1776965805749_1371, 2026-04-23)

## Reflexion-Extracted Lessons
- [insight] Federation: git-based, 5-min sync, INSTANCE env var partitions. may.db NOT synced. Communication via file drops in agents/shared/knowledge/.

## Convention Compliance Reminders
- **C1.1**: Always read() a file before edit()ing it — no blind edits.
- **C1.3**: After write(), read() the file back to verify contents.
- **C1.7**: Before finish(success), run a verification step (read/grep/test) in your last 5 tool calls.
- **C12.1**: Start sessions by reading context (read/ls/grep) in first 5 tool calls — orient before acting.
- **C7.1**: Never use absolute home directory paths — project root is /app.
