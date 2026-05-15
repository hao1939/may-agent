# Bob Heartbeat Analysis — 2025-05-03 Session C

## Key Findings

### 1. Repeated Task Loop: Bob Interrupted Sessions

System status shows **50+ interrupted bob sessions** all trying the same 2-3 tasks:
- "Ship EXP-188 finish-guard to production" — 15+ interrupted attempts
- "Resume context-learning project" — 10+ interrupted attempts  
- "Process scout deep-dives into knowledge entries" — 10+ interrupted attempts

**Root Cause**: These tasks were dispatched as fork sessions that kept getting interrupted (likely by timeouts or system restarts). Each heartbeat re-dispatched them without checking if the previous attempt made progress.

**Waste Estimate**: ~50 interrupted sessions × avg startup overhead = significant wasted compute.

**Recommended Fix**: 
- Before dispatching a persistent task, check if >3 prior attempts were interrupted
- If so, either: (a) escalate to human, (b) change approach, or (c) explicitly kill and redesign
- Add a "max retry" counter to fork dispatches

### 2. Evaluator Tool Allowlist Bug (from prior analysis)

Evaluator penalizes `notify` tool usage because its TOOLS.md only lists its own tools. When evaluating other agents, it uses this incomplete list, causing ~50% false negative evals for coordination-heavy agents (bob, coach, may).

**Status**: Identified in memory-stream but no fix shipped yet.

### 3. Stale Session Count Not Monitored

Current metrics track `session.error-rate-6h` but not stale running sessions. System shows 1 idle session (may, 86h+) and hundreds of "interrupted" sessions with ⚠️ long markers.

The `session.stale-running-count` metric proposed in the previous analysis would catch these.

### 4. Agent-System-Literacy Project (Closed)

Project status: closed with 5/6 milestones complete. No action needed.

### 5. Zero Active Projects for Bob

Metrics show `Active projects: 0` against target of 3. Bob has no active project to drive. 

**Options**:
- Investigate the repeated-dispatch loop pattern and design a structural fix (EXP proposal)
- Design an experiment around the evaluator tool-allowlist bug
- Start a "session hygiene" project to reduce interrupted session waste

## Action This Session

Writing this analysis as the session artifact. The most impactful next step would be designing a retry-limiter for fork dispatches — this would eliminate the 50+ wasted interrupted sessions pattern seen in system status.

## Hypothesis: H-SESSION-RETRY

**Claim**: Adding a max-retry counter (n=3) to fork dispatches will reduce interrupted session waste by >80%.

**Test**: Count interrupted sessions per unique task string over 48h, before and after adding a retry check to the dispatch logic.

**Priority**: Medium — the waste is real but doesn't block other work.
