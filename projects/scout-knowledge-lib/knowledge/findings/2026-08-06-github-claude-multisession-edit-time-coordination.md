---
title: "claude-multisession — Edit-Time Coordination Turns Git Worktrees into a Governed Concurrency Layer"
source: github
date: 2026-08-06
last_updated: 2026-08-06
type: finding
tags: [github, coding-agents, multi-session, coordination, worktrees, concurrency, guardrails, verification]
relevance: high
---

# claude-multisession

## Overview

- **Repo:** [wshallwshall/claude-multisession](https://github.com/wshallwshall/claude-multisession) (2★, created 2026-08-04, pushed 2026-08-06)
- **Author:** wshallwshall
- **Language:** PowerShell
- **License:** MIT
- **What:** Windows-first coordination tooling for running several Claude Code sessions against one repository with one worktree per session, plus guardrail hooks, atomic claims/locks, a session-liveness fence, and a `ccx doctor` verifier that actively tests whether each control can still refuse the failure it exists to stop.

## Core Signal

**Worktree-per-agent isolation is no longer being treated as sufficient. The new control surface is edit-time coordination over shared repo state.**

The repo's important claim is that git worktrees prevent direct byte overwrites, but they do **not** prevent the higher-level collisions that actually waste operator time:

1. two sessions editing the same file in parallel and discovering it only at merge,
2. two sessions doing the same logical work in different files,
3. two sessions racing for the same sequence/allocator slot,
4. two sessions manipulating shared git metadata or the primary checkout,
5. a "guardrail" looking installed while silently checking nothing.

That is a useful shift in the coding-agent stack. The interesting artifact is not "another multi-agent launcher" but a set of **repo-local concurrency controls** that try to make parallel agent work fail early, visibly, and testably.

## Concrete Design Details

1. **The repo frames collisions as semantic, not just textual.**
   The README's problem table distinguishes same-working-tree, same-file, same-work-different-files, same-reserved-number, shared git config, shared registries, and shared agent memory as separate failure classes. This is stronger than the common "just give every agent a worktree" pattern because several of those races merge cleanly and are therefore invisible to git until after duplicate work already happened.

2. **The collision gate blocks only live, uncommitted overlap.**
   `scripts/hooks/collision_gate.ps1` explicitly refuses an edit only when another **live** session has **uncommitted** changes in the same file. If the peer branch already committed the change and its tree is clean, the hook only warns. That matters because the repo is optimizing for low false positives: it is trying to stop rework without turning every historical branch touch into a permanent denial.

3. **Claims are modeled as atomic filesystem reservations, not a shared mutable list.**
   `scripts/coord/claim.ps1` uses exclusive creation of `<state-root>/claims/<key>.json` and argues this is necessary because read-modify-write registries silently lose updates under concurrency. It also treats free-text work claims and numbered work-item claims as different surfaces: the former are advisory, the latter pair with a commit-msg gate for enforcement.

4. **Liveness is treated as a fallible vendor contract, not a ground truth.**
   `scripts/coord/session-registry.ps1` is unusually explicit that the entire fence depends on client-written `sessions/<pid>.json` files whose shape, location, and lifecycle are not owned by this project. The code only treats the positive answer (`LIVE`) as trustworthy, distinguishes `UNVERIFIED` from `STALE`/`DEAD`, and checks process start time against session registration time to avoid PID-reuse errors.

5. **Different hazards get different failure postures.**
   `scripts/hooks/collision_gate.ps1` fails open because duplicate-work prevention should not wedge a session, while `scripts/hooks/worktree_gate.ps1` is stricter about writes or dispatches from the shared primary checkout. This is a subtle but important design choice: the repo does not pretend every guardrail should fail closed.

6. **Verification is operationalized as adversarial probing, not config inspection.**
   `bin/ccx-doctor.ps1` says a control is not trusted because it appears installed; it hashes installed copies, compares wired matchers to the rules the installed script actually implements, then fires each control on purpose and requires a deny. That makes the repo a good signal for a broader trend: agent infrastructure is becoming self-auditing at the runtime-control level.

7. **The primary checkout is treated as a shared hazard zone.**
   The README reports two measured behavioral facts from the author's own repo: a banner asking users to prefer worktrees did not work, and path-targeted enforcement beat cwd-based enforcement because some writes launched from the primary actually targeted sibling worktrees correctly. The implication is practical: coordination logic has to inspect the **write target**, not merely where the session is sitting.

## Why This Matters

1. **Parallel coding agents are graduating from isolation to contention management.**
   Worktrees solve only the easiest class of collision. This repo focuses on the cases that still survive isolation: duplicate effort, stale liveness assumptions, allocator races, and silently inert safety hooks.

2. **Edit-time refusal is becoming as important as merge-time conflict detection.**
   Git catches byte conflicts late. The repo's contribution is to move some coordination decisions to the moment before an edit or dispatch happens, while the cost of backing out is still low.

3. **Agent guardrails are being judged by falsifiability.**
   The strongest pattern here is `ccx doctor`: a guard is not considered present unless it can be actively attacked and shown to refuse. That is an operationally mature stance and aligns with Scout's broader verification-first thread.

4. **Shared-workspace competence now has a concrete repo-native implementation story.**
   Recent benchmarks such as SWE-Touch ask whether agents can adapt when the workspace changes underneath them. `claude-multisession` is not an eval, but it is a practitioner-side answer to the same problem: make concurrency visible and coordinated before stale assumptions compound.

## Connections to Library Themes

- **Shared-workspace awareness:** complements SWE-Touch by showing how practitioners are trying to prevent concurrent-state collisions in normal repo workflows.
- **Harness-first reliability:** the interesting value is in hooks, liveness fences, atomic reservations, and verification receipts rather than in model prompting.
- **Verification over narrative:** `ccx doctor` assumes controls can look installed while doing nothing, so it proves enforcement through attacks instead of reading settings files.
- **Governed multi-agent work:** parallel sessions are treated as a coordination problem over shared state, not just as a fan-out problem over prompts.

## Sources

- **Repo:** https://github.com/wshallwshall/claude-multisession
- **README:** https://raw.githubusercontent.com/wshallwshall/claude-multisession/main/README.md
- **Doctor verifier:** https://raw.githubusercontent.com/wshallwshall/claude-multisession/main/bin/ccx-doctor.ps1
- **Collision gate:** https://raw.githubusercontent.com/wshallwshall/claude-multisession/main/scripts/hooks/collision_gate.ps1
- **Work claim registry:** https://raw.githubusercontent.com/wshallwshall/claude-multisession/main/scripts/coord/claim.ps1
- **Session liveness fence:** https://raw.githubusercontent.com/wshallwshall/claude-multisession/main/scripts/coord/session-registry.ps1
- **Worktree gate:** https://raw.githubusercontent.com/wshallwshall/claude-multisession/main/scripts/hooks/worktree_gate.ps1
- **GitHub API metadata:** https://api.github.com/repos/wshallwshall/claude-multisession
