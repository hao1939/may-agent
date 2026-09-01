<ai_context>
summary: "Rome's subagent design separates execution ownership from presentation: every delegated run owns a durable child session, transcript, trace, lifecycle, and accounting, while the parent retains lineage plus one structured completion. This prevents child output from masquerading as a successful parent terminal and prevents inclusive parent accounting from double-counting descendant usage."
triggers: ["subagent session", "delegation lineage", "agent accounting", "nested agent trace", "child session", "parent completion", "Rome OS"]
last_updated: "2026-08-27"
source_basis: "GitHub Search metadata plus Rome's primary repository documentation, accepted ADRs, implementation, and tests at revision 3bfc0e1eaf6e06d3cd2f3a5e98dc6e74151813ed."
</ai_context>

# Delegation Needs Evidence Ownership, Not Just Agent Tags

Date: 2026-08-27  
Source: GitHub  
Repo: https://github.com/rome-os/rome

## Signal

Rome makes a useful distinction that many nested-agent traces blur: **lineage is
not ownership**. A delegated subagent runs in a first-class child session that
owns its transcript, trace, lifecycle bracket, status, and usage. The parent
keeps a durable child reference and receives one structured completion, rather
than copying the child's event stream and accounting into its own record.

This is more than a UI choice. If child terminals are flattened into the parent
stream, a consumer can mistake a successful child result for the parent reply
when the parent fails afterward. If the parent stores an inclusive usage total
while each child also stores its own accounting, global rollups count the same
work twice. Agent labels do not repair either problem: a label helps presentation
but does not identify which durable lifecycle owns the evidence.

## Source-grounded details

- GitHub repository search for `(agent OR agentic) created:>=2026-08-20
  stars:>10`, sorted by stars, returned 139 repositories. Rome appeared among
  the leading new repositories with 364 stars at retrieval time. Popularity is
  an attention signal, not validation of maturity.
- The inspected revision is
  `3bfc0e1eaf6e06d3cd2f3a5e98dc6e74151813ed`. Rome's README describes a
  broad agentic-OS product, but the narrower evidence-ownership contract is
  documented in accepted ADRs and represented in implementation and tests.
- A fresh delegation creates a session of type `subagent`, stamped with
  `parentSessionId` and `parentTurnId`. The child turn is sent with a separate
  lifecycle parent reference, and the runtime registers the live
  parent-tool-use-to-child-turn link.
- The completion contract returns child `sessionId`, child `turnId`, status,
  and output or error. The active link is intentionally retained until the
  parent's ordinary tool result is persisted, so completion notification does
  not race ahead of the parent's durable evidence.
- The child trace recorder persists the child's own transcript and trace. The
  corresponding test asserts fresh IDs, parent lineage, child-owned user,
  assistant, and trace messages, and same-parent restrictions on resume.
- Every turn is producer-bracketed with `turn_start` and `turn_end`. The closing
  bracket carries turn outcome and wall-clock duration, while model-call
  accounting remains a different field. This lets live streaming, replay, and
  analytics reach the same lifecycle interpretation without guessing from
  stream closure or whichever result arrived last.
- Descendant-inclusive cost is computed by walking child references at read
  time, not copied into the parent's stored accounting. Global usage can
  therefore sum each session's own rows exactly once.
- The design keeps child sessions when a parent is deleted because they remain
  debugging evidence, but resume is parent-scoped. It also explicitly admits a
  limitation: an in-flight parent-child handle is process-local, so a crash can
  lose the live execution even though already-persisted child evidence remains.
- Scout inspected the repository's source and test assertions but did not run
  its Node/Docker test suite. The tests are implementation evidence, not an
  independently reproduced validation result.

## Why it matters

Nested execution creates at least four different relations that should not be
collapsed into one event stream:

1. **Lineage** — which parent turn delegated this work?
2. **Evidence ownership** — which session owns the transcript and trace?
3. **Completion delivery** — what bounded result is returned to the parent?
4. **Aggregate presentation** — how should a UI or cost report join descendants?

Making the child the durable owner resolves these independently. The parent can
still present a nested view and an inclusive cost, but those are read-time joins
over lineage, not duplicated facts. This also supplies a clean failure rule: a
child can succeed while its parent fails, and both outcomes remain true without
one terminal overwriting the other.

## Reusable guidance

- Give every delegated run a durable execution identity and lifecycle owner;
  do not use agent-name tags as a substitute.
- Persist one parent reference and one bounded completion. Keep child text,
  tool events, and accounting in the child record.
- Clear live delegation links only after the parent has persisted the completion
  that cites them, not merely when the child stops.
- Compute descendant-inclusive views by traversing lineage at read time. Store
  each cost and terminal exactly once.
- Stamp turn boundaries and producer identity in-band so replay and analytics do
  not infer lifecycle from transport closure or event adjacency.
- State crash semantics separately from persistence semantics: durable evidence
  can survive even when in-flight work is not resumable.

## Primary sources

- Repository at inspected revision: https://github.com/rome-os/rome/commit/3bfc0e1eaf6e06d3cd2f3a5e98dc6e74151813ed
- Child-session ownership ADR: https://github.com/rome-os/rome/blob/3bfc0e1eaf6e06d3cd2f3a5e98dc6e74151813ed/docs/adrs/child-session-owns-subagent-stream-and-cost.md
- Producer-stamped turn lifecycle ADR: https://github.com/rome-os/rome/blob/3bfc0e1eaf6e06d3cd2f3a5e98dc6e74151813ed/docs/adrs/producer-stamped-agent-identity-and-turn-terminal.md
- Session contracts: https://github.com/rome-os/rome/blob/3bfc0e1eaf6e06d3cd2f3a5e98dc6e74151813ed/docs/concepts/sessions.md
- Subagent execution service: https://github.com/rome-os/rome/blob/3bfc0e1eaf6e06d3cd2f3a5e98dc6e74151813ed/packages/core/src/core/subagent-execution.ts
- Subagent execution tests: https://github.com/rome-os/rome/blob/3bfc0e1eaf6e06d3cd2f3a5e98dc6e74151813ed/packages/core/src/core/subagent-execution.test.ts
