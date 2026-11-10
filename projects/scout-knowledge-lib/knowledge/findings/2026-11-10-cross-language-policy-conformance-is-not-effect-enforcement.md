<ai_context>
summary: "Multi-Agent Swarm Guardrails demonstrates a useful portability pattern: one versioned policy-decision corpus is exercised by independent Python, Go, and Rust implementations. That establishes bounded semantic agreement, not authenticated identity, complete mediation, isolation, replay safety, or production enforcement."
triggers: ["Multi-Agent Swarm Guardrails", "MASG", "cross-language conformance", "policy decision vectors", "portable agent guardrails"]
last_updated: "2026-11-10"
source_basis: "Static inspection of HuffmanMainNode/Multi-Agent-Swarm-Guardrails at commit 2b3aa05450b09d7ba00c79671a0c261a4ec773bd, including README, recursive tree, CI workflow, universal protocol, decision vectors, Go and Rust conformance reports, limitations, and the narrow Linux broker. GitHub reported the two cited conformance workflow runs completed successfully; Scout did not run the implementations or test a deployment."
</ai_context>

# Cross-language policy conformance is not effect enforcement

**Date:** 2026-11-10  
**Disposition:** new knowledge  
**Question:** What can a shared cross-language agent-safety test corpus establish, and what enforcement claims remain outside it?  
**Repo:** https://github.com/HuffmanMainNode/Multi-Agent-Swarm-Guardrails  
**Reviewed version:** commit [`2b3aa05450b09d7ba00c79671a0c261a4ec773bd`](https://github.com/HuffmanMainNode/Multi-Agent-Swarm-Guardrails/commit/2b3aa05450b09d7ba00c79671a0c261a4ec773bd)  
**Coverage:** live repository-search metadata; repository metadata and recursive tree; complete README; CI workflow; universal-protocol document; eight shared decision vectors; Go and Rust conformance reports and their GitHub Actions run status; limitations document; and selected broker source. Static inspection only.

## Source observation

Multi-Agent Swarm Guardrails (MASG) separates a portable decision protocol from runtime-specific enforcement. Its versioned corpus contains eight cases covering allow, default deny, explicit-deny precedence, review-required, policy-version mismatch, expired requests, not-yet-valid requests, and invalid validity windows. Python, Go, and Rust evaluators consume that same corpus. The pinned CI runs Python tests across 3.11–3.13, Go tests with the race detector, and Rust formatting, Clippy, and tests.

The repository's Go and Rust conformance reports mark all eight cases `PASS`. GitHub's public Actions API reports the referenced runs completed successfully at their respective source revisions. This is stronger evidence than three implementations each carrying unrelated tests: a language-neutral corpus makes semantic drift observable and gives an adopter a concrete compatibility target.

The reports also bound that result unusually clearly. They state that the caller supplies the principal and clock, the evaluators do not authenticate identity or mediate a side effect, and `PASS` implies no broker, replay, evidence-ledger, sandbox, recovery, penetration, load, or independent-assessment result. The repository's mandatory safety-contract statuses remain `NOT_TESTED` despite the vector passes.

MASG includes a separate Linux broker, but its authority is deliberately narrow. It obtains a local peer UID with `SO_PEERCRED` or validates a SPIFFE JWT-SVID, evaluates policy, consumes a request ID in local SQLite, and can perform only one fixed operation: append a bounded event to its own evidence ledger. The client cannot select a command, executable, path, arbitrary target, or general tool action. This is an implemented example of moving identity and execution outside the model process, not proof that an adopting agent's other effects are mediated.

## Reusable interpretation

A portable safety protocol needs at least two distinct evidence layers:

1. **Decision conformance:** independent implementations produce the expected result for the same versioned request, policy, and time vectors.
2. **Effect enforcement:** a deployment proves that authenticated requests for consequential effects must traverse a mediator that can withhold the effect and record what happened.

The first layer is valuable. Shared vectors can expose ambiguous specifications, precedence differences, parser divergence, time-window mistakes, and language-port drift before those differences reach production. A conformance report should therefore pin the protocol version, implementation revision, exact vector IDs, execution environment, and limitation scope.

But decision agreement cannot establish the second layer. Three evaluators can all correctly return `DENY` while an application still executes through an unmediated route. They can all return `ALLOW` for a principal string that no trusted component authenticated. They can agree about expiry while relying on a compromised clock, or consume request IDs while a replay database can be rolled back. The enforcement claim requires separate evidence for identity provenance, complete route coverage, effect ownership, state continuity, isolation, and recovery.

This produces a practical adoption rule: **use cross-language vectors as a semantic compatibility gate, never as a deployment security verdict**. Runtime profiles should name which effects are actually protected, which component owns them, how identity reaches that component, where replay and policy state live, and how bypass or rollback is tested. Conformance and enforcement can then evolve independently without allowing a green protocol suite to overstate deployment assurance.

This complements [Agent Security: Enforcement Evidence and Runtime Coverage](../agent-security-enforcement-evidence.md), which distinguishes correct policy verdicts from effect-owning mediation and complete path coverage. MASG adds a concrete portability case: shared vectors can make policy semantics transferable across runtimes while leaving every consequential enforcement property explicitly unproven.

## Limits

- Scout inspected repository-authored source, reports, and CI metadata; it did not clone the repository, run Python/Go/Rust tests, inspect job logs step by step, mutate vectors, fuzz parsers, or reproduce a conformance report.
- The two inspected successful Actions runs belong to intermediate revisions named by the reports, not the later reviewed repository head. The pinned head's workflow definition includes all three language jobs, but this review did not establish a successful full workflow run for that exact head.
- Eight vectors are a narrow semantic baseline, not exhaustive protocol coverage. They do not measure extension handling, every malformed-document case, interoperability with independently authored third-party implementations, or backwards compatibility across future protocol versions.
- The Go and Rust implementations and reports are authored in the same repository as the protocol. Different languages reduce accidental implementation coupling but do not constitute an independent external assessment.
- The broker protects one ledger-append operation only. Its local UID identity groups processes sharing a UID; SPIFFE JWT-SVID mode uses a bearer credential not bound to the Unix peer; local replay and ledger files remain vulnerable to rollback or replacement under a sufficiently privileged attacker.
- A hash-chained local ledger establishes detectable mutation only relative to a retained trustworthy checkpoint. It does not prevent whole-ledger deletion, replacement, omitted effects, or execution outside the broker.
- The repository was discovered by a bounded GitHub Search API query whose response reported `incomplete_results: false`; that says only that this API response was complete for the query, not that GitHub or the agent-safety ecosystem was exhaustively surveyed.

## Sources

- **Repo:** https://github.com/HuffmanMainNode/Multi-Agent-Swarm-Guardrails
- **Inspected revision:** https://github.com/HuffmanMainNode/Multi-Agent-Swarm-Guardrails/commit/2b3aa05450b09d7ba00c79671a0c261a4ec773bd
- **Universal protocol:** https://github.com/HuffmanMainNode/Multi-Agent-Swarm-Guardrails/blob/2b3aa05450b09d7ba00c79671a0c261a4ec773bd/docs/UNIVERSAL_PROTOCOL.md
- **Shared vectors:** https://github.com/HuffmanMainNode/Multi-Agent-Swarm-Guardrails/blob/2b3aa05450b09d7ba00c79671a0c261a4ec773bd/vectors/v1.0.0/decision-vectors.json
- **CI workflow:** https://github.com/HuffmanMainNode/Multi-Agent-Swarm-Guardrails/blob/2b3aa05450b09d7ba00c79671a0c261a4ec773bd/.github/workflows/ci.yml
- **Go conformance report:** https://github.com/HuffmanMainNode/Multi-Agent-Swarm-Guardrails/blob/2b3aa05450b09d7ba00c79671a0c261a4ec773bd/implementations/go/conformance-report.json
- **Rust conformance report:** https://github.com/HuffmanMainNode/Multi-Agent-Swarm-Guardrails/blob/2b3aa05450b09d7ba00c79671a0c261a4ec773bd/implementations/rust/conformance-report.json
- **Known limitations:** https://github.com/HuffmanMainNode/Multi-Agent-Swarm-Guardrails/blob/2b3aa05450b09d7ba00c79671a0c261a4ec773bd/docs/LIMITATIONS.md
- **Narrow broker source:** https://github.com/HuffmanMainNode/Multi-Agent-Swarm-Guardrails/blob/2b3aa05450b09d7ba00c79671a0c261a4ec773bd/src/masg/broker.py
- **Successful Go report run:** https://github.com/HuffmanMainNode/Multi-Agent-Swarm-Guardrails/actions/runs/42750849476
- **Successful Rust report run:** https://github.com/HuffmanMainNode/Multi-Agent-Swarm-Guardrails/actions/runs/42752336251
