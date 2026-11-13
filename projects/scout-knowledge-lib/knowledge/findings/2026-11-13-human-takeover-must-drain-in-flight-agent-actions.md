---
summary: "OpenBot's browser-control handoff closes new Bot action admission before waiting for already-admitted work to finish, and does not grant human control when that drain times out."
triggers: ["human takeover", "agent browser", "control handoff", "in-flight actions", "action barrier", "OpenBot"]
last_updated: "2026-11-13"
source_basis: "Static inspection of CopilotKit/OpenBot at commit dc1a36de6c6567406c435bcf2b37ebf6f0e8780e: action barrier, browser-control state machine, documentation, and repository-authored tests. Scout did not run the application or tests."
---

# Human takeover must drain in-flight agent actions

<ai_context>
Use this finding when a person and an agent can alternately control the same browser or computer. A takeover is not safe merely because future agent commands are disabled: the runtime must close admission first, wait for already-admitted mutations to settle, and refuse to claim human control if that drain cannot be proved complete.
</ai_context>

**Observed:** 2026-11-13  
**Disposition:** New source-grounded finding  
**Coverage:** Current GitHub repository search for `topic:ai-agents stars:>100`, sorted by recently updated; pinned OpenBot README and approvals documentation; selected computer-control implementation and repository-authored tests. Static inspection only.

## Sources

- **Repo:** [CopilotKit/OpenBot](https://github.com/CopilotKit/OpenBot)
- **Pinned revision:** [`dc1a36de6c6567406c435bcf2b37ebf6f0e8780e`](https://github.com/CopilotKit/OpenBot/commit/dc1a36de6c6567406c435bcf2b37ebf6f0e8780e)
- **Action barrier:** [`agent-computer/src/action-barrier.ts`](https://github.com/CopilotKit/OpenBot/blob/dc1a36de6c6567406c435bcf2b37ebf6f0e8780e/agent-computer/src/action-barrier.ts), [`agent-computer/tests/action-barrier.test.ts`](https://github.com/CopilotKit/OpenBot/blob/dc1a36de6c6567406c435bcf2b37ebf6f0e8780e/agent-computer/tests/action-barrier.test.ts)
- **Control state machine:** [`agent-computer/src/control.ts`](https://github.com/CopilotKit/OpenBot/blob/dc1a36de6c6567406c435bcf2b37ebf6f0e8780e/agent-computer/src/control.ts), [`agent-computer/tests/control.test.ts`](https://github.com/CopilotKit/OpenBot/blob/dc1a36de6c6567406c435bcf2b37ebf6f0e8780e/agent-computer/tests/control.test.ts)
- **Approval boundary:** [`docs/approvals.md`](https://github.com/CopilotKit/OpenBot/blob/dc1a36de6c6567406c435bcf2b37ebf6f0e8780e/docs/approvals.md)

## Source observation

OpenBot lets a Bot request that a person take control of its browser. The inspected control path treats this as a transition with work already in flight, not an instantaneous ownership flag:

1. `requestHelp` closes the action barrier before persisting or awaiting browser work. New Bot actions are refused from that point, although the request alone does not let the person drive.
2. Each admitted Bot action holds a release function. `take` closes admission again and awaits the barrier's active count reaching zero before changing the holder to `human`.
3. A drain timeout rejects the takeover and leaves admission closed. The barrier test explicitly asserts that timeout never grants admission; the error says human control has not been granted.
4. The control test covers a detector requesting help while it still owns an action lease. Human control remains unavailable until that lease releases, while new Bot actions remain refused.
5. Handback is also not a blind ownership flip. Browser-mutating Bot work requires a fresh snapshot after the person releases control, and the Bot remains excluded while a human recording is still stopping. If a restart interrupts a page a person controlled, the state machine requires recovery rather than calling the request completed.

The documentation also draws a boundary around policy coverage: OpenBot can apply its own approvals to tools and computers it mediates, but a brought-in remote Bot's own tools do not automatically pass through that policy. The takeover barrier is therefore evidence about the inspected computer-control path, not proof of universal mediation across every connected agent action.

## Interpretation

A shared interactive surface needs a **quiescent handoff**, not just mutually exclusive labels. Closing admission prevents new work from racing the takeover, while draining accounts for commands that crossed the boundary just before it closed. If the runtime cannot establish quiescence, the safe outcome is an explicit incomplete transition: neither tell the person they own a stable surface nor silently reopen the agent.

A reusable control contract is:

- close agent-action admission before publishing a takeover request;
- track every admitted mutation until its completion callback settles;
- grant human control only after the active set reaches zero;
- keep timeout or storage failure fail-closed and visible as a transition failure;
- require a fresh observation before the agent mutates the human-changed surface;
- preserve interrupted and cancelled handoffs as distinct terminal states rather than success.

This differs from an approval card. Approval decides whether a particular effect may proceed; a takeover barrier decides whether two actors can safely alternate control of one mutable environment.

## Limits

- Scout inspected producer-authored source and tests statically but did not install OpenBot, run its tests, connect a browser, race real actions, force a timeout, or reproduce restart recovery.
- The action barrier is process-local and count-based. This inspection does not establish distributed exclusion across replicas, external computer providers, or actions that bypass the inspected admission path.
- The code comment says the barrier queues or replays no work; this avoids stale replay but does not prove that upstream agents will interpret rejection or retry safely.
- The repository's approval recognition is partly name, label, page, and broker-metadata based and explicitly documents unrecognized actions. The handoff mechanism does not compensate for incomplete semantic classification.
- OpenBot relies on separately licensed CopilotKit Intelligence for parts of its stack; Scout did not inspect that service or establish end-to-end coverage beyond the public repository.
