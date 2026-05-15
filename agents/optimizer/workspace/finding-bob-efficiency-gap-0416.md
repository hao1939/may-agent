# Finding: Bob Efficiency Gap Analysis
*Date: 2026-04-16 | Mode C: Skill & Technique Scouting*

## Summary
Bob's overall efficiency is 0.61 — below optimizer (0.64), scout (0.66), coder (0.67), and qa (0.73). The gap is driven by specific failure patterns, not uniform mediocrity. Bob's best sessions hit 0.90-1.0 efficiency; his worst cluster at 0.10-0.22.

## Data Snapshot (all-time, from evaluations DB)
| Agent | Avg Efficiency | Avg Waste | Avg Productive | N sessions |
|-------|---------------|-----------|---------------|------------|
| bob | 0.61 | 1.8 | 17.0 | 3008 |
| optimizer | 0.64 | 1.1 | 17.0 | 2105 |
| scout | 0.66 | 0.8 | 26.1 | 1246 |
| coder | 0.67 | 2.3 | 4.7 | 395 |
| qa | 0.73 | 0.4 | 11.1 | 987 |
| coach | 0.57 | 5.7 | 22.2 | 3030 |

## Root Cause Analysis: What Drags Bob Down

### Pattern 1: Non-Delivery Sessions (efficiency 0.10-0.20)
Bob's worst sessions share a signature: **reads files but produces no output**. Examples:
- **Design reviews** (cron-handlers, detached-subagent, task-notifications, activity-tracking): Bob reads the design doc, reads supporting code... then the session ends with no review written. Efficiency: 0.10-0.20, quality: 0.05-0.10.
- These account for 6+ sessions with eff <0.20 in the sample. Each wastes the entire session budget.
- **Root cause**: Bob starts reading broadly (design doc + multiple source files) and runs out of budget before writing anything. The "plan before acting" instinct becomes "read everything before writing anything."

### Pattern 2: Tool Flailing in Unfamiliar Environments (efficiency 0.20-0.22)
Gym/scenario work sessions show massive waste:
- Path guessing (`agents/shared/gym/scenarios/` vs `agents/gym/scenarios/`)
- Environment gaps (missing PATH, sqlite3 CLI, `file` command)
- 51-63 wasted calls per session in failure chains
- **Root cause**: Bob lacks environment-awareness skills that other agents have. No `which`/`type` checks before assuming tools exist.

### Pattern 3: Error Loops (efficiency 0)
Multiple heartbeat sessions hit error state with 6-12 wasted calls and 0 productive calls:
- Repeated `multiple_tool_errors` flag
- Sessions at efficiency 0.0 with wastedCalls of 6, 8, 9, 11, 12
- **Root cause**: Gets stuck in error recovery loops without pivoting. Violates common-sense §3.2 ("Don't repeat yourself").

### Pattern 4: Scope Creep in Consolidation Tasks
The lesson-consolidation sessions (eff 0.20) show bob overwriting files with truncated content — attempting bulk operations without verification. Ambitious scope + no incremental checkpointing.

## What Bob Does Well (0.90+ sessions)
- **Focused code reviews**: The feature-flags review (0.95 eff, 0.80 quality) — read doc, read diff, wrote structured feedback. Tight scope.
- **File operations**: Delete/move/archive tasks (0.90 eff, 1.0 quality) — clear instructions, mechanical execution.
- **Research synthesis with budget caps**: DD-710/712/713/714 analyses (0.88-0.90 eff, 0.93-0.95 quality) — explicit "≤25 tool calls" budget forced disciplined output.
- **Concurrency analysis** (0.90 eff, 0.85 quality) — well-scoped question, practical answer.

## 3 Concrete Improvements

### 1. "Write-First" Skill for Review Tasks
**Problem**: Bob reads 3-5 files then runs out of budget before writing.
**Fix**: For design review tasks, write a skeleton review file (headings + placeholder answers) BEFORE reading supporting code. Then fill in sections as you read. This ensures partial output even if budget runs out.
**Expected impact**: Eliminates the 0.10-0.15 efficiency cluster (6+ sessions). Would raise avg efficiency by ~0.03-0.05.

### 2. Environment Probe Protocol
**Problem**: Bob guesses paths and tool availability, triggering 10+ error chains.
**Fix**: First 2 tool calls in any unfamiliar environment should be `ls` of the workspace root and `which <tool>` for any CLI tools the task mentions. This is a 2-call investment that prevents 10-50 wasted calls.
**Expected impact**: Cuts waste in gym/scenario sessions by 60%+.

### 3. Budget-Aware Convergence (Already Exists — Not Followed)
**Problem**: Common-sense §6.1 says "when ops < 20%, finalize." Bob ignores this.
**Fix**: This is a Coach behavioral item, not an infra gap. Coach should add a specific lesson/drill targeting bob's convergence behavior. The rule exists; compliance is low.
**Expected impact**: Prevents the 0-efficiency error-loop sessions where bob burns entire budget on retries.

## Net Impact Estimate
If improvements 1-3 land:
- Improvement 1 eliminates ~6 sessions at 0.10-0.20 → raises avg by ~0.02
- Improvement 2 reduces waste in ~5 sessions → raises avg by ~0.01  
- Improvement 3 prevents ~8 zero-efficiency sessions → raises avg by ~0.02
- **Combined**: Bob efficiency 0.61 → ~0.66, closing the gap with scout/coder.
