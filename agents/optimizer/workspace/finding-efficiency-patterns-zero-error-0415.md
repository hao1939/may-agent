# Finding: Efficiency Patterns in Zero-Error Period (Apr 15)

**Date**: 2026-04-15  
**Mode**: C — Skill & Technique Scouting  
**Period**: Last 6 hours (zero unrecoverable errors across all agents)

## Dataset

- **111 sessions** with opCount > 5 in the last 6 hours
- **47 evaluated** sessions (with efficiency/quality scores from evaluations table)
- All agents represented: QA, evaluator, tech-lead, may, scout, optimizer, bob, coach, coder

## Key Finding 1: Failure Chains Inflate Ops by 4.2 on Average

Sessions **with failure chains**: avgOps = 18.6 (n=29)  
Sessions **without failure chains**: avgOps = 14.3 (n=18)  

That's a **29% ops inflation** from failure chains. Even in a zero-error period, most sessions (62%) still have at least one failure chain. These aren't fatal errors — they're recoverable hiccups (wrong path, schema mismatch, unverified write). But each one costs 2-5 extra tool calls.

### Top Issue Types (from evaluations.issues)
| Issue | Sessions | Description |
|-------|----------|-------------|
| verification | 25 | Missing post-write verification, evidence gaps |
| FM-3.3 | 17 | finish() blocked by missing checklist or verification |
| git | 13 | gitignore violations, uncommitted changes at finish |
| path | 8 | Wrong file paths, guessing non-existent locations |
| uncommitted | 7 | Dirty working tree at session end |
| FM-1.3 | 4 | Schema/environment mistakes (wrong columns, etc.) |

**Insight**: The #1 issue is verification hygiene (25/47 = 53% of evaluated sessions). Agents write a file, then don't read it back, or attempt finish() without verifying. The guard catches this, but the recovery costs ops.

## Key Finding 2: Task Type Determines Efficiency More Than Agent

| Task Pattern | n | avgOps | avgEfficiency |
|-------------|---|--------|---------------|
| verify/review | 2 | 7.0 | 0.55 |
| heartbeat | 7 | 11.1 | 0.65 |
| other | 3 | 11.3 | 0.45 |
| persistent-task | 13 | 15.4 | 0.55 |
| cron-job | 4 | 18.8 | **0.80** |
| work-session | 14 | 21.6 | 0.43 |
| fix-task | 4 | 23.0 | 0.47 |

**Key observations**:
- **Cron jobs are the most efficient** (avgEff=0.80) despite moderate ops. They have clear, bounded tasks with known file locations.
- **Work sessions are the least efficient** (avgEff=0.43, avgOps=21.6). These are open-ended exploration tasks (Mode A/B/C/D) that involve multiple queries before writing.
- **Fix tasks** are high-ops (23 avg) and low-efficiency (0.47). They involve debugging loops.
- **Heartbeats** are efficient (0.65) when they have meaningful work, showing the triage-and-dispatch model works well.

## Key Finding 3: Agent Speed vs Agent Thoroughness

Ops-per-minute (density) reveals different agent strategies:

| Agent | ops/min | avgOps | Interpretation |
|-------|---------|--------|---------------|
| QA | 6.79 | 6.5 | Fast, narrow — does one thing well |
| coder | 5.18 | 20.8 | Fast but sprawling — many ops, fast clock |
| scout | 4.61 | 12.4 | Balanced — moderate ops, good pace |
| coach | 3.83 | 17.3 | Slow and heavy — complex analysis tasks |
| tech-lead | 3.77 | 11.9 | Deliberate — reads a lot before acting |
| optimizer | 3.15 | 13.6 | Methodical — data gathering before writing |
| bob | 3.03 | 15.0 | Slowest — research tasks are inherently slower |

**Pattern**: The highest-density agents (QA, coder) have the best ops/time ratio because they start acting immediately. But coder's high avgOps (20.8) suggests it acts fast but often needs corrections. QA's low avgOps (6.5) combined with high density is the true gold standard.

## Technique Differences: Efficient vs Inefficient

### What efficient sessions do (eff ≥ 0.80):
1. **Known paths**: They work with files they already know exist. No path guessing. tech-lead reviewing iteration 3 of a persistent task already knows exactly where the code is.
2. **Bounded scope**: Tasks with clear deliverables (cron jobs, heartbeat dispatches) finish faster because there's no exploration phase.
3. **Write-first**: The most efficient sessions read 1-2 files then immediately write. They don't query multiple data sources before starting.

### What inefficient sessions do (eff ≤ 0.50):
1. **Path guessing**: 8 sessions guessed wrong paths (FM-1.3 pattern). Each guess costs 2-3 ops for error + recovery.
2. **Git confusion**: 13 sessions hit gitignore issues or uncommitted changes. This is pure waste — agents should know their workspace is gitignored.
3. **Verification gaps**: 17 sessions triggered FM-3.3 (finish blocked). The fix is always the same: read back the file you wrote. This should be automatic.
4. **Multi-query exploration**: Work sessions that query 5-8 data sources before writing spend 40-60% of their ops on reading, not producing.

## Actionable Recommendations

### R1: Pre-cache workspace paths (impact: -2 ops avg for 8/47 sessions)
The path-guessing pattern (FM-1.3) is preventable. Agents should have their workspace paths in context. A skill or context entry listing `agents/<name>/workspace/` as the write target and noting gitignore would eliminate this.

### R2: Auto-verify pattern for writes (impact: -3 ops avg for 17/47 sessions)
FM-3.3 is the most common issue. When an agent calls write() or edit(), the very next call should be read() on the same file. This could be:
- A workflow step that bundles write+verify
- A stronger context reminder (though text rules have limited effectiveness per KE-002)
- Better: a workflow that enforces write→verify→finish sequence

### R3: Structure work sessions like cron jobs (impact: unclear, needs experiment)
Cron jobs are 85% more efficient than work sessions (0.80 vs 0.43 efficiency). The key difference: cron jobs have **predetermined file inputs and output locations**. Work sessions should be restructured to:
- Declare input files and output file in the first tool call
- Limit query phase to 3 calls max before writing
- This aligns with the "write within 5" lean session heuristic

## Data Quality Notes

- 47 of 111 sessions had evaluations; the rest (mostly heartbeats/jobs) were unevaluated
- Zero unrecoverable errors in this period — all issues were recoverable failure chains
- The "zero-error period" means we're measuring steady-state efficiency, not crisis recovery
