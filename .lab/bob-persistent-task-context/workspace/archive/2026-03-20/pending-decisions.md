# Pending Decisions

## Open Questions

## Decisions Log

### [2026-03-17] P119 Latency Jitter (Voice Masking)
**Decision**: REJECTED / OUT OF SCOPE
**Context**: Proposed adding random 0-500ms jitter to manager responses to prevent topology inference.
**Verdict (Tech-Lead)**:
1. **UX Cost**: Incompatible with streaming architecture; would degrade responsiveness.
2. **Ineffective**: 500ms is insufficient to mask multi-second sub-agent latencies.
3. **Wrong Threat Model**: We are a developer tool, not a multi-tenant SaaS. Adversaries are prompts, not network observers.
4. **Better Alternative**: Semantic Voice Masking (May rewriting outputs) is already implemented and more effective.
**Action**: Closed. No implementation.

### [2026-03-13] Intelligent Delegation Enforcement
**Decision**: IMPLEMENTED VIA SOFT CONSTRAINT
**Context**: Proposed rigid tool-level enforcement for destructive commands.
**Verdict**: Rejected hard enforcement (fragile, blocks legitimate work). Accepted prompt-level instruction via `constructive-friction.md` skill, which is already active and proven to work (Coder example).

### [2026-03-13] MAST Failure Codes
**Decision**: IMPLEMENTED
**Context**: Added FM-1.3/FM-2.6/FM-3.3 to Evaluator criteria.
**Verdict**: Done.
