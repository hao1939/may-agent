# Tech-Lead Work Session Archaeology — 84-86 Op Outliers (Apr 13)

## Summary

The two highest-op tech-lead work sessions today (86 and 84 ops) share the same root cause as previous bloated sessions: **bash-heavy inline exploration without delegation**. Both are 85%+ bash, 9-10× the median work session (9 ops). They confirm the bloated-session archetype identified in earlier Mode A work but reveal two **distinct sub-patterns** with different fix paths.

---

## Sessions Analyzed

| Session | Ops | Duration | Task | Status |
|---|---|---|---|---|
| `s_1776073935553_117` | 86 | 8m50s | Lens A: Session lifecycle state machine audit | done |
| `s_1776070334953_93` | 84 | 12m55s | P1: Harness Engineering — Progress Checkpointing | done |

### Distribution Context (48h window, n=157 work sessions)

- **Median**: 9 ops
- **Mean**: 16.8 ops
- **P90**: 41 ops
- **These sessions**: 84-86 ops = **top 2.5% (P97.5+)**

---

## Session 1: 86-Op Lens A — State Machine Audit

### Tool Distribution
- **bash**: 87 (85%) — grep-search: ~45, sed-read: ~35, cat/ls: ~7
- **read**: 12 (12%)
- **write**: 1 (1%)
- **checkpoint + finish**: 2 (2%)

### What Happened

**Phase 1 (ops 1-6): Initial reads** — Read heartbeat.md, manager.ts, persistence.ts, session-subscribers.ts, completion.ts. Standard orientation.

**Phase 2 (ops 7-94): 87 consecutive bash calls** — All grep + sed. The session systematically traced every status transition across 7 files:
- `grep -n "session.status" src/lib/manager.ts` (×4 variants)
- `grep -n "archiveStatus" src/lib/manager.ts` (×3 variants)
- `sed -n '925,1100p' src/lib/manager.ts` (reading 50-100 line chunks, ×15)
- `grep -n "requestId" src/lib/manager.ts` (×4 variants)
- Cross-file tracing: completion.ts, persistence.ts, session-subscribers.ts, event-bus.ts, manager-utils.ts, types.ts

**Phase 3 (ops 95-100): Write + verify + finish** — Wrote findings doc, read 3 files to verify, checkpoint, finish.

### Root Causes

1. **Ignored workflow instruction**: Task explicitly said "Use workflow: workflow.run('verify-wrap', ...)" — agent did all work inline instead. If verify-wrap had been used, the work would've been delegated and the parent session would've been ~5-10 ops.

2. **grep-then-sed spiral**: Classic pattern — grep to find a reference, then sed to read context around it, then grep again for the next reference. 87 bash commands where `read()` with offset/limit would've been ~30 read calls max.

3. **No delegation**: Zero child sessions. The entire audit was done in a single session.

### Lean Alternative

A lean version of "audit session state machine" would be:
1. `read(src/lib/manager.ts)` (2-3 paginated reads to cover the file)
2. `read(src/lib/persistence.ts)` (1 read)
3. `read(src/lib/completion.ts)` (1 read)
4. `read(src/lib/session-subscribers.ts)` (1 read)
5. Synthesize findings and `write()` (1 write)
6. `checkpoint()` + `finish()` (2 ops)

**Estimated lean cost: ~12-15 ops** (vs 86 actual = **83% waste**)

The key insight: for code audit tasks, reading whole files with `read()` and synthesizing is cheaper than grep-hopping across files. The LLM can process whole files — it doesn't need to "search" like a human would.

---

## Session 2: 84-Op Harness Engineering — Checkpointing

### Tool Distribution
- **bash**: 81 (77%) — db-query: ~35, grep-search: ~25, git-ops: 5, discovery: ~16
- **read**: 18 (17%)
- **edit**: 3 (3%)
- **checkpoint + finish**: 3 (3%)

### What Happened

**Phase 1 (ops 1-32): Research exploration** — 32 ops exploring checkpoint infrastructure:
- Read checkpoint.ts tool, manager.ts, session-digest.ts
- Discovery spiral finding databases: checked `.state/checkpoints/`, tried `scripts/code-search.sh`, explored multiple .db files
- 16 "experiment" bash calls (#15-#32 in session.jsonl), most starting with `# Experiment N:` comments

**Phase 2 (ops 33-89): 57 bash calls for empirical analysis** — Python3 heredocs querying may.db:
- Session recovery analysis, digest context injection, cross-session continuity
- `still_open` field analysis, checkpoint frequency per session
- Total: ~20 numbered "experiments" inline via Python3 heredocs
- **DB discovery waste**: Commands #53-#67 trying to find the right database (checked `persist/may.db`, `.state/may.db`, tried `sqlite3` CLI)

**Phase 3 (ops 85-91): Git struggle** — 5 git commands, 3 failures:
1. `cd /root/project && git add` → **/root/project doesn't exist** (path hallucination)
2. `cd /app && git add` → **rejected by .gitignore** (agents/ is ignored)
3. `cd /app && git add -f` → **blocked by review gate** (direct commits to main blocked)
4. `cd /app && git stash && git checkout -b review/... && git stash pop && git add -f && git commit` → **success**
5. `cd /app && git checkout main` → back to main

**Phase 4 (ops 92-105): Verify + edit + finish struggle**:
- Verification found file missing from main (it's on review branch) → 4 ops of confusion
- `finish()` **rejected**: "Deliverables not found on disk" — file was committed to review branch but not on main's working tree
- Had to call finish() twice (second time presumably with adjusted deliverables)

### Root Causes

1. **Unbounded research task**: "Design and implement improved progress checkpointing" — open-ended exploration with no stopping criterion. The agent ran **20 numbered experiments inline**.

2. **Database discovery spiral**: 15+ ops trying to find the right .db file path (checked wrong paths, tried unavailable tools). This is a known systemic issue.

3. **Git workflow ignorance**: 3 wasted ops on git errors (path hallucination + gitignore + review gate). This pattern appears repeatedly.

4. **finish() deliverable gate friction**: File committed to review branch but finish() checked main working tree → rejection + retry.

### Lean Alternative

A lean version would:
1. Read the research project file (1 read)
2. Read checkpoint.ts tool implementation (1 read)  
3. Read session-digest.ts (1-2 reads)
4. Run 3-4 targeted DB queries via bun (not 20 Python experiments): checkpoint rate, digest fill rate, recovery patterns (4 bash)
5. Write findings (1 write/edit)
6. Git commit on review branch (1 bash — skip the discovery)
7. Checkpoint + finish (2 ops)

**Estimated lean cost: ~15-20 ops** (vs 84 actual = **76-82% waste**)

---

## Cross-Session Patterns

| Pattern | 86-Op Session | 84-Op Session | Systemic? |
|---|---|---|---|
| **Bash-heavy (>75%)** | 85% bash | 77% bash | ✅ Yes — matches 80-93% from prior bloated session analysis |
| **grep-then-sed spiral** | 87 bash (all grep/sed) | Moderate | ✅ Known pattern from finding-bash-command-patterns |
| **DB discovery waste** | — | ~15 ops finding .db path | ✅ Known systemic issue |
| **Git retry loop** | — | 3 wasted git ops | ✅ Known pattern (path hallucination + review gate ignorance) |
| **No delegation** | 0 child sessions | 0 child sessions | ✅ Both did everything inline |
| **Ignored workflow instruction** | Task said use verify-wrap; didn't | N/A (no workflow in task) | ⚠️ Compliance gap |
| **Unbounded exploration** | Finite (audit scope) | Open-ended research → 20 experiments | ✅ Matches KE-013 |
| **finish() friction** | Clean | Rejected once | ⚠️ New pattern |

---

## Actionable Findings

### 1. Workflow Compliance (Session 1)
**The task literally said "Use workflow: workflow.run('verify-wrap', ...)"** and the agent ignored it. If compliant, the parent session would've been ~5 ops (fork + wait) and the actual work would've run in verify-wrap's bounded structure.

**Fix direction**: This is a judgment/compliance failure, not a tooling gap. The workflow instruction was explicit. Text rules won't fix this (KE-002). Possible fix: detect "Use workflow:" in task description and auto-inject a turn-1 nudge.

### 2. Research Task Bounding (Session 2)
Open-ended research tasks ("design and implement improved checkpointing") expand to fill available turns. The agent ran 20 inline "experiments" that could've been scoped to 3-4 key questions.

**Fix direction**: Research/investigation tasks should include explicit stopping criteria and a numbered list of max-N experiments to run. The task already had "Investigation steps: 1-6" but the agent expanded to 20+ experiments.

### 3. Read() vs Grep+Sed (Both Sessions)
Both sessions used `grep` → `sed` chains to trace code paths. For files under 2000 lines, `read()` with pagination is more efficient: read the whole file, let the LLM find what it needs. The grep→sed pattern generates 3-5× more ops per code tracing task.

**Fix direction**: Already identified in finding-bash-command-patterns. A code-search tool exists but isn't adopted (known issue). For audit tasks specifically, a skill/instruction like "For code audits of <5 files, use read() to consume whole files, not grep chains" would help.

### 4. Known DB Path
The 84-op session spent ~15 ops discovering that `.state/may.db` is the correct database path. This is already in tech-lead's context but the LLM tried wrong paths first.

**Fix direction**: Already in context.md for optimizer. Verify tech-lead's context also has it.

---

## Cost Impact

- These 2 sessions: **170 ops total**
- Lean equivalent: **~30 ops total**
- **Waste: ~140 ops** ($6.50 at $0.047/op)
- Sessions like these occur ~4/day (top 2.5% × 157 sessions/48h) → **~280 wasted ops/day (~$13/day)**
- This is the **tech-lead work session tail** identified in the system health check as the next optimization target

---

*Analysis performed: Apr 13 2026 ~12:50 UTC. Sessions from earlier today.*
