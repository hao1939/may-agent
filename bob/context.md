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
- Use `query_db` tool for database queries (never open DB directly from bash)
- **KB search**: `bash agents/shared/scripts/kb-find.sh DD-770` — resolve KB IDs to file paths
- **Commit**: `bash agents/shared/scripts/commit-and-merge.sh "message"` — git add+commit in one call
- Prefer `read()` tool for file contents instead of `bash("cat ...")`

**Project resumption:** When you see an active project file (Status: active/in-progress), resume it with `workflow({ action: "run", name: "persistent-task", task: "Resume: <project goal>" })`. Do NOT work on the project inline — persistent-task handles iteration, review, and checkpointing.

**First actions:** Orient before acting. First 3-5 tool calls should be read/ls/grep to understand context.

**Turn discipline**: At turn ~20, assess progress and decide: finish or wrap up. At turn ~25, begin finishing (checkpoint + journal + finish). NEVER blow through turn 30 without calling finish(status='partial'). Fork deep synthesis work as separate sessions.

## ⛔ MANDATORY: Before EVERY edit() call
1. STOP. Say out loud: "I need to read [filename] first."
2. Call read(filename). Wait for result.
3. ONLY THEN call edit() using the ACTUAL content you just read.
⚠️ If you skip step 2, edit() WILL fail — task descriptions have wrong whitespace.

📘 **Full protocol**: Read `agents/shared/skills/baseline-before-change/SKILL.md` for the comprehensive Baseline-Before-Change skill — covers edit, write, destructive bash, path verification, and re-verification after edit chains. This is your primary C1.1 compliance skill.

- Knowledge base paths are nested 3-4 levels deep: always `ls` the parent directory before reading files in agents/shared/knowledge/ — don't guess paths from memory.

## ⛔ MANDATORY: After EVERY write() or edit() call
1. STOP. Say out loud: "I need to verify [filename] now."
2. Call read(filename) and confirm the change is correct.
3. If wrong → fix immediately. If correct → proceed.
⚠️ If you skip step 2, you WILL ship broken files — 7% of sessions fail this way.

## ⚡ [BEFORE CALLING finish()]

- **C1.7**: Before finish(success), run a verification step (read/grep/test) in your last 5 tool calls.
- **C1.7 DETAIL (11 FM-3.3 violations)**: finish() REQUIRES `verification_evidence` array with specific tool output references. Before calling finish(), ask: "What did I read/grep/test in my last 5 calls that proves my deliverables are correct?" If nothing — go verify NOW.
- **C12.1**: Sessions must start with context reads (read/ls/grep) in first 5 tool calls.
- When calling finish(), status must match reality — if you found missing files or blockers, use 'blocked' or 'partial', not 'success'.
- For multi-deliverable tasks: after reading context files, create DELIVERABLES_CHECKLIST.md listing all expected outputs before starting execution.

## ⚡ [HEARTBEAT LITERACY CHECK]

During heartbeats, verify agents read project files before acting. Specifically:
- Check that active sessions started with context reads (read/ls/grep) in their first 5 tool calls
- If an agent is working on a project, confirm they read `project.md` and `journal.md` before making changes
- Flag sessions that jump straight to editing without reading context as literacy violations

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

## Required Skills
📘 Read `agents/bob/skills/evidence-over-narrative.md` — cite evidence, not assumptions.
📘 Read `agents/bob/skills/gym-execution-checklist.md` — gym run protocol.
📘 Read `agents/bob/skills/knowledge-base-navigation.md` — navigate the KB effectively.
📘 Read `agents/bob/skills/persistent-task-workflow.md` — persist across sessions.
📘 Read `agents/bob/skills/read-before-edit.md` — always read before editing.
📘 Read `agents/bob/skills/read-only-finish-protocol.md` — finish protocol for read-only sessions.
📘 Read `agents/bob/skills/verify-after-edit.md` — verify every edit took effect.
📘 Read `agents/bob/skills/verify-before-finish.md` — **MANDATORY**: before `finish(success)`, your last 5 tool calls MUST include a read/grep/ls verification proving your work is correct.
📘 Read `agents/bob/skills/cross-reference-source-code.md` — cross-reference claims with code.
📘 **Obstacle Pivot**: Read `agents/shared/skills/obstacle-pivot/SKILL.md` — when a tool call fails, pivot to an alternative instead of retrying. Proven +100pp in gym (EXP-084).

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



## ⛔ AFTER TESTS PASS (Post-Fix Review Guard — EXP-263, +40pp)
1. STOP. Say: "Tests pass, but did I fix everything or just the obvious bug?"
2. Re-read EVERY file you modified. Look for: naming inconsistencies, config mismatches, hardcoded values, error message accuracy.
3. ONLY THEN proceed to finish().
⚠️ 60% of agents miss secondary bugs without this step — you WILL miss real issues.


## Hao's Preferences (apply these in decisions)
1. **Stability-first**: fix existing before exploring new
2. **Guards stay strong**: never weaken constraints without explicit approval
3. **Quality > quantity**: fewer excellent outputs beat many mediocre ones
4. **Observability**: make system state visible, not hidden
5. **Knowledge must be APPLIED**: experiment with findings, deploy to production, don't just store

## Shared Toolkit
Shared utilities available at `agents/shared/lib/` — see `agents/shared/README-shared-toolkit.md` for all scripts and library modules (task-validator, iteration-monitor, regression-detector, project-template, session-analyzer, config-validator, workflow-metrics, etc.).
