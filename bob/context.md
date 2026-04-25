# Bob Context (Schema-Organized — EXP-213)

## ⚡ [SESSION START — Read These First]

**Your environment:**
- **Project root is /app** — NEVER use /home/*, /Users/*, /root/*, or ~/ paths
- **agents/ is a separate git repo** — commit from agents/ dir, not project root
- There is NO src/ directory or package.json in /app root. The runtime is pre-compiled.
- Your codebase is **agents/** — workflows, handlers, skills, heartbeats, context files, gym scenarios

**Tools:**
- **bun**: `.state/.bun/bin/bun` — add to PATH: `export PATH=".state/.bun/bin:$PATH"`
- **npx**: NOT available — use `./node_modules/.bin/<tool>` or `bun x <tool>`
- **sqlite3 CLI**: NOT available — query .state/may.db with bun: `bun -e "import {Database} from 'bun:sqlite'; const db = new Database('.state/may.db', {readonly:true}); ..."`
- **KB search**: `bash agents/shared/scripts/kb-find.sh DD-770` — resolve KB IDs to file paths
- **Commit**: `bash agents/shared/scripts/commit-and-merge.sh "message"` — git add+commit in one call
- Prefer `read()` tool for file contents instead of `bash("cat ...")`

**Project resumption:** When you see an active project file (Status: active/in-progress), resume it with `workflow({ action: "run", name: "persistent-task", task: "Resume: <project goal>" })`. Do NOT work on the project inline — persistent-task handles iteration, review, and checkpointing.

**First actions:** Orient before acting. First 3-5 tool calls should be read/ls/grep to understand context.

**Turn discipline**: At turn ~20, assess progress and decide: finish or wrap up. At turn ~25, begin finishing (checkpoint + journal + finish). NEVER blow through turn 30 without calling finish(status='partial'). Fork deep synthesis work as separate sessions.

## ⚡ [BEFORE EDITING ANY FILE]

- **C1.1**: You MUST read() the target file first in the same session. No exceptions. Not even files you "know." This is your #1 violation — 10% of sessions fail this.
- Knowledge base paths are nested 3-4 levels deep: always `ls` the parent directory before reading files in agents/shared/knowledge/ — don't guess paths from memory.

## ⚡ [AFTER EVERY write() CALL]

- **C1.3**: After write(), read() the file back to verify contents. Your #2 violation at 7% of sessions.

## ⚡ [BEFORE CALLING finish()]

- **C1.7**: Before finish(success), run a verification step (read/grep/test) in your last 5 tool calls.
- **C12.1**: Sessions must start with context reads (read/ls/grep) in first 5 tool calls.
- When calling finish(), status must match reality — if you found missing files or blockers, use 'blocked' or 'partial', not 'success'.
- For multi-deliverable tasks: after reading context files, create DELIVERABLES_CHECKLIST.md listing all expected outputs before starting execution.

## ⚡ [RESEARCH WORKFLOW]

**File locations:**
- Design docs: agents/shared/may-agent-docs/design/
- Briefs: agents/bob/workspace/sent/ after delivery
- Write hypotheses to knowledge/hypotheses/, experiments to knowledge/experiments/, results to knowledge/entries/

**Scaffold scripts** (auto-increment ID + correct frontmatter):
- `agents/bob/workspace/scripts/new-hypothesis.sh <slug> ["claim"]` → next H-<N>
- `agents/bob/workspace/scripts/new-ke.sh <slug> ["finding"]` → next KE-<N>
- `agents/bob/workspace/scripts/new-experiment.sh <slug> ["rq"]` → next EXP-<N>/ with design.md+results.md

**Gym**: `export GYM_AGENT_BIN=/usr/local/bin/may-agent` before running gym. Verify runner path before starting. COUNT completed trials after batch. Use `--timeout 600` (single) / `--timeout 1800` (batch 10+). Gym scenarios cost $0.05-0.15 each — don't run full baseline casually.

**When sending briefs to tech-lead**: use `workflow reviewed-delivery` — it runs evidence-gate first.

## ⚡ [GENERAL KNOWLEDGE]

**Research preferences:**
- Priority: skills with matching gym scenarios (verification, stale-approach-fixation, plan-once-amend)
- Big ideas: find patterns, generate hypotheses about agent architecture, collaboration, learning
- DO NOT propose heartbeat-skipping or idle-skip optimizations (removed — heartbeats must always fire)
- opBudget has been removed entirely (Hao directive 2026-03-30). Do not propose reintroducing it.

**Key findings:**
- SOUL.md text changes don't fix judgment failures — coach proved 0/18. Use workflows or structural fixes.
- Before proposing guards: read agents/shared/may-agent-docs/design/code-vs-data-decisions.md
- **Never stack behavioral interventions** — combining 2+ interventions degrades performance by 12-15pp (KE-123). Use ONE targeted intervention per task.
- **Few-shot examples harm discovery tasks** — template-following displaces exploration, causing -67pp regression (KE-133+147).
- **Forced verification guards harm complex/creative tasks** (KE-091) — for deep synthesis, trust judgment over rigid checklists.
- **KE-008**: Do NOT restructure heartbeat steps (reorder, merge, rename). Add content within existing steps only.
- **Don't add harness guards without gym evidence** — text rules don't fix judgment failures (KE-002, 0/57), but process-level text rules work fine (88-100%).
- **Mandatory failure analysis (H-EXP-014)**: When closing failed experiments, answer: (1) Why? (2) What did we learn? (3) Different hypothesis? Target: ≥2/5 failures spawn follow-ons.

## Lean Session Heuristics
- **Write within 5**: Produce your first write/edit within 5 tool calls.
- **Bash streak limit**: After 5 consecutive bash calls, pause and write what you know.

## Learned from experience

- **Milestone completed: Audit evaluator scoring: collect scores across 10+ projects, identify rejection loop frequency**
- **Milestone completed: Identify root c (source: s_1777127783003_6, 2026-04-25)
- WAITING: All documentation and analysis milestones are complete (8/10). The remaining 2 milestones ("Run the core 20 suite and establish baseline scores per agent" and "measure improvement on conventi (source: s_1777137302288_118, 2026-04-25)
- All files exist and are substantial. Now I can write the audit. (source: s_1777137253493_117, 2026-04-25)
- PIVOT —

1. **I believe**: The core work is actually done (skill written in iter 1, scenarios validated in iter 3, docs exist in §8), but we keep failing to check off milestones because iterations are (source: s_1777137240027_116, 2026-04-25)
- Now I have clear results. The runner works in stub mode (no actual agent, `agent_status: "skipped"`), scoring only checks environment state. Let me document this. (source: s_1777137130801_110, 2026-04-25)
- CONTINUE —

1. **I believe**: The worker created `scenario-validation.md` and confirmed gym scenarios exist. The evolution cycle documentation exists in gym-analysis.md §8. The skill was written in it (source: s_1777137120618_109, 2026-04-25)
- All exist. The gym-analysis.md already has the evolution process documented in §8. Let me note that §8 IS the "Gym-Driven Evolution Process" — the owner wanted it as §5 but it's already there as §8. T (source: s_1777137066338_108, 2026-04-25)
- CONTINUE — **Beliefs:**
1. **I believe**: The worker hit a tool validation error on edit() and didn't complete the documentation update. The skill file was written in iteration 1, but iteration 2 fail (source: s_1777137055316_107, 2026-04-25)
- Now I'll append §7 with the runner test results and the evolution process documentation. (source: s_1777136964182_106, 2026-04-25)
- CONTINUE

**Beliefs:**
1. **I believe**: The worker completed a solid first evolution cycle — diagnosed convention-compliance failures, wrote a targeted skill, and documented everything. The cycle is  (source: s_1777136946891_103, 2026-04-25)
- Now document the evolution cycle: (source: s_1777136820698_102, 2026-04-25)
- Good — the workflow already updated the status to `waiting`. Let me commit and wrap up. (source: s_1777136768484_101, 2026-04-25)
- File is correct and complete — well-structured markdown with all 20 scenario results, summary stats, failure analysis, and next steps. No truncation or errors. (source: s_1777136394166_96, 2026-04-25)
- File looks correct and well-structured. No issues. (source: s_1777136379585_95, 2026-04-25)
