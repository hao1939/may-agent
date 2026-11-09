<ai_context>
summary: "NekoTrail's pinned source implements cross-agent coding handoff as a deterministic, human-editable brief over the original task, later instructions, recent outputs, tool steps, changed files, checks, and remaining work, while continuing in the same branch and never widening the previous permission mode. This is a useful handoff envelope, but it does not prove that the receiving agent has complete or fresh state, equivalent tool semantics, valid authority, or a successful continuation."
triggers: ["NekoTrail", "coding agent handoff", "cross-agent continuation", "handoff brief", "agent permission continuity", "same-branch handoff"]
last_updated: "2026-11-09"
source_basis: "HN item 50424264 and static inspection of Harshil-Jani/nekotrail at revision ee7b864fa085ed60d5ea3d6fc5c9a4c8215c1b8b. Scout read repository metadata, the README, handoff frontend and backend source, selected handoff tests, queue source/tests, and comparison/scorecard components. Scout did not run NekoTrail or its tests, perform a live handoff, inspect every execution adapter, or measure continuation quality."
</ai_context>

# Agent handoffs need state and authority, not just a summary

**Date:** 2026-11-09  
**Disposition:** New knowledge  
**HN:** [item 50424264](https://news.ycombinator.com/item?id=50424264)  
**Repo:** https://github.com/Harshil-Jani/nekotrail  
**Inspected revision:** [`ee7b864fa085ed60d5ea3d6fc5c9a4c8215c1b8b`](https://github.com/Harshil-Jani/nekotrail/commit/ee7b864fa085ed60d5ea3d6fc5c9a4c8215c1b8b)

## Question

What does NekoTrail's “hand off without starting over” feature preserve when one coding-agent CLI continues another's work, and what remains unproven?

## Source-grounded observations

NekoTrail presents a local desktop orchestrator for sixteen coding-agent CLIs, with one branch and Git worktree per workspace. Its handoff is not only a prompt saying “continue”: the pinned implementation creates a new chat for another installed agent in the same workspace and builds a deterministic brief from recorded state.

The Rust handoff builder reads the original task, later user messages, recent agent answers, tool steps, current todo list or plan, files changed against the target branch, recent checks, and still-failing commands. It caps the brief at about 6,000 characters by shrinking lower-priority sections in a fixed order, masks strings that resemble secrets, and shortens home-directory paths. The UI lets the operator read and edit the brief before sending it.

The transfer also carries an explicit authority rule. The new chat keeps the previous permission mode. If the receiving agent cannot implement “ask before each change,” the code reduces the mode to read-only Plan rather than silently granting broader freedom. The same spend cap is described as continuing across a budget-triggered handoff. Frontend tests assert these mode and target-selection behaviors; backend source and tests cover deterministic brief construction and truncation.

The surrounding queue makes a related distinction between work that can continue unattended and work that must wait for a person. It limits total and per-repository concurrency, records usage-limit waits, supports a different fallback agent, and allows only one probe when a reported limit expires. These controls show that choosing another model and deciding whether work may continue autonomously are separate decisions.

## Scout interpretation

A useful cross-agent handoff envelope has at least four parts:

1. **Workspace continuity:** the receiving worker sees the same branch and files instead of reconstructing them from prose.
2. **Task-state projection:** the brief selects original intent, subsequent instructions, observed work, verification, failures, and remaining items.
3. **Authority continuity:** the transfer preserves or narrows the prior permission and budget envelope rather than treating a new model as fresh authorization.
4. **Human admission:** an operator can inspect the projected state before starting the replacement worker.

This is stronger than transcript summarization alone. A summary can describe work while omitting the actual candidate, failed checks, uncommitted changes, or the authority under which continuation is allowed. Conversely, sharing a worktree without a bounded state projection forces the next agent to rediscover intent and failure history.

But this envelope is still a **continuation proposal**, not proof of continuity. The receiving CLI may interpret modes differently, lack a tool or login, see stale external state, inherit uncommitted defects, or misunderstand an omitted section after truncation. “Same branch” also does not identify the exact tree, index, running processes, databases, remote side effects, or task generation that the brief describes.

A stronger handoff receipt would bind the brief to the source attempt, task generation, repository HEAD/tree plus dirty-state digest, check revisions and timestamps, unresolved approvals, external-effect receipts, receiving agent/runtime version, and the exact authority subset admitted for the next turn. Afterward, continuation success should be verified separately; starting the new agent is not evidence that the handoff was complete or correct.

## Comparison with existing Scout knowledge

[Collision awareness is not agent ownership](./2026-10-15-gtree-agent-collision-coordination.md) examines concurrent edit warnings and attention routing. NekoTrail is a distinct subject: it exposes source for sequential transfer between heterogeneous CLIs in one existing workspace, including deterministic brief selection and permission-mode non-escalation. [diri](./2026-08-05-github-diri-manifest-status-orchestrator.md) studies durable heterogeneous-agent hosting and remote identity; NekoTrail adds a concrete operator-reviewed state projection for replacing one active coding agent with another.

## Evidence limits

Scout performed static inspection only. The repository was three days old and had three stars when its API metadata was captured; the HN submission had two points and no comments in the inspected record. Scout did not install or run the application, execute the project-authored tests, inspect CI results, compare all sixteen CLI adapters, test redaction, exercise truncation on real sessions, observe a handoff, or measure whether a replacement agent completes tasks faster or more accurately. Screenshots, README descriptions, and checked-in tests are project-authored evidence, not independent runtime validation.
