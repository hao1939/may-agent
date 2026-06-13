# Evaluator Feedback Loop Closure Analysis

## Summary

**Feedback-to-behavior closure rate via direct loop: 0%**  
**Improvement on flagged dimensions via indirect convention pathway: ~85%**

The evaluator feedback loop is structurally OPEN. Evaluator verdicts generate `learning.feedback` events, but these are never consumed by agents. All 248 learning.feedback events in the system remain in `pending` status — zero have been handled.

However, agent behavior has dramatically improved on every flagged dimension. This improvement flows through an indirect pathway: R&D audit tasks (this project) → conventions/prompts → agent behavior change at session start.

## Method

- Sampled 10 sessions with negative evaluator feedback across scout, may, and dev
- Tracked 5 flagged issue dimensions over time (early vs late periods)
- Checked whether `learning.feedback` events are consumed
- Measured behavior change on each dimension

## Findings

### 1. Direct Feedback Loop Is Broken

| Component | Status |
|-----------|--------|
| Evaluator produces verdicts | ✅ Working (3,270 needs_improvement verdicts) |
| Aftermath emits learning.feedback | ✅ Working (248 events) |
| Agents consume feedback events | ❌ BROKEN (0/248 handled) |
| Agents see feedback in inbox | ⚠️ Appears in heartbeat inbox but is never acted upon |

### 2. Behavior Improvement (Indirect Path)

Despite the broken direct loop, agents improved dramatically on all flagged dimensions:

| Issue Dimension | Agent | Early Count | Late Count | Reduction |
|-----------------|-------|-------------|------------|-----------|
| HALLUCINATION | scout | 21 | 0 | 100% |
| HALLUCINATION | may | 20 | 0 | 100% |
| shallow session | may | 253 | 0 | 100% |
| shallow session | scout | 77 | 4 | 95% |
| schema/query error | may | 195 | 4 | 98% |
| schema/query error | dev | 52 | 0 | 100% |
| finish blocked | may | 225 | 3 | 99% |
| finish blocked | dev | 40 | 1 | 98% |
| VERIFICATION failure | dev | 39 | 4 | 90% |
| VERIFICATION failure | may | 89 | 11 | 88% |

### 3. Mechanism of Improvement

The improvement happened NOT through the evaluator feedback loop, but through:

1. **Prompt/convention injection**: R&D tasks (this project) identified patterns, drafted conventions (self-correction, finish-contract, etc.), and injected rules into agent prompts
2. **Guard rails**: Platform-level guards (T2-no-post-write-verification, finish-blocked-uncommitted) enforce behavior at runtime
3. **Task prompt hardening**: Task prompts were iteratively improved (e.g., scout's arXiv task gained `sortOrder=descending (not desc)` and URL constraints after repeated failures)

### 4. Scout Case Study (10 sessions traced)

Scout sessions show the clearest pattern:
- **Early** (pre-1779B): Repeated HALLUCINATION (scrape_webpage claims), verification failures, path confusion, low-value heartbeats
- **Late** (post-1779B): HALLUCINATION eliminated (tool environment fixed), shallow sessions reduced 95%, schema errors gone
- **Cause**: Tool environment was corrected (scrape_webpage removed/replaced), task prompts hardened, not because scout "learned" from feedback

### 5. May Case Study

- "schema/query error" was the dominant issue (195 early occurrences) — this was a DB schema mismatch issue
- Fixed by DB column documentation injected into agent prompts (DB Schema section in task prompts)
- Evaluator flagged it 195 times before a human/R&D intervention fixed the root cause

## Conclusions

1. **The evaluator feedback loop has zero direct closure** — agents do not read, process, or adapt based on learning.feedback events
2. **Behavior improvement is real (~85-100% reduction)** but flows through a manual R&D → convention → prompt pathway
3. **The feedback signal has value** but only when a human/meta-agent reads evaluations, identifies patterns, and pushes fixes through the system
4. **Without the indirect pathway, the same issues would repeat indefinitely** — as demonstrated by the 195+ repeated "schema/query error" flags before intervention

## Recommendation

The feedback loop needs one of:
- **A) Agent-side feedback consumer**: Agents should read their last N evaluation issues at session start and adapt (simplest: inject last-session issues into heartbeat context)
- **B) Automated pattern detector**: A handler that aggregates repeated issues per agent and auto-generates prompt patches or context facts
- **C) Accept the indirect model**: Formalize the current R&D-driven improvement cycle as the intended mechanism and drop the pretense of a direct feedback loop

Current state is wasteful: 248 pending events consuming storage with no consumer. Either build the consumer or stop emitting.

## Evidence

- `query_db`: All 248 learning.feedback events have status='pending', handled_by=NULL
- `query_db`: Issue dimension counts show 85-100% reduction across all tracked dimensions
- `query_db`: Evaluations table shows 3,270 needs_improvement verdicts total
- Scout progression from quality 0.2-0.55 (early heartbeats) to 0.55-0.8 (recent) tracks convention/prompt fixes, not feedback consumption
