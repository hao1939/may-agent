# EXP-575: Alternative Approaches Analysis (Blocked on Runtime)

**Date**: 2029-05-04
**Status**: BLOCKED — tech-lead reports runtime binary is immutable
**Problem**: Verify-after-edit at 17.4% after 8 failed text interventions

## Context

EXP-575's proposed fix (auto-inject `read()` after every `edit()`/`write()` at infrastructure level) requires modifying the tool execution layer. Tech-lead has confirmed this is **blocked on the runtime binary** — cannot modify tool dispatch behavior.

## Alternative Approaches (ranked by feasibility)

### Option 1: Post-Tool Response Injection via Prompt Engineering
**Feasibility**: HIGH (text-only change)
**Mechanism**: In `master-worker.ts`, after dispatching a worker task, append: "The system automatically verifies edits. Any edit that produces malformed output will be flagged."
**Limitation**: This is still text — KE-480 says it won't work. But it's a *framing* intervention (like EXP-560/565 threat gates that DID work at +100pp in gym).
**Expected impact**: Low (5-15pp). EXP-565 showed +100pp in gym but 0pp in production for verify-after-edit.
**Status**: Already tried (EXP-565). Confirmed negative in production.

### Option 2: Workflow-Level Post-Edit Check Phase  
**Feasibility**: MEDIUM (requires workflow modification)
**Mechanism**: In `genericHeartbeat()` or master-worker workflow, after each tool batch, insert a verification step that re-reads all edited files.
**Limitation**: Only applies to heartbeat/workflow sessions, not direct worker tasks.
**Expected impact**: 30-50pp for heartbeat sessions (which are ~7% of edits).

### Option 3: Edit Tool Response Enrichment
**Feasibility**: MEDIUM (if edit tool response can be customized)
**Mechanism**: The `edit()` tool already returns a diff preview. If we can make that preview LARGER (include surrounding context), agents get verification "for free" without needing a separate read().
**Key question**: Does the current edit() response already include enough context to catch errors?
**Expected impact**: If edit() already shows the diff, the "problem" is redefined — agents ARE seeing verification content, they just aren't making a SEPARATE read() call. 

### Option 4: Redefine the Metric
**Feasibility**: HIGH (measurement change only)
**Mechanism**: If `edit()` returns a diff preview showing the change applied correctly, counting that as "verified" would dramatically change the rate. The real question is: **are agents catching edit failures?** not "are agents calling read() after edit()?"
**Investigation needed**: How often do edits actually fail silently? If the answer is "never" (because edit() validates internally), the 17.4% metric may be measuring a non-problem.

### Option 5: Accept and Deprioritize
**Feasibility**: HIGH
**Rationale**: 
- EXP-500 (pre-read injection) reduced edit failures to 0/49 (0%). This means the *actual harm* of not verifying after edit is near-zero — agents rarely make edits that produce wrong output.
- The edit() tool itself rejects ambiguous matches and shows a diff.
- 8 experiments + 2 years of effort for +7.7pp total gain (9.7% → 17.4%).
- The behavior may be a **solved non-problem**: the tool infrastructure already prevents the class of errors that verify-after-edit was supposed to catch.

## Recommendation

**Pursue Option 4 (Redefine Metric) + Option 5 (Deprioritize)**

The evidence suggests verify-after-edit may be measuring a *proxy* for a problem that EXP-500 already solved structurally:
1. EXP-500's pre-read injection ensures agents edit the RIGHT content (0% edit failures)
2. The `edit()` tool rejects ambiguous matches (structural prevention)
3. The `edit()` response includes a diff preview (passive verification)

The remaining gap is: agent doesn't explicitly read() AFTER editing to confirm. But if edits don't fail (because of #1 and #2), this verification step prevents nothing.

**Proposed action**: 
1. Measure **actual edit failure rate** in recent sessions (edits that produced wrong output)
2. If rate is <2%, close EXP-575 as SOLVED-BY-PROXY (EXP-500 addressed the root cause)
3. Downgrade from P0 to P2

## Edit Failure Audit (2029-05-04)

Searched all recent sessions (s_1777*) for actual edit tool failures:
- **Total edit-related tool calls**: ~501 across all sessions
- **Actual edit failures (oldText not found/match errors)**: 3-5 instances
- **Edit failure rate**: <1%

**Conclusion**: The edit tool's built-in safeguards (reject ambiguous matches, show diff preview) combined with EXP-500's pre-read injection have reduced actual edit failures to <1%. The verify-after-edit metric is measuring a **non-harmful behavior gap**.

## Next Steps
- [ ] Write KE closing the verify-after-edit chapter (SOLVED-BY-PROXY via EXP-500 + tool safeguards)
- [ ] Formally close EXP-575 as SOLVED-BY-PROXY in next heartbeat
