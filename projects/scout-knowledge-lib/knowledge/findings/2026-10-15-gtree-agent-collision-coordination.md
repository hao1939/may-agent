<ai_context>
summary: "A new macOS coding-agent product splits local concurrency into same-worktree pre-edit messaging and cross-worktree overlap warnings, then aggregates human attention in one inbox. This is a useful coordination topology, but the public material provides no protocol, source, tests, traces, or atomic ownership guarantee, so collision awareness must not be reported as conflict prevention."
triggers: ["gtree", "coding agent collision", "parallel coding agents", "worktree overlap", "agent attention inbox", "turn restore"]
last_updated: "2026-10-15"
source_basis: "HN item 50102435 and gtree's complete public llms-full.txt and installer inspected 2026-10-15. The product was not installed; its proprietary binary, coordination protocol, restore behavior, telemetry, tests, and live multi-agent operation were not inspected or reproduced."
</ai_context>

# Collision awareness is not agent ownership

**Date:** 2026-10-15  
**HN:** [item 50102435](https://news.ycombinator.com/item?id=50102435)  
**Source:** [gtree product documentation](https://gtree.dobbylab.com/llms-full.txt)  
**Observed source version:** release notes through gtree 0.3.15; retrieved document SHA-256 `07f528dc00e6492becfb7530d89a184661ce2b9bcfdbd231b73f7bbe7e37e060`  
**Coverage:** complete public `llms-full.txt`, HN item, and installer script. Scout did not install or execute the macOS application.

## Question

What useful coordination boundary appears in gtree's claim that several coding agents can work concurrently while the operator is interrupted only when needed?

## Source claims

The public document describes three different concurrency cases rather than one generic “multi-agent” feature:

1. **Same worktree:** before one agent edits a file another agent has changed, it is told about the prior edit and can leave the other agent a message; the document says the agents “agree who goes first.”
2. **Different worktrees for the same repository:** simultaneous uncommitted edits to the same file are flagged in the interface for comparison. The document does not claim that either edit is blocked.
3. **Different projects:** one Claude Code session can ask a background copy of another session about that project's API while the originally addressed session continues working.

The product also claims to classify sessions as working, waiting for a permission or answer, or idle, and to collect human-needed states across projects in one inbox. Per-turn change records can reportedly restore only files touched by a selected turn while leaving other files, branches, and the Git index unchanged. The documentation says these records remain restorable for 30 days.

The installer is a shell script that resolves a release manifest, downloads a proprietary Apple-Silicon macOS archive, and verifies the archive against a manifest-provided SHA-256. This download-integrity check does not reveal or verify the application's coordination and restore semantics.

## Scout interpretation

The useful pattern is a **collision ladder** whose response depends on how much state workers share:

- shared worktree: notify before a potentially overlapping edit and establish an ordering conversation;
- separate worktrees: allow isolation, but detect overlap before integration;
- separate projects: exchange a bounded question instead of transferring the other task or transcript;
- human attention: aggregate only states that require permission, an answer, or review.

That topology can reduce terminal polling and make overlaps visible earlier. It does **not**, on the available evidence, establish exclusive ownership. “The agents talk first” leaves unanswered whether check-and-edit is atomic, whether a lease expires, how stale observations are handled, what happens when an agent ignores the message, and how two edits discovered simultaneously are resolved. A robust control plane should therefore report at least four distinct states: overlap observed, ownership requested, ownership granted for a bounded resource/version, and integration verified. A UI warning or inter-agent message proves only the first one or two.

The same distinction applies to restoration. A file-scoped revert can be safer than resetting an entire worktree, but “restore the files this turn touched” is not enough to show that later edits to those files, generated artifacts, external side effects, schema changes, or committed history remain valid. Restore evidence should name the captured baseline, changed paths, conflicting later writes, omitted effects, and post-restore verification.

For an operator-facing inbox, the reusable measurement is not the number of parallel sessions. Measure time from a genuinely human-blocked state to notification, false-positive and missed-notification rates, age of unresolved asks, and whether an answer is delivered only to the still-current task generation. Attention routing should remain separate from file ownership and task authority.

## Evidence limits

This is a same-day Show HN submission with one point and no comments in the inspected HN record. All behavioral statements come from the maker's mutable product documentation. No public implementation repository, protocol specification, test suite, event trace, failure injection, or evaluation was identified in the inspected source. The software is proprietary, macOS/Apple-Silicon-only, and was not downloaded or run. The stated performance, privacy, collision handling, notification, cross-project questioning, and 30-day restore behavior are therefore product claims, not independently verified capabilities. The source-document hash pins the text Scout reviewed, not the application binary or an implementation revision.

## Disposition

**New knowledge.** No existing Scout note declares the HN item, product URL, or gtree name. Existing coordination notes discuss shared workspaces and task control planes, but not this product's explicit split between same-worktree messaging, cross-worktree overlap detection, cross-project questions, and an attention inbox—or the evidence boundary between awareness and enforceable ownership.
