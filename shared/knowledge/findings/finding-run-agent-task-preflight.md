# Finding: run-agent-task Cron Jobs Need Pre-flight Checks

**Date:** 2026-03-18T05:22Z  
**Type:** LLM-to-JS opportunity scan  
**Impact:** ~$3-5/day savings ($90-150/month)

## Problem

10 cron entries use `run-agent-task` handler to spawn LLM sessions for periodic work. Many fire when there's nothing new to process, wasting $0.08-1.60 per session on the LLM discovering "nothing to do."

## Current State

| Cron Job | Agent | Interval | Approx Cost/Session | Can Pre-check? |
|---|---|---|---|---|
| `reflect` | coach | 6h | $1.58 | ✅ Check human-inputs.jsonl for new entries |
| `consolidate-memory-*` (×4) | bob/scout/coach/optimizer | 7d | $0.30 | ✅ Check if journal.md has content |
| `lesson-consolidation` | bob | 7d | ~$0.50 | ✅ Already automated by `lessons-graduation.ts` — DISABLE |
| `analyze-failures` | bob | 24h | ~$1.00 | ✅ Check for new evaluations since last run |
| `common-sense-verify` | coach | 4h | $1.60 | ❌ Always has work (picks random item) |
| `common-sense-infra` | bob | 24h | ~$0.50 | ❌ Always has work (review task) |
| `training-sprint` | coach | 12h | ~$2.00 | ❌ Always has work (run experiments) |
| `research-intake` | coach | 12h | $1.80 | ⚠️ Could check if Scout/Amy-Kimi have new files |
| `optimize` | optimizer | 24h | ~$1.00 | ❌ Always has work (heartbeat covers this) |

## Proposed Fix: `run-agent-task` Pre-flight Hook

Add a `preflight` field to cron entries using `run-agent-task`. Before spawning the LLM session, the handler runs a lightweight JS check. If it returns false → skip the session entirely.

### Implementation Sketch

```typescript
// In run-agent-task handler or cron scheduler
interface PreflightCheck {
  type: 'file-has-content' | 'file-newer-than' | 'new-entries-since';
  path: string;           // File to check
  stateKey?: string;      // Key in handler state to track "last checked" timestamp
  minLines?: number;      // For file-has-content: minimum non-empty lines
}

// cron.json example:
{
  "name": "reflect",
  "handler": "run-agent-task",
  "agent": "coach",
  "intervalMs": 21600000,
  "preflight": {
    "type": "new-entries-since",
    "path": ".state/human-inputs.jsonl",
    "stateKey": "reflect-last-checked"
  }
}

{
  "name": "consolidate-memory-bob",
  "handler": "run-agent-task",
  "agent": "bob",
  "preflight": {
    "type": "file-has-content",
    "path": "agents/bob/workspace/journal.md",
    "minLines": 3
  }
}
```

### Cost-Benefit

- **reflect**: Fires 4×/day. Hao sends ~2-3 messages/day. ~50% of reflect sessions find nothing new. Saves ~$3.16/day.
- **consolidate-memory-***: 4 agents × weekly. Most journals are empty after consolidation. Saves ~$0.17/week (small but free).
- **lesson-consolidation**: Should be DISABLED entirely — `lessons-graduation.ts` does this already. Saves ~$0.50/week.
- **analyze-failures**: Fires daily. If no new evaluations since last run, skip. Saves ~$0.50/day on quiet days.

**Conservative estimate: $3-5/day = $90-150/month**

## Immediate Action: Disable `lesson-consolidation`

The `lesson-consolidation` cron (weekly Bob LLM session) is **completely redundant** with the `lessons-graduation` JS handler that already runs daily. The JS handler does:
- Size budget checks (2KB per agent)
- Stale entry detection (>14d)
- Strikethrough/GRADUATED/OBSOLETE markers
- Shared duplicate detection
- Reports to graduation-report.md

The LLM session adds no value. Recommend disabling it immediately in cron.json.

## Sent To

- tech-lead: Design brief for pre-flight hook in run-agent-task handler
- (lesson-consolidation disable can be done by any agent with cron.json access)
