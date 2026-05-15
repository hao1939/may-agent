# Persistent-Task Workflow Analysis

**Date**: 2026-04-16
**Author**: optimizer
**Request**: req:66b1bbf8

## Summary

The persistent-task workflow has been used **34 times** across all agents. Most runs are short (1-3 iterations). The longest run achieved **10 iterations** (Bob's EXP-166). Context accumulation is managed at **two levels**: the workflow engine (completedSteps pruning) and the project file (iteration pruning). The primary bottleneck is **worker session turn limits**, not context overflow.

## 1. How Many Persistent-Task Sessions Exist?

**34 distinct workflow runs** found in the database, spanning April 2-16, 2026.

### By agent:
| Agent | Runs | Total Sessions | Max Iterations |
|-------|------|---------------|----------------|
| coder+qa (early) | 16 | ~40 | 2 (worker→review pairs) |
| bob | 6 | ~30 | 10 (EXP-166) |
| tech-lead+coder | 5 | ~20 | 3 |
| coach | 1 | 2 | ~2 |
| optimizer | 3 | ~5 | 3-4 |

### Iteration counts from project files:
- **agents/bob/workspace/projects/exp166-execution.md**: 10 iterations (the record), 13.7KB file
- **agents/bob/workspace/projects/exp167-runs.md**: 3 iterations, done
- **agents/tech-lead/workspace/projects/fix-verify-wrap.md**: 3 iterations, done
- **agents/tech-lead/workspace/projects/metric-system-phase1.md**: 3 iterations, done
- **agents/may/workspace/projects/metric-system.md**: 3 iterations (but still "active" — likely stale)
- **agents/tech-lead/workspace/projects/cold-start-fix.md**: 1 iteration, active

### Where did they stop?
- **Turn limit** (51/50 turns): 6 sessions hit this — the coder worker session exceeds the 50-turn cap during complex iterations
- **Aborted** (Request was aborted): 7 sessions — external timeout or cancellation
- **Auth error**: 1 session (token expired)
- **Normal completion** (DONE decision): ~20 sessions — owner decided task was complete
- Most runs stop after **1-3 iterations** because the goal is achieved or the owner says DONE

## 2. Context Size at Termination

### Project file (the persistent state):
- The workflow uses `KEEP_RECENT = 5` to prune old iterations in the markdown file
- Each iteration block ≈ 500-1500 bytes (worker task + truncated result + files touched + assessment)
- At iteration 10, the EXP-166 file was **13.7KB** — iterations 1-5 were collapsed to one-liners (~50 bytes each)
- **Projected file size at iteration N**: ~1.5KB header + min(N, 5) × 1500 bytes + collapsed × 50 bytes
  - At iteration 20: ~9KB
  - At iteration 50: ~12KB
  - At iteration 200: ~17KB (bounded by pruning)
- **File size is NOT the bottleneck** — pruning keeps it under ~20KB indefinitely

### Worker session context (the real bottleneck):
The `buildWorkerPrompt()` function injects:
1. Goal text: ~100-500 bytes
2. Last 3 iterations of progress: up to ~4.5KB (3 × 1500)
3. Owner guidance: ~200 bytes
4. Instructions: ~200 bytes
- **Total worker prompt: ~1-5KB** — constant regardless of iteration count (only sees last 3 iterations)
- Worker sessions **do NOT accumulate** — each is a fresh session with bounded context

### Workflow engine context (completedSteps):
- `MAX_DETAILED_STEPS = 20` — the workflow engine keeps last 20 step summaries
- `pruneCompletedSteps()` replaces older steps with `{pruned: true}` markers
- Each step summary includes sessionId + truncated result (~500-3000 bytes via `ctx.summarize(maxLength: 3000)`)
- **At 20+ steps**: only ~60KB of step context in memory (20 × 3KB max)
- Steps beyond 20 are pruned to minimal stubs

## 3. What's the Bottleneck?

**Primary: Worker session turn limits (50 turns)**

6 of the early runs failed because the coder worker session hit the 50-turn limit. This is the #1 failure mode — a single iteration that's scoped too broadly fills up the turn budget before reaching `finish()`.

**Secondary: External timeouts / aborts**

7 sessions were aborted externally, likely due to the parent workflow's timeout or the process being killed. Bob's 15-session EXP-166 run had 5 interruptions — the workflow auto-recovered from each one.

**NOT a bottleneck: Context accumulation**

The design has three pruning mechanisms that effectively bound context growth:
1. **Worker prompt**: only shows last 3 iterations (not all history)
2. **Project file**: `KEEP_RECENT = 5` collapses old iterations to one-liners
3. **Workflow engine**: `MAX_DETAILED_STEPS = 20` prunes old step results

## 4. Bytes Per Iteration & Context Limit

### Per-iteration accumulation:

| Component | Bytes/iteration | Bounded? |
|-----------|----------------|----------|
| Project file (full iteration block) | ~1-1.5KB | Yes — pruned after 5 |
| Project file (collapsed line) | ~50-120 bytes | Grows linearly but slowly |
| Workflow completedSteps | ~1-3KB per step | Yes — pruned after 20 |
| Worker session prompt | 0 (fresh each time) | N/A |
| Review session prompt | ~1-3KB (recent blocks) | Yes — only last 2-3 iterations |

### At what iteration does context limit hit?

**It doesn't, under current design.** All three accumulation paths are bounded:
- Project file: ~17KB at 200 iterations (the hard cap)
- Workflow engine steps: ~60KB (20 × 3KB) regardless of iteration count  
- Worker/reviewer sessions: fresh each time with ~5KB input

The **actual limit** is the 200-iteration emergency cap in the workflow config, not context overflow. At 200 iterations, the workflow pauses and asks for manual re-run.

## 5. Recommendations

1. **The system works as designed** — pruning mechanisms are effective. No context overflow crisis.
2. **Worker turn limits are the real problem** — iterations that scope too much work hit 50 turns. Fix: better task scoping guidance in the worker prompt, or raise turn limit for persistent-task workers.
3. **Abort recovery works** — Bob's 15-session run survived 5 aborts. The crash-recovery mechanism (detecting pending reviews) works correctly.
4. **Most runs are short** — median is ~2-3 iterations. The workflow is used for structured multi-step delivery, not long-running processes. This is appropriate.
5. **The 30-minute stale lock** (§4.6) prevents concurrent runs but may be too aggressive for longer iterations.
