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

- Now update journal: (source: s_1777045235337_59, 2026-04-24)
- Let me update the journal with this session and commit: (source: s_1777043435643_18, 2026-04-24)
- Good, I have everything I need. Let me now produce the comprehensive `.state/gym-analysis.md` deliverable. (source: s_1777042335890_286, 2026-04-24)
- Already marked SUPERSEDED. Good.

Let me checkpoint and finish. (source: s_1777041635078_271, 2026-04-24)
- WAITING: All milestones complete, waiting for review. The worker has confirmed all deliverables exist and CLIs are installed. The "Install" and "Adopt" milestones are effectively done — `.state/cli-be (source: s_1777041559020_266, 2026-04-24)
- Now I have all the data. Let me write both files: (source: s_1777041349167_259, 2026-04-24)
- PIVOT — The worker has said "let me write the doc" for multiple iterations without producing verified output. Time for a fundamentally different approach.

**(a) Concrete output:** `.state/cli-researc (source: s_1777041333796_257, 2026-04-24)
- CONTINUE

**(a) Concrete output:** `.state/cli-integration-research.md` fully rewritten with actual CLI help output and source code analysis for all three CLIs, plus proxy configuration findings.

**( (source: s_1777041220937_251, 2026-04-24)
- WAITING: Verification report produced and confirms the intervention is working (evaluator-gate disabled = zero stall rate, cap code exists as fallback). Parent tracker shows "ADOPTED" with metrics mee (source: s_1777041162746_250, 2026-04-24)
- The worker produced an excellent verification report. The report confirms: code is present, but the real fix was disabling `evaluator-gate` entirely, and the cap has never fired in production.

WAITIN (source: s_1777041112374_246, 2026-04-24)
- Now I have the full picture. Let me write the verification report. (source: s_1777041006201_243, 2026-04-24)
- CONTINUE

The human comment is clear: stop declaring done and start verifying the implementation actually works in production. Previous 3 iterations all said "WAITING for review" — that's the loop we  (source: s_1777040991561_237, 2026-04-24)
- CONTINUE — The human comment says quality hasn't been verified and wants real gym benchmark improvement. The worker needs to actually run scenarios against agents and iterate.

**(a) Concrete output:* (source: s_1777040991552_236, 2026-04-24)
- WAITING: All milestones appear complete — `.state/fib.ts` exists and outputs the correct Fibonacci sequence, `.state/fib.test.ts` exists and tests pass. Awaiting review.

Resume when: Human confirms c (source: s_1777040214711_220, 2026-04-24)
- Tests pass with `tsx`. The script outputs the correct sequence. (source: s_1777040172369_219, 2026-04-24)
