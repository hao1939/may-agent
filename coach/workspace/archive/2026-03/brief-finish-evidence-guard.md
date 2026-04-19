# Brief: finish() Evidence Validation Guard

## Problem
Bob has 4 FM-2.2 (INSUFFICIENT_EVIDENCE) errors where he claims deliverables or verification without actual evidence. Text coaching is confirmed 0% effective for this pattern (exp-053: 0/5 sessions improved after 3 layers of coaching text).

## Root Cause
Two sub-patterns:
1. **Checkpoint chain** (2/4): Bob calls `bash checkpoint` → fails → doesn't recover → claims "verified" anyway. The FM-2.6 infra guard (exp-052, commit 07b0d7f) should block the bad invocation path. Awaiting deployment.
2. **Investigation abandonment** (2/4): Bob searches for something (session dir, code pattern), first attempt fails (grep exit 1, ls wrong path), and he gives up — claiming the target doesn't exist rather than trying alternative paths.

## Proposed Solution
Add evidence validation to the `finish()` tool (or a pre-finish hook):
- When `finish()` is called with `deliverables`, verify each file path exists
- When `finish()` is called with `status: "success"`, check that no tool calls in the session returned errors that were never addressed
- If validation fails, return the finish call with a warning/block asking the agent to verify

This is analogous to the FM-2.6 infra guard concept — mechanical enforcement at the tool level rather than text coaching.

## Priority
Medium — the FM-2.6 guard handles 2/4 errors. The remaining 2 are lower frequency. But this would be a systemic fix that catches evidence gaps across ALL agents, not just Bob.

## Evidence
- exp-053: 0/5 text coaching effectiveness for checkpoint verification
- exp-054: root cause analysis showing 4 FM-2.2 errors split into 2 categories
- Method catalog: 0/13 text experiments improved judgment, 100% workflow enforcement
- Authority hierarchy: mechanical enforcement (layer 1) > all text coaching (layers 3-4)
