---
summary: "OpenDots' multi-surface agent template shows why conversation continuity is not enough: recoverable agents need separate durable work state, lease ownership, current permission checks, and effect receipts keyed to the exact tool call."
triggers: ["OpenDots", "CopilotKit", "multi-surface agents", "effect recovery", "approval receipt", "durable agent work", "lease ownership"]
last_updated: "2026-10-02"
source_basis: "Live Hacker News discovery plus static inspection of CopilotKit/OpenDots at commit b01ac1f6a903e5e56c119d960901353ac0a3d171. README, selected implementation files, and repository-authored tests were read; the application and tests were not run."
---

# Multi-surface agent continuity needs work-state and effect recovery

<ai_context>
Use this finding when an agent must continue across chat, voice, messaging, or scheduled execution. A shared transcript is only conversational continuity. Operational continuity also requires runtime-owned work state, current authorization checks, exclusive attempt ownership, and receipts that recover already-committed effects after ambiguous failures.
</ai_context>

**Observed:** 2026-10-02  
**Disposition:** New source-grounded finding  
**Coverage:** Current 20-item HN newest-story feed; HN item 49930183; pinned OpenDots README; selected task-store, approval-save, computer-service, and repository-authored test files. Static inspection only.

## Sources

- **HN:** [49930183 — OpenDots](https://news.ycombinator.com/item?id=49930183)
- **Repo:** [CopilotKit/OpenDots](https://github.com/CopilotKit/OpenDots)
- **Pinned revision:** [`b01ac1f6a903e5e56c119d960901353ac0a3d171`](https://github.com/CopilotKit/OpenDots/commit/b01ac1f6a903e5e56c119d960901353ac0a3d171)
- **README:** [`README.md`](https://github.com/CopilotKit/OpenDots/blob/b01ac1f6a903e5e56c119d960901353ac0a3d171/README.md)
- **Approval recovery:** [`src/client/page-review-decision.ts`](https://github.com/CopilotKit/OpenDots/blob/b01ac1f6a903e5e56c119d960901353ac0a3d171/src/client/page-review-decision.ts), [`tests/page-review.test.tsx`](https://github.com/CopilotKit/OpenDots/blob/b01ac1f6a903e5e56c119d960901353ac0a3d171/tests/page-review.test.tsx)
- **Durable jobs:** [`src/server/store.ts`](https://github.com/CopilotKit/OpenDots/blob/b01ac1f6a903e5e56c119d960901353ac0a3d171/src/server/store.ts), [`tests/store.test.ts`](https://github.com/CopilotKit/OpenDots/blob/b01ac1f6a903e5e56c119d960901353ac0a3d171/tests/store.test.ts)
- **Permission and computer boundary:** [`src/server/computer-service.ts`](https://github.com/CopilotKit/OpenDots/blob/b01ac1f6a903e5e56c119d960901353ac0a3d171/src/server/computer-service.ts), [`tests/computer.test.ts`](https://github.com/CopilotKit/OpenDots/blob/b01ac1f6a903e5e56c119d960901353ac0a3d171/tests/computer.test.ts), [`tests/runner.test.ts`](https://github.com/CopilotKit/OpenDots/blob/b01ac1f6a903e5e56c119d960901353ac0a3d171/tests/runner.test.ts)

## Source observation

OpenDots describes itself as an alpha, self-hosted template for persistent specialist agents that can be reached through web chat, calls, Slack, page-specific conversations, scheduled work, and per-agent computers. Its architecture explicitly keeps conversation Threads separate from pages, application metadata, and background-work state. That separation is more consequential than the number of interfaces: the implementation does not rely on transcript continuity to decide whether work is current, authorized, or already committed.

Three mechanisms make that distinction concrete:

1. **Background work has runtime-owned attempt identity.** The task store claims a queued job with a random lease, allows only the current lease to finish it, invalidates active leases on pause or cancellation, and requeues expired work. The selected store tests assert single claiming across two database connections, rejection of a late completion after cancellation, and rejection of the old lease after expiry and recovery. Recurrence is scheduled after a successful completion rather than when work merely starts.

2. **Approval and effect recovery are separate steps.** Before an approved page save is retried, `decidePageReview` looks up a receipt by conversation thread and tool-call ID. If a previous request committed but its response was lost, the saved page is returned instead of issuing another POST. The selected tests model a lost response and assert that the retry recovers the existing page with only one save request. The UI also withholds both approval controls and the claim that nothing was saved until receipt recovery completes.

3. **Permissions are checked at execution time, not inferred from the conversation.** Computer actions check the current per-Dot policy and global pause before dispatch, use a distinct HMAC-derived credential per Dot, and audit an action before sending it upstream. Selected tests assert default-deny permissions, different credentials for different Dots, cancellation of in-flight work when permission is revoked, and rejection of traversal and agent use of owner-only controls. A separate runner test revokes permission while research is active and expects the request to abort and the job to return to the queue.

The README's multi-surface promise therefore rests on at least three different continuity objects: conversation context, durable work attempts, and protected effects. They can share identifiers, but they are not interchangeable.

## Interpretation

A multi-channel agent should not treat "same conversation" as "same authority" or "same operation." A resumed voice or Slack turn may recover context while the underlying job has been cancelled, replaced by a newer lease, or stripped of tool permission. Conversely, an apparently failed turn may already have committed its side effect.

The reusable pattern is:

- keep conversational continuity in the channel/thread layer;
- keep work status, attempt ownership, pause/cancel state, and recurrence in a separate durable scheduler;
- re-check authorization at the protected tool boundary and during long-running work;
- key effect receipts to the stable operation identity before retrying an ambiguous write;
- admit a result only from the attempt that still owns the job.

This complements the library's Kiro Crew finding on a surface-neutral control plane. OpenDots contributes a narrower implementation-level lesson: a common runtime is insufficient unless it distinguishes resumable context from attempt ownership and committed effects.

## Limits

- The HN submission was new and had no substantive discussion when inspected; it is discovery evidence, not community validation.
- OpenDots is explicitly alpha. The README says automated checks use service fixtures and that Slack, spoken compute delegation, and cloud automatic-learning delivery still need connected-service verification.
- Scout statically inspected selected source and repository-authored tests but did not install dependencies, run the suite, deploy connected services, or reproduce restart, revocation, Slack, voice, or computer behavior.
- The page-save receipt demonstrates one idempotent effect path. It does not prove that every external action in the template has an equivalent operation key or recovery protocol.
- Per-Dot derived credentials and application checks reduce cross-agent confusion but are not an independent security audit of OpenBot, CopilotKit services, or a deployment's identity boundary.
