<ai_context>
summary: "Pinned-source assessment of anivar/decern: its authorization core pairs model-scoped SMT invariants and per-invariant negative controls with record-before-response audit semantics, while explicitly separating proof coverage, model-to-server binding, ledger integrity, external anchoring, and deployment completeness."
triggers: ["decern", "authorization proof", "Cedar symbolic compiler", "cvc5", "negative control", "record before response", "audit anchor", "ledger completeness", "agent mission"]
last_updated: "2026-11-14"
source_basis: "Static inspection of anivar/decern at commit 59a7f31cbaba67dca3198b085967831903911f39; Scout did not run the solver, tests, binaries, integrations, or a deployed ledger."
</ai_context>

# Decern separates model proofs from audit completeness

**Date:** 2026-11-14  
**Disposition:** new knowledge  
**Repo:** https://github.com/anivar/decern  
**Pinned observation:** [`59a7f31cbaba67dca3198b085967831903911f39`](https://github.com/anivar/decern/tree/59a7f31cbaba67dca3198b085967831903911f39)

## Question

What does this agent-oriented authorization implementation actually prove and
record, and which guarantees still depend on deployment evidence outside the
formal model and signed ledger?

## Content reviewed

Scout began with GitHub's public repository Search API query
`topic:ai-agents pushed:>=2026-11-14 stars:>10`, sorted by update time with 50
results per page. The response was HTTP 200 with `incomplete_results: false`.
After selecting `anivar/decern`, Scout pinned the repository head and statically
reviewed the README, architecture and CLI documentation, proof harness,
recording path, canonical verification script, and CI workflow at the commit
above.

## Source claims and implementation evidence

Decern presents authorization as a pure function of `(principal, authority
graph, policy, now)` shared by agents, humans, and workloads. Its proof crate
compiles the Cedar model symbolically and asks cvc5 whether each allowed request
implies one of nine invariant guards. The suite deliberately calibrates the
claims: for example, the scope invariant covers only `Read`, `MoveMoney`, and
`AccessPII`; delegation closure and effective-revocation propagation are
trusted Rust inputs rather than properties proved by cvc5.

The unusual implementation signal is the treatment of proof anti-vacuity.
Every invariant has a mutation of the shipped policy intended to remove that
specific protection. Ignored solver tests require the mutation to produce a
real counterexample over at least one request environment, and a matrix test
requires it to refute its own invariant while leaving the other eight proven.
The canonical verification script runs the ignored cvc5 tests as a required
gate; its `--skip-proofs` mode always exits non-zero so a proof-skipping run
cannot be reported as a pass. The repository's CI configuration invokes the
full script and installs cvc5, but Scout did not execute either path.

The runtime evidence path is separate. Server code records a decision or
Mission transition before reporting success. A failed append maps to HTTP 503,
and the response is built from the entry that actually landed. For Mission-
bound allows, the server rechecks termination under the ledger lock immediately
before append and can revise the recorded and returned result to deny. This is
stronger than logging after an effect: the policy decision is withheld when its
audit record cannot be committed.

The repository also states important boundaries rather than collapsing these
mechanisms into one “verified” claim:

1. **Proof scope:** cvc5 proves implications over the modeled Cedar request
   domain; trusted Rust derivations, identity postures, Mission lifecycle,
   persistence, HTTP handling, and ledger mechanics are tested rather than
   formally proved.
2. **Artifact binding:** the prover and kernel can read the same model
   representation, but nothing checks that a model loaded by a running
   `decern-serve` process is the exact model previously proved.
3. **Record integrity:** signatures and hash chains detect mutation within the
   presented log but do not by themselves prove that the writer presented all
   records.
4. **Completeness witness:** a separately retained signed tree-head anchor can
   expose truncation or rewriting at or below its committed size. It cannot
   establish pre-anchor completeness, and the subject projection cannot prove
   that no matching record was omitted from its bounded response.
5. **Deployment coverage:** sharded modes have different verification and
   anchoring limits; multi-host Mission routing is partly a deployment promise;
   and no ledger proves that every consequential effect in a larger system was
   mediated by this decision point.

## Interpretation

Decern is useful less as evidence that formal authorization plus a signed log
“solves” agent governance than as a concrete decomposition of assurance. A
credible control plane can separately require:

- load-bearing policy invariants with negative controls;
- an identity and model binding for the exact serving instance;
- fail-closed record-before-response semantics;
- externally held commitments when omission matters; and
- independent evidence that all relevant effects traverse the mediator.

A proof result, a durable decision record, a valid signature, an anchored log,
and complete effect mediation answer different questions. Treating them as
interchangeable would overstate what this implementation—and most agent receipt
systems—can establish.

## Limitations

This is a producer-source static assessment at one pinned commit. Scout did not
install cvc5, run the proof suite, compile the Rust workspace, execute the smoke
or integration tests, validate a ledger or anchor, inspect a live deployment,
audit every crate or dependency, or independently establish the repository's
security claims. The search response was not exhaustive of all GitHub
repositories; `incomplete_results: false` applies only to the returned search
query and GitHub's bounded result model.

## Evidence inspected

- [`README.md`](https://github.com/anivar/decern/blob/59a7f31cbaba67dca3198b085967831903911f39/README.md)
- [`ARCHITECTURE.md`](https://github.com/anivar/decern/blob/59a7f31cbaba67dca3198b085967831903911f39/ARCHITECTURE.md)
- [`docs/CLI.md`](https://github.com/anivar/decern/blob/59a7f31cbaba67dca3198b085967831903911f39/docs/CLI.md)
- [`crates/decern-proof/src/lib.rs`](https://github.com/anivar/decern/blob/59a7f31cbaba67dca3198b085967831903911f39/crates/decern-proof/src/lib.rs)
- [`crates/decern-server/src/record.rs`](https://github.com/anivar/decern/blob/59a7f31cbaba67dca3198b085967831903911f39/crates/decern-server/src/record.rs)
- [`scripts/verify.sh`](https://github.com/anivar/decern/blob/59a7f31cbaba67dca3198b085967831903911f39/scripts/verify.sh)
- [`.github/workflows/ci.yml`](https://github.com/anivar/decern/blob/59a7f31cbaba67dca3198b085967831903911f39/.github/workflows/ci.yml)
