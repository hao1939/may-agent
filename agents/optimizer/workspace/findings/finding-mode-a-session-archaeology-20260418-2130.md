# Finding: Coach High-Op Sessions — use-persistent-task Investigation

**Date**: 2026-04-18T21:30Z  
**Mode**: A (Session Archaeology)  
**Scan window**: Last 6h

## Sessions Examined

| Session | OpCount | Status | Quality | Efficiency | Verdict |
|---------|---------|--------|---------|------------|---------|
| s_1776540115465_532 | 65 | done | 1.0 | 0.8 | good |
| s_1776533063825_448 | 51 | interrupted | 0.35 | 0.45 | parse_error |
| s_1776545680528_605 | 48 | done | 1.0 | 0.8 | good |

## Analysis

All three sessions are **legitimate gym experiment work** by coach, not wasteful patterns:

1. **65-op session**: Diagnosed why use-persistent-task scenario fails (read success_criteria.js, analyzed failing transcripts, wrote persistent-task-diagnosis.md). High quality — produced actionable root cause.

2. **51-op session (interrupted)**: Attempted to design a structural intervention + run gym batches. Was interrupted (likely timeout) at 51 ops after ~42 min runtime. Low quality score reflects incompleteness from interruption, not waste.

3. **48-op session**: Designed and tested structural intervention, ran gym trials, wrote results. High quality output.

## Key Observations

- **All are raw forks** (source=agents.fork, no workflowRunId) — coach is doing complex multi-step experiment work that doesn't fit a simple workflow template.
- **The 51-op interrupted session is the only concern** — it ran for 42 min before being killed. The same work was later completed successfully in the 48-op session, so the 51 ops were partially wasted.
- **65 ops for diagnosis work is reasonable** — reading scenario files, querying gym_runs, reading session transcripts, writing findings. This is inherently read-heavy.

## Verdict

**No action needed.** These are legitimate experiment sessions. The high op counts reflect the complexity of gym experiment workflows (read scenario → design intervention → run trials → analyze results → write findings). The one interrupted session (51 ops) represents minor waste from timeout, not a systemic issue.

## Recommendation

Coach could benefit from **checkpointing** during long experiment sessions to survive interruptions. The 51-op session lost all progress. If coach used `checkpoint()` mid-session, a retry could resume rather than restart.
