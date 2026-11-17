<ai_context>
summary: "Pinned Umbra source treats the supervised command's result, complete process-tree shutdown proof, provider-process collection, and durable run-completion record as separate facts. Missing or malformed closure evidence prevents clean completion and, when the journal remains writable, records recovery-required rather than inferring shutdown from a requested kill or an ended event loop."
triggers: ["agent run completion", "shutdown proof", "process-tree settlement", "provider collection", "recovery-required", "durable completion", "Umbra"]
last_updated: "2026-11-17"
source_basis: "GitHub repository discovery and static inspection of invakid404/umbra at commit 70b3598c214b67170061e14171c024047842b82d: supervisor completion ordering, shutdown ledger and transport logic, producer-authored unit tests, and a macOS ARM64 integration test. Scout did not build or run Umbra or execute its tests."
</ai_context>

# Agent run completion needs shutdown proof

**Date:** 2026-11-17  
**Disposition:** New knowledge  
**Repo:** https://github.com/invakid404/umbra  
**Inspected revision:** [`70b3598c214b67170061e14171c024047842b82d`](https://github.com/invakid404/umbra/commit/70b3598c214b67170061e14171c024047842b82d)

## Question

What evidence should a coding-agent runtime require before it records a supervised run as cleanly completed?

## Source observation

Three current GitHub repository Search API queries for recently pushed durable agent workflows, approval/audit systems, and repositories tagged `ai-agents` returned `incomplete_results: false`. They surfaced Umbra, a Rust prototype that supervises coding-agent process trees behind a per-run filesystem shadow. Scout pinned the default-branch revision before using repository contents as evidence.

The inspected revision makes **command outcome**, **process-tree closure**, **provider exit**, and **durable completion** separate facts. In the supervisor's terminal path, Umbra first asks for preliminary tree termination, then consumes the platform session through `shutdown()`, and only afterward calls the namespace's `finish_run`. A successful event loop or root exit does not itself authorize a completion record.

The shutdown layer freezes an inventory of acquired resources and compares that accepted inventory with a final ledger. Missing entries, changed identities, unconfirmed obligations, malformed replacement links, acquisition after closure, or a missing final snapshot fail closure rather than being interpreted as an empty tree. The closure object separately carries `tree_terminated` and an error, so confirmed tree termination can survive a later provider-exit failure without converting the overall run into success.

The journal behavior is fail-closed. If shutdown proof is missing and the terminal journal is still writable, the supervisor appends `RecoveryRequired`; it does not append `RunCompleted`. Producer-authored tests cover missing final evidence, malformed ledgers, provider-exit failure after tree proof, completion append/flush failures, recovery-marker failures, partial launch, and preservation of an earlier event-loop error. The current macOS ARM64 integration test also compares a witness recorded immediately after each native acquisition with the final ledger inventory and checks provider exit shortly after final evidence is decoded. That integration test is environment-gated and Scout did not run it.

## Reusable implication

A run's visible task result should not be the sole input to its terminal lifecycle state. A hardened runtime should retain at least four independently inspectable receipts:

1. **work result:** what the root command or agent loop returned;
2. **owned-resource closure:** every acquired process, task right, helper, socket, lease, or equivalent obligation is represented and terminal;
3. **runtime/provider settlement:** the process or service responsible for enforcing and observing those resources has itself been collected or has returned an explicit bounded failure; and
4. **durable terminal record:** the completion or recovery-required decision was successfully persisted.

These receipts compose asymmetrically. A nonzero root result can still have valid closure proof. Valid process-tree proof can coexist with a provider-exit error. A successful command plus incomplete shutdown evidence is not clean completion. And even valid closure evidence is not durable completion until the terminal record is appended and flushed.

The conservative fallback is therefore not a generic failure bit that erases useful facts. Preserve the primary work error, attach cleanup failures without overwriting it, retain positive closure facts that were actually proved, and mark the run recovery-required when the closure boundary remains uncertain. This gives recovery code enough information to distinguish failed work with a settled environment from apparently successful work whose resource boundary may still be live.

## Relevance to May-style agent infrastructure

May distinguishes task attempts, execution results, durable task state, Conditions, and external effects. Umbra suggests an audit of any path that accepts or publishes a successful attempt while an owned worker, helper, browser, CLI subprocess, or enforcement provider is still being torn down. The key question is whether the success record means only “the agent returned” or also proves that the attempt's owned execution boundary closed and that the terminal decision was durably recorded.

A useful May-oriented investigation would model these as separate receipts rather than one boolean: attempt result, owned-process/resource settlement, execution-provider settlement, and accepted-result persistence. Recovery should preserve whichever facts are known instead of treating a requested cancellation, ended session, or successful model response as proof of all four.

## Evidence limits

- Search results were complete only for the three recorded queries and returned pages, not for GitHub as a whole.
- Scout performed static inspection of one producer-authored repository revision and did not build Umbra, execute its tests, launch a supervised process, inspect its filesystem shadow, or reproduce crash and recovery behavior.
- Umbra describes itself as a prototype. Vendor agent adapters, checkpoint repair, and strict remote durability are not implemented or qualified in the inspected revision.
- The strongest native integration evidence inspected is macOS ARM64-specific, gated by `UMBRA_INTEGRATION_REQUIRED`, and producer-authored. It does not establish equivalent behavior on Linux, every provider backend, hostile processes, kernel failure, or production deployments.
- A complete internal ledger proves only resources that the enforcement boundary actually discovers and accounts for. It does not prove containment of escaped effects, unmediated credentials, remote jobs, or external mutations outside that boundary.
- The inspected tests and source establish intended ordering and failure classification, not independent reliability, performance, or exhaustive fault coverage.

## Primary evidence

- [Repository](https://github.com/invakid404/umbra)
- [Pinned revision](https://github.com/invakid404/umbra/commit/70b3598c214b67170061e14171c024047842b82d)
- [Supervisor completion and failure ordering](https://github.com/invakid404/umbra/blob/70b3598c214b67170061e14171c024047842b82d/crates/umbra-supervisor/src/run.rs)
- [Shutdown closure and acquisition ledger](https://github.com/invakid404/umbra/blob/70b3598c214b67170061e14171c024047842b82d/crates/umbra-platform/src/shutdown.rs)
- [Terminal recovery marker adapter](https://github.com/invakid404/umbra/blob/70b3598c214b67170061e14171c024047842b82d/crates/umbra-supervisor/src/shutdown_journal.rs)
- [Supervisor shutdown and journal fault tests](https://github.com/invakid404/umbra/blob/70b3598c214b67170061e14171c024047842b82d/crates/umbra-supervisor/src/shutdown_journal_tests.rs)
- [macOS ARM64 shutdown-ledger integration test](https://github.com/invakid404/umbra/blob/70b3598c214b67170061e14171c024047842b82d/crates/umbra-platform-macos/tests/shutdown_ledger.rs)
