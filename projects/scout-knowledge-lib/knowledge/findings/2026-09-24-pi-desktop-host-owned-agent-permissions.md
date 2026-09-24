---
title: "PI-Desktop — Permission Order Is Part of the Security Boundary"
source: github
source_id: "vastsa/PI-Desktop@dc4e5f965df8fbcaf22b227dfc77641637278ac6"
date: 2026-09-24
last_updated: 2026-09-24
type: finding
tags: [github, ai-agents, desktop-agents, permissions, sandboxing, plugins, electron]
relevance: high
---

<ai_context>
This note records a static source assessment of PI-Desktop's host-owned permission architecture. Its reusable contribution is the ordering of mode policy, path scope, risk, grants, and UI approval, plus the repository's explicit disclosure that mediated tool permissions do not contain plugin code with direct Node access. Scout did not run the application or reproduce its project-authored tests.
</ai_context>

# PI-Desktop — Permission Order Is Part of the Security Boundary

## Source and coverage

- **Repo:** [vastsa/PI-Desktop](https://github.com/vastsa/PI-Desktop)
- **Inspected revision:** [`dc4e5f965df8fbcaf22b227dfc77641637278ac6`](https://github.com/vastsa/PI-Desktop/commit/dc4e5f965df8fbcaf22b227dfc77641637278ac6)
- **Observation date:** 2026-09-24
- **Discovery:** GitHub's repository Search API returned 411 matches with `incomplete_results: false` for the current topic-led query; PI-Desktop had 5,564 stars in that response. Search metadata is a discovery signal, not proof that its security design works.
- **Read:** repository metadata and complete tree; README; architecture and security specifications; remote-control security target; and the Rust host-core permission implementation, including its checked-in unit tests.
- **Not run:** the desktop application, builds, tests, permission prompts, path escapes, plugins, remote control, or packaged releases.
- **Disposition:** new knowledge — a concrete example of permission evaluation as an ordered host-side decision, with an explicit extension-containment gap.

## Source observations

PI-Desktop separates the React renderer, Electron main process, Node agent runtime, and Rust host core. Its architecture assigns durable session mode, workspace path enforcement, tool execution, permission policy, audit writes, and secret-storage glue to the Rust process. The renderer displays permission cards, but the documented request path says host-core re-resolves the session's project and mode for each tool execution rather than trusting the visible tab or renderer state.

The checked-in Rust evaluator makes policy order observable. In Plan or Goal contract modes, the tool allowlist is checked before low-risk classification, `auto`, prior session grants, or scratch-path treatment. Write, Edit, unknown tools, and plugins without declared plan-safe actions therefore return `Deny` even if a more permissive downstream setting would otherwise allow them. Only after this mode ceiling does the evaluator consider explicit outside-workspace access, risk tier, permission mode, and by-tool session grants. Pending approvals are host state, expire after 120 seconds, and fail to `Deny` on expiry or cancellation.

This is stronger than putting an approval dialog in front of every action. It keeps independent questions separate:

1. **Is this tool legal in the durable session mode?**
2. **Does it cross the session's workspace or scratch roots?**
3. **What risk and permission mode apply?**
4. **Is there a still-valid host-owned approval or session grant?**
5. **Which project identity supplies the execution root?**

A positive answer at a later layer does not widen an earlier ceiling. The repository's own documentation also identifies two important limits. First, Bash remains available in Plan; explicit `auto` can execute it without confirmation and may mutate the workspace or scratch directory. “Plan” is therefore a tool matrix, not a general non-mutation guarantee. Second, a plugin main process currently has direct Node built-in access in its own utility process. The brokered `pi.*` permission gate does not mediate that path, so the security specification says marketplace plugins must be treated as unrestricted user-privileged code until capability sandboxing exists.

## Reusable design signal: audit permission coverage, not permission UI

For a tool-using desktop agent, the useful invariant is not “dangerous actions prompt.” It is:

> Every effect-capable path reaches the same authoritative host decision, and that decision applies non-widening ceilings before convenience grants.

A practical review should therefore enumerate effect paths—built-in tools, shell, plugins, MCP, renderer IPC, local automation, remote control, updates, and background services—and record which host policy mediates each one. A polished permission card proves neither complete path coverage nor containment of code that can bypass the broker. Modes should be described by their actual tool matrix: if Plan admits a mutating shell under `auto`, the UI and policy model should say so directly.

The evaluator also suggests an implementation rule: mode ceilings and resource scope must be resolved from durable host state at execution time. Client-supplied mode, selected UI context, or an old approval should not be able to broaden the action. Approval timeout, cancellation, and process restart need fail-closed settlement rather than leaving a reusable ambiguous grant.

## Limitations

This assessment is based on project-authored documentation and static inspection of one revision. It does not prove that every runtime entry point reaches the Rust evaluator, that path normalization resists all escapes, that packaged Electron settings match the specification, or that the checked-in tests pass. The README labels the 0.15.x line an early preview. The remote-control document is explicitly a target specification, not evidence of a deployed Gateway. Repository stars and detailed documentation are not independent security validation.

## Primary sources

- [README](https://github.com/vastsa/PI-Desktop/blob/dc4e5f965df8fbcaf22b227dfc77641637278ac6/README.md)
- [Layered architecture and request path](https://github.com/vastsa/PI-Desktop/blob/dc4e5f965df8fbcaf22b227dfc77641637278ac6/docs/spec/02-architecture/01-architecture.md)
- [Security baseline and disclosed plugin limitation](https://github.com/vastsa/PI-Desktop/blob/dc4e5f965df8fbcaf22b227dfc77641637278ac6/docs/spec/05-security/01-security.md)
- [Host-core permission evaluator and tests](https://github.com/vastsa/PI-Desktop/blob/dc4e5f965df8fbcaf22b227dfc77641637278ac6/crates/host-core/src/permissions.rs)
- [Remote-control security target](https://github.com/vastsa/PI-Desktop/blob/dc4e5f965df8fbcaf22b227dfc77641637278ac6/docs/spec/05-security/02-remote-control-security.md)
