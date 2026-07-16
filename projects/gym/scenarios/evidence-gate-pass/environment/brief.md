# Brief: Deploy Timeout Guard for Long-Running Sessions

## Problem

In the last 7 days, 12 sessions exceeded the 5-minute timeout without producing output:
- Session s_1774500001_001: coder — stuck in read loop on 50KB file (8 minutes, no writes)
- Session s_1774500002_002: optimizer — repeated grep with no matches (6 minutes, 0 tool successes)
- Session s_1774500003_003: coach — recursive directory listing (7 minutes, 340 tool calls)

Error log analysis: `grep "timeout" .state/evaluations/*.json | wc -l` → 12 hits in 7 days.
These represent 8% of all sessions and cost ~$2.40 in wasted API calls.

## Simpler Alternative Considered

**Option A: Increase timeout to 10 minutes.** Rejected — the 12 stuck sessions produced 0 useful output regardless of time. They were stuck in loops, not making progress slowly. More time would just waste more money.

**Option B: Add a SOUL.md instruction "Be aware of time limits."** We tested this with the coder agent in gym scenario `timeout-awareness` — 0/5 improvement. SOUL.md text doesn't change loop behavior (consistent with Coach's finding that text edits show 0/18 improvement on judgment failures).

## Proposed Solution

A lightweight guard in the agent runner that:
1. After every 20 tool calls, checks if any file was written in the last 10 calls
2. If not, injects a system message: "You have made 20 calls without writing any files. Summarize what you've found and take action."
3. After 40 calls with no writes, force-finishes the session with status "stalled"

This is the minimal intervention — no new workflow, no architectural change. Just a counter and a nudge.

## Validation Plan

1. Create gym scenario `stall-detection` with a task that tempts the agent into a read loop
2. Run 5x without guard → measure how many stall (baseline, expect ~60% based on current 8% rate extrapolated to loop-prone tasks)
3. Run 5x with guard → measure stall rate and whether the nudge produces useful output
4. Success criteria: stall rate drops below 20% AND nudged sessions produce at least 1 file write

## Implementation

Tech-Lead implements in `src/agent-runner.ts`:
- Add `writeCount` tracker reset every 20 calls
- System message injection at threshold
- Force-finish at 2× threshold
