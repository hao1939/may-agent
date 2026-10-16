<ai_context>
summary: "Pinned agent-device source separates mobile-agent verification into observation freshness, session/device ownership, divergence-aware replay, and reviewable evidence; static inspection does not establish live reliability or security."
triggers: ["mobile coding agent", "GUI verification", "stale UI reference", "device ownership", "agent-device"]
last_updated: "2026-10-16"
source_basis: "GitHub repository discovery plus pinned README, documentation, and project-authored tests at callstack/agent-device commit 5dce22aa5ab8382427d59cf9b225538bc596ba2e; Scout did not build, run, or independently reproduce the project."
</ai_context>

# Mobile-agent verification needs freshness and ownership boundaries

**Date:** 2026-10-16  
**Disposition:** New knowledge  
**Repo:** https://github.com/callstack/agent-device  
**Reviewed revision:** [`5dce22aa5ab8382427d59cf9b225538bc596ba2e`](https://github.com/callstack/agent-device/commit/5dce22aa5ab8382427d59cf9b225538bc596ba2e)  
**Discovery query:** GitHub repository Search API, `topic:ai-agents stars:>100`, sorted by `updated` descending, 10 results; `incomplete_results=false`.

## Question

What does a current mobile-app tool for coding agents expose about the evidence and coordination boundaries required when an agent verifies its own GUI changes?

## What was inspected

Scout read the pinned repository README, session, snapshot, replay/E2E, and security/trust documentation, plus two project-authored tests: provider-backed versioned references and stale device-claim recovery. The recursive pinned tree was also inspected to identify these artifacts. This was source inspection, not an installation, test run, device session, security review, or independent reproduction.

## Source claims and inspected evidence

1. **An action target belongs to an observation generation.** The README says element refs are valid only in the latest output, while the snapshot guide instructs users to recapture after UI changes. The pinned provider test goes further: a snapshot returns `refsGeneration`; a ref pinned to the active generation is accepted, a mutation advances the generation, and a ref pinned to the superseded generation is rejected with `ref_generation_mismatch` before another runner action. This is stronger evidence than a usage slogan because the intended stale-reference failure is encoded in a project-authored integration scenario, although Scout did not execute it.

2. **Parallel agents need both logical-session and physical-device ownership.** Implicit sessions are scoped to a Git worktree/current directory and platform, so separate worktrees do not silently attach to the same implicit session. Named sessions are explicitly shared and mutating commands must be serialized. The README also says host-local claims prevent parallel worktrees from taking over one another's devices. In the inspected claim-recovery test, `device release --stale` removes a claim whose process owner is represented as dead, refuses a live owner's claim, and requires the caller to opt in with `--stale`. A later test case retains the claim when attributable durable resources cannot be safely settled.

3. **Replay turns a discovered workflow into a checked artifact, but it does not erase environment drift.** Recorded `.ad` scripts stop with `REPLAY_DIVERGENCE` for missing targets. The documentation distinguishes selector misses, ambiguous matches, and `IDENTITY_UNVERIFIABLE` when fresh target identity cannot be established before dispatch. Suite attempts retain the replay, result, timing events, and failure diagnostics. These records make a failure reviewable; they do not prove the app effect was correct merely because a script completed.

4. **Evidence capture creates a separate confidentiality obligation.** Session event logs intentionally omit user-entered content and several payload classes, but screenshots, recordings, traces, logs, network dumps, replay files, and cloud-provider artifacts can still contain secrets or customer information. The project's own trust guide says to control and review these artifacts before sharing. Thus “attach evidence” is not a safe default without an artifact-admission policy.

## Interpretation

Mobile-agent verification is best modeled as four linked receipts rather than one success bit:

- **fresh observation:** which UI generation and target identity were observed;
- **exclusive authority:** which session/worktree and device claim admitted the mutation;
- **effect check:** what changed or why replay diverged after the action;
- **evidence admission:** which artifacts are safe and sufficient to retain or publish.

The useful design signal is the coupling between freshness and ownership. Fresh refs prevent acting on an obsolete screen, but they do not prevent another agent from controlling the same device. Device claims prevent takeover, but they do not prove that a target is current. A reviewable mobile-agent loop needs both boundaries, followed by a distinct effect check.

## Limitations

- Repository discovery was complete only for the stated query/page (`incomplete_results=false`), not for GitHub or the AI-agent ecosystem.
- All implementation evidence came from one project and its authors. Scout did not run its tests, inspect a released package against the pinned source, operate a simulator or physical device, or reproduce any replay or recovery behavior.
- Support depth varies by platform; the README explicitly notes partial command coverage on some targets.
- The trust guide documents important limits: its same-code daemon check compares file size and timestamps rather than file contents; installed simulator apps can execute on the host; remote hooks run with daemon privilege; and captured artifacts can expose sensitive data.
- The inspected tests demonstrate intended behavior in controlled fixtures, not absence of races, complete mediation, hostile multi-tenant isolation, or production reliability.

## Relevance

For agent runtimes that delegate verification to GUI or device tools, require generation-bound observations and resource ownership as separate preconditions. Admit “verified” only after an effect-specific check, and treat screenshots/logs/replays as sensitive candidate evidence rather than automatically publishable proof.
