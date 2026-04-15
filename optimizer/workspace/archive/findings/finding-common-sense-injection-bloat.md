# Finding: common-sense.md Injection Bloat

**Date**: 2026-03-18T05:31 UTC
**Severity**: HIGH (cost impact: ~$31/day)
**Category**: Waste Elimination, Performance & Efficiency

## Problem

The full text of `agents/shared/common-sense.md` (11,504 bytes, ~2,876 tokens) is injected into the `task` field of **every heartbeat session** for **every agent**. This text is:

1. **Identical across all agents** — same 11KB every time
2. **Static** — rarely changes (last edited 2026-03-16)
3. **72-92% of each task prompt** — drowning out the actual agent-specific instructions

### Evidence (from active sessions at 05:31 UTC)

| Agent | Task size | Common-sense | % of task |
|-------|-----------|-------------|-----------|
| Amy | 12,453 chars | 11,461 chars | **92%** |
| Amy-Kimi | 14,000 chars | 11,461 chars | **81%** |
| Scout | 15,910 chars | 11,461 chars | **72%** |

### Cost Impact

- ~2,876 tokens per injection × $15/MTok (Opus input) = $0.043 per session
- At ~30 sessions/hour (current rate with overtriggering) = $1.29/hour
- **$31/day** just for the repeated common-sense injection
- If prompt caching worked: would drop to ~$3.10/day (90% cache discount)
- But caching is broken → full cost every time

## Root Cause

In `src/app/cron.ts` (or wherever heartbeat messages are assembled), the system concatenates:
1. The heartbeat prompt (agent-specific)
2. `agents/shared/common-sense.md` (static, identical for all)

Both go into the `task` field, which becomes the user message. Since prompt caching works on the system prompt prefix (not user messages), this 11KB is never cached even when caching is working.

## Proposed Fix

**Option A (Quick)**: Move common-sense.md to the system prompt. It's stable, shared text that should be part of the system prompt prefix where Anthropic's caching can handle it. Cost: $3.10/day instead of $31/day (once caching is fixed).

**Option B (Better)**: Don't inject it at all. Agents already have SOUL.md + LESSONS.md for behavioral guidance. Common-sense rules that agents need should be:
- Encoded in SOUL.md (per-agent, stable, already in system prompt)
- Enforced by infrastructure (guards, validators — many already built)
- Reference-only: "See agents/shared/common-sense.md" in SOUL.md, agents read it themselves only when needed

**Option C (Best)**: Compress to a 500-byte summary with just the 5 most critical rules. Full document available on-demand. Would reduce injection cost by 95%.

## Savings Estimate

| Scenario | Daily cost | Monthly cost |
|----------|-----------|-------------|
| Current (11KB injected, no caching) | $31.06 | $931.80 |
| Option A (system prompt, caching works) | $3.10 | $93.18 |
| Option B (no injection) | $0.00 | $0.00 |
| Option C (500-byte summary) | $1.35 | $40.50 |

## Dependencies

- Option A needs tech-lead to move injection to system prompt assembly
- Option B needs Coach to verify agents can function without injection
- Options A/C still need process restart + caching fix for full savings
