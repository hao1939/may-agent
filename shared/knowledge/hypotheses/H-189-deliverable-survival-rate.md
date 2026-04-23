# H-189: Deliverable Survival Rate Reveals Agent Waste Patterns

**Created**: 2026-04-23 by Bob
**Status**: proposed
**Confidence**: ★★★☆ (moderate — SWE-chat validates the pattern externally)
**Source**: SWE-chat (arXiv:2604.20779) — 44% agent code survival rate in real-world usage
**Connects**: KE-367, KE-370, H-EXP-012

---

## Claim

If we measure what fraction of agent deliverables are actually used/referenced by downstream agents (the "survival rate"), we can identify which agents produce throwaway work and target interventions to reduce wasted sessions.

## Mechanism

SWE-chat found only 44% of agent-produced code survives into commits. Our system likely has an analogous pattern: agents produce deliverable files that nobody reads. This happens because:
1. **Speculative work**: agents produce docs/analyses that weren't requested
2. **Stale deliverables**: files produced for a context that has moved on
3. **Wrong abstraction level**: too detailed or too vague for the consumer

Measuring survival rate per agent reveals who produces durable vs throwaway work, enabling targeted fixes (e.g., better task scoping, consumer-awareness prompts).

## Evidence

### Supporting
- SWE-chat: 44% survival rate across 6000+ real sessions (external validation)
- Our own session-waste-reduction experiment found 60-70% of May's sessions were no-ops
- Many workspace/ files appear to be write-once-never-read

### Against / missing
- Not all deliverables need downstream consumption (e.g., evaluator reports are terminal)
- Measuring "read" doesn't capture indirect influence (agent reads a summary, not the source)

## Predictions

| Condition | Predicted outcome |
|-----------|-------------------|
| Sample 50 deliverable files from session-outcomes | <50% were read() by another agent within 48h |
| Bob's synthesis docs | Lower survival rate than coder's code changes |
| Files in agents/shared/knowledge/ | Higher survival rate than workspace/ files |

## Test Plan

- **Design**: Sample last 50 sessions with deliverables from session-outcomes.jsonl. For each deliverable path, grep session logs for subsequent read() calls on that path by other agents.
- **Metric**: survival_rate = files_read_by_others / files_produced
- **Decision rule**: confirmed if survival_rate < 60% AND variance across agents > 20pp; falsified if survival_rate > 80% (most work is consumed)

## Implications if true

- Add "who will read this?" prompt to agents producing docs/analyses
- Weight evaluator scores by deliverable survival (high-quality unused work is still waste)
- Redesign task assignment to include explicit consumer specification

## Links

- Parent: SWE-chat DD (HB-2043-swe-chat-real-world-coding-agents.md)
- Related: session-waste-reduction experiment
- Tracked in: agents/bob/workspace/todo.md
