# Issue Lifecycle Analysis — How Issues Flow Through the System Today

**Date**: 2026-04-16  
**Analyst**: Optimizer  
**Data sources**: todo.md issue tracker, requests table (9,778 total), session history

---

## 1. Five Issues Traced End-to-End

### Issue A: LiteLLM Strips Prompt Caching ($143/day waste)
- **Discovery**: Optimizer found via cost analysis (~Apr 7)
- **Tracking**: Added to optimizer todo.md as 🔴 ACTIVE
- **Handoff**: Optimizer dispatched P0 to bob (2x duplicate requests: req:095b5483, req:be599133) + P0 to may (2x duplicates: req:92a8f4c2, req:e1574126)
- **Resolution**: Bob completed request. May completed request. But the actual fix requires **operator action** (env var change) — neither agent can do it.
- **Status**: **STUCK — blocked on human operator for 9+ days**. Still listed as 🔴 ACTIVE with "BLOCKED on operator."
- **Lifecycle**: Discovery → Analysis → Dispatch → Agent-completed → **Stuck at human handoff**
- **Time**: 9+ days unresolved. Estimated $1,300+ waste during stall.

### Issue B: Coder 104-op Fewshot Injection False Positive
- **Discovery**: Optimizer found via session archaeology (~Apr 12)
- **Tracking**: Added to todo.md. Finding written to workspace/finding-coder-104op-archaeology-0412.md
- **Handoff**: Optimizer dispatched P2 to tech-lead (req:f70cc025, again duplicated req:d50784dc)
- **Resolution**: Tech-lead picked up → spawned work session (req:ce446650) → **fix implemented and committed**
- **Status**: ✅ RESOLVED. Listed in todo.md under ACTIVE (should be moved to DONE).
- **Lifecycle**: Discovery → Analysis → Finding → Dispatch → Work session → Fix committed → **Done**
- **Time**: ~2 days from discovery to fix. Clean handoff.

### Issue C: D-o-R Phase 1 Bloat (67% of D-o-R ops)
- **Discovery**: Optimizer found via session archaeology (~Apr 10)
- **Tracking**: Extensive tracking in todo.md with multiple measurement sessions
- **Handoff**: Self-handled — optimizer analyzed, designed fix (15-op budget cap), implemented, measured
- **Resolution**: Fix deployed (commit 40b22057). P1 avg 31.9→9.4 ops (71% reduction). Multiple verification sessions.
- **Status**: ✅ RESOLVED and moved to DONE section.
- **Lifecycle**: Discovery → Analysis → Design → Implement → Measure → Verify → **Done**
- **Time**: ~2 days. 9+ measurement sessions (possibly excessive).

### Issue D: May Heartbeat Bloat
- **Discovery**: Optimizer found via system-wide efficiency analysis (~Apr 12)
- **Tracking**: Added to todo.md as 🔴 ACTIVE
- **Handoff**: May dispatched work session to optimizer (req:9cdeddfb) for analysis. Optimizer analyzed + May self-fixed heartbeat.md
- **Resolution**: Verified — 22.4→7.3 ops avg (67% reduction), 96% budget compliance.
- **Status**: ✅ RESOLVED. Marked with "Status: DONE. Monitor in system health checks."
- **Lifecycle**: Discovery → Cross-agent dispatch → Analysis → Fix → Verification → **Done**
- **Time**: ~3 days. Clean resolution with good measurement.

### Issue E: Tool Adoption (gym-batch.sh, session-query.ts)
- **Discovery**: Optimizer built tools, tracked adoption (~Apr 11)
- **Tracking**: Tracked in todo.md with 4 consecutive adoption checks
- **Handoff**: Multiple attempts — context.md mentions, dispatch path integration discussions
- **Resolution**: gym-batch.sh eventually hit 42+ sessions adoption after structural integration. session-query.ts: **still zero adoption**.
- **Status**: **DECLARED DEAD** for prompt-based adoption strategy. Partial success.
- **Lifecycle**: Build → Track → Measure → Retry → Measure → Retry → **Declare dead / partial win**
- **Time**: 5+ days. Strategy pivot required (context.md → code integration).

---

## 2. Common Patterns

### How Issues Are Discovered
| Method | Frequency | Examples |
|--------|-----------|---------|
| **Optimizer scheduled analysis** (Mode A-D rotation) | Most common | D-o-R bloat, coder 104-op, May heartbeat |
| **Cron sensor-judge** (tool-quality-scan, error-scan) | Automated | Tool quality regressions (10+ dispatches) |
| **Cross-agent observation** | Occasional | May spotted scout op bloat |
| **Human input** | Rare | LiteLLM config, persistent-task design |

### How Issues Are Tracked
- **Primary**: optimizer `todo.md` — serves as the system's issue register
- **Secondary**: `requests` table — tracks dispatches but not issue lifecycle
- **Findings**: Written to `workspace/findings/` or `workspace/finding-*` files
- **No unified issue ID system** — issues referenced by description, not by ID

### How Issues Are Handed Off
1. **Agent dispatches request** via `agents.message()` — creates entry in requests table
2. Receiving agent picks up in next heartbeat or work session
3. **Duplicate dispatch is common** — LiteLLM issue had 4 duplicate requests (2 to bob, 2 to may)
4. Work sessions spawn sub-sessions for implementation

### How Issues Are Resolved
- **Self-fix**: Optimizer analyzes + implements (D-o-R bloat, heartbeat fixes)
- **Dispatch chain**: Optimizer analyzes → dispatches to tech-lead → tech-lead implements (coder fewshot)
- **Cross-agent**: May dispatches to optimizer for analysis → optimizer returns findings → May acts

---

## 3. Where Issues Get Stuck or Lost

### Stuck Point 1: Human/Operator Handoff (CRITICAL)
- LiteLLM issue blocked 9+ days on operator action
- No escalation mechanism beyond "BLOCKED on operator" in todo.md
- **$1,300+ burned** waiting. No reminder system, no deadline tracking.

### Stuck Point 2: CREATED Requests Never Picked Up
- **44 requests in CREATED status** right now (0.45% of total)
- Some are legitimate queue items, but many are stale:
  - Human messages to may from hours ago still CREATED
  - tech-lead requests from 30min ago still CREATED (normal)
- No aging/alerting on CREATED requests

### Stuck Point 3: Todo.md Section Drift
- Issue B (coder fewshot) is **resolved but still in ACTIVE** section — no one moved it to DONE
- Todo.md is 124 lines and growing — items accumulate without cleanup
- Observations section has items from Apr 10-12 that may be stale

### Stuck Point 4: Duplicate Dispatches
- Multiple issues had 2x duplicate requests (LiteLLM: 4 duplicates, fewshot: 2 duplicates)
- Wastes agent ops processing the same issue twice
- No dedup mechanism in the dispatch path

### Stuck Point 5: Measurement Loops
- D-o-R bloat had **9+ measurement sessions** — probably 4-5 too many
- Optimizer over-invests in verification of already-proven fixes
- No "good enough" threshold for measurement

---

## 4. Resolution Rates

### By the Numbers (from requests table)
| Status | Count | % |
|--------|-------|---|
| COMPLETED | 9,648 | 98.7% |
| CREATED (pending) | 44 | 0.45% |
| FAILED | 80 | 0.82% |
| IN_PROGRESS | 6 | 0.06% |

### But Request ≠ Issue Resolution
The 98.7% completion rate is misleading — most requests are heartbeats and routine work, not issue fixes. For actual issues:

**From the 5 traced issues:**
- 3/5 fully resolved (60%)
- 1/5 stuck on human handoff (20%)  
- 1/5 partially resolved / strategy abandoned (20%)

### Failed Requests Analysis
- 80 FAILED requests (0.82%) — mostly infrastructure:
  - `ENOENT reading handler` — file not found after deployment changes
  - `orphaned by restart` — sessions killed during system restarts
  - `coaching-feedback-wf` — recurring bug (`undefined is not an object`)
- These are **infra failures, not issue-handling failures**

### By Agent (issue-handling capacity)
| Agent | Issue Role | Bottleneck? |
|-------|-----------|-------------|
| Optimizer | Discovery + Analysis | No — consistently finds and analyzes issues |
| Tech-lead | Implementation | No — picks up and implements within hours |
| May | Routing + Operator escalation | **Yes — operator escalations stall indefinitely** |
| Bob | Architecture | Sometimes slow (CREATED requests accumulate) |

---

## 5. Key Findings

### Finding 1: The system discovers issues well but resolves them unevenly
Discovery is automated and reliable (cron sensors + optimizer rotation). But resolution depends entirely on whether the fix is within agent capability. Agent-fixable issues resolve in 1-3 days. Operator-dependent issues stall indefinitely.

### Finding 2: There is no issue lifecycle — just a loose chain
Today's "lifecycle" is: optimizer finds → writes finding → adds to todo.md → maybe dispatches → maybe someone picks up → maybe it gets fixed → maybe todo.md gets updated. There's no state machine, no escalation path, no deadline.

### Finding 3: Todo.md is the single point of truth — and it's fragile
All issue tracking runs through optimizer's todo.md. If optimizer misses a heartbeat cycle, issues don't advance. There's no shared issue registry across agents. Todo.md is already 124 lines and getting unwieldy.

### Finding 4: Duplicate dispatches waste ~1-2% of cross-agent ops
At least 4 issues had duplicate request dispatches. The agents system has no dedup. Each duplicate consumes a full work session of ops.

### Finding 5: Measurement overkill — issues get stuck in "verify" loop
The D-o-R bloat fix was verified across 9+ sessions. A 2-session verification policy would save significant ops while still being rigorous.

---

## 6. Recommendations for Issue Lifecycle Workflow

Based on these findings, an issue lifecycle workflow should address:

1. **State machine**: DISCOVERED → INVESTIGATING → FIX_DESIGNED → IMPLEMENTING → VERIFYING → RESOLVED (or ABANDONED/BLOCKED)
2. **Escalation timers**: Issues blocked >24h auto-escalate (especially operator-dependent ones)
3. **Shared registry**: Move from optimizer-only todo.md to a DB table or shared file
4. **Dedup on dispatch**: Check for existing open requests before dispatching
5. **Verification budget**: Cap at 2 measurement sessions per fix, not 9
6. **Auto-cleanup**: Move resolved items to DONE automatically when verification passes
