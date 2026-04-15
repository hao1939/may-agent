# Finding: Session Cost Analysis — $37/2h burn rate (2026-03-18T13:20)

## Summary
Analyzed cost data from 20 recent sessions spanning ~2 hours. **Total: $37.03** ($456/day projected at this activity level). Top 3 agents account for 71% of spend.

## Key Numbers

| Agent | Cost (2h) | % | Biggest Session | Root Cause |
|-------|----------|---|----------------|------------|
| optimizer | $10.90 | 29% | $6.44 (61 turns) | Context compaction causes many turns; investigating patterns |
| coach | $9.97 | 27% | $3.90 (heartbeat) | Common-sense-verify reads raw session transcripts (~550KB) |
| tech-lead | $5.69 | 15% | $3.35 (heartbeat) | Deep work sessions with many reads |
| amy | $3.54 | 10% | $2.28 (heartbeat) | Read loop pattern (guard deployed but may need tuning) |
| may | $4.01 | 11% | $2.47 (intervention) | Hao-driven sessions, appropriate cost |
| scout | $0.96 | 3% | $0.96 | Normal |
| bob | $0.89 | 2% | $0.60 | Normal |
| evaluator | $0.34 | 1% | $0.34 | Normal |

## Top Optimization Targets

### 1. Coach Common-Sense Verification ($2.78/run, every 4h = $16.68/day) — HIGH IMPACT
**Problem:** `cron:common-sense-verify` instructs coach to "Find a recent session transcript where this item is relevant." Coach reads entire session.jsonl files (30-300KB each), often reading the same file multiple times. One session had 12 tool results >20KB, totaling ~550KB of session transcripts.

**Solution Options:**
- a) Add a pre-summarization step: a lightweight JS handler that extracts relevant excerpts from session transcripts before coach sees them (reduce 300KB → 5KB)
- b) Change the cron message to tell coach to use bash grep/search instead of reading full files
- c) Limit the `read` tool to max 10KB for session.jsonl files
- d) Create a session summary index that coach can query instead of raw transcripts

**Estimated savings:** $10-14/day (coach reads fewer tokens + context window stays smaller)

### 2. Optimizer Context Compaction (my own sessions: $6.44 average) — MEDIUM IMPACT  
**Problem:** This session is being repeatedly compacted, causing the same information to be re-processed. 61 turns in one session means the context window grows very large by the end.

**Solution:** Better checkpointing discipline — fewer, more targeted reads. Finish sessions earlier instead of accumulating massive context.

**Self-note:** Target <25 turns per session, <$2.50 per session.

### 3. Tech-lead Deep Sessions ($3.35 average) — LOW-MEDIUM IMPACT
**Problem:** Tech-lead reads many files during implementation sessions. This is somewhat inherent to coding work.

**Solution:** Prompt caching (already deployed, needs API key). Would reduce input costs by 60-90% for repeat context.

## Context: Why activity level matters
This 2-hour window was during a period of high activity (Hao intervened to push agents out of idle). Normal daily rate would be lower. But the per-session costs are still too high — even at half the session rate, we'd be at $228/day.

## Recommendation Priority
1. **Immediate:** Change common-sense-verify cron to avoid reading raw session transcripts
2. **Immediate:** Self-discipline on session length (optimizer)
3. **Short-term:** Enable prompt caching (needs ANTHROPIC_API_KEY)
4. **Medium-term:** Session summary index for all agents that need to review transcripts
