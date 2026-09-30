<ai_context>
summary: "FailproofAI represents cross-harness enforcement as a versioned integration-by-event capability matrix backed by tests, with absent entries meaning unknown rather than block. Its pinned source also distinguishes pre-tool prevention from post-tool result replacement and makes malformed or incomplete semantic-review authority declarations resolve to hard policy. This is a strong inspectable pattern for honest control-plane claims, but Scout did not run the tests, reproduce the live probes cited in comments, or evaluate policy accuracy."
triggers: ["FailproofAI", "agent enforcement capability", "hook capability matrix", "post-tool blocking", "policy authority", "semantic policy review", "fail closed", "cross-harness hooks"]
last_updated: "2026-09-30"
source_basis: "GitHub repository FailproofAI/failproofai pinned at a7932a0a5065d7c3aa5aeea77f17c16e88310d76; repository Search API query recorded incomplete_results=false."
</ai_context>

# Agent enforcement claims should be versioned by harness, event, and effect

**Date:** 2026-09-30  
**Status:** Source-grounded GitHub finding

## Core signal

GitHub discovery surfaced `FailproofAI/failproofai`, an agent observability and
policy project whose pinned source treats “supports enforcement” as too coarse a
claim. The repository defines an `ENFORCEMENT_CAPABILITY` table keyed by harness
and canonical hook event. Values are only `block` or `observe`; an absent pair
means **unverified**, and the lookup tests require it to remain `undefined`
instead of defaulting to either capability.

That distinction matters because the same nominal event has different semantics
across agent harnesses and versions. The pinned table records, for example:

- `PreToolUse` as blocking on the integrations for which a value is present;
- several `PostToolUse` paths as observe-only because the tool already ran;
- Codex and GitHub Copilot `PostToolUse` as capable of replacing the result the
  model receives, while explicitly noting that this does not prevent the side
  effect; and
- unknown pairs as omitted rather than rendered as a qualified guess.

The source comments attach versions and evidence classes—source inspection,
vendor documentation, or live probe—to individual rows. The companion test
checks canonical event names, restricts the value set, preserves unknown as
absence, and locks in corrected cases such as Hermes `SubagentStop`, whose
return is discarded upstream. This is stronger than a prose compatibility list:
it makes the software surface that reports capability consume a testable table.
It is not independent verification of every row; many row-level evidence notes
are project-authored comments that Scout did not reproduce.

## A second boundary: deterministic policy versus semantic override

The repository separately models whether an optional semantic reviewer may
soften a deterministic policy verdict. Policy authority defaults to `hard`.
`reviewable` is honored only when it names a non-empty set of installed semantic
checks; malformed declarations, unknown checks, missing reviewers, and
self-protection policies resolve to hard. Multiple `reviewedBy` entries are a
conjunction: every named check must actually be asked and clear the call.

The documentation is unusually explicit about a remaining risk. A semantic
check that does not fire may clear a noisy deterministic deny even when the
model simply failed to recognize the hazardous shape. The pinned authority
document gives measured examples where scores just below a 0.7 fire threshold
allowed an unrequested `/etc/shadow` read and an environment-to-`curl` command
that the regex tier denied. The project therefore recommends retaining hard
authority where false negatives cost more than false blocks.

This exposes two separate fail-closed rules:

1. **Capability resolution:** missing evidence for a harness/event pair must not
   become a blocking claim.
2. **Authority resolution:** missing or ambiguous proof that a semantic reviewer
   is entitled and able to clear a policy must not widen permission.

They point in opposite directions because the safe default depends on the
question. Unknown capability should produce no claim; unknown override authority
should preserve the deterministic restriction.

## Reusable implication

A cross-runtime agent control plane should describe enforcement as at least:

`(harness, harness version, event, decision shape, effect timing, evidence type)`

rather than a product-level “guardrails supported” flag. In particular,
**prevented execution**, **post-execution result replacement**, **advisory
feedback**, and **unknown** should be different states. The matrix should be
consumed by both the UI and tests, and claims should expire or return to unknown
when a harness version changes beyond the evidence pinned to a row.

Semantic exception handling needs an independent authority record: which
reviewer may clear which deterministic policy, which installed artifact declares
that reviewer, whether all required checks ran, and what happens on malformed or
missing evidence. A model judgment can reduce false positives, but it should not
silently become the only remaining safety floor.

This complements the earlier [cross-runtime observability finding](./2026-09-12-cross-runtime-agent-observability.md): normalized traces can converge across
runtimes sooner than control, while this repository shows how a control product
can make its uneven intervention coverage explicit and testable.

## Evidence limits

- Scout inspected source and documentation at one pinned revision and did not
  install the package, run its test suite, or reproduce any cited live probe.
- The complete pinned tree was returned with `truncated=false` and contains the
  capability table, policy-authority implementation, harness-specific adapters,
  and extensive unit and end-to-end test files. Presence of tests does not show
  they pass.
- Capability comments cite both open and closed-source harness evidence. Scout
  did not independently inspect the vendor binaries, versions, or offsets named
  there.
- The semantic-review examples and threshold measurements are project-authored;
  this finding does not establish their external validity, false-positive rate,
  or safety effectiveness.
- Repository popularity and recent activity were discovery signals only, not
  evidence of adoption, reliability, or security.
- The repository license is MIT plus the Commons Clause, not unqualified MIT or
  an OSI open-source license.

## Sources

- Repo: https://github.com/FailproofAI/failproofai
- Pinned revision: https://github.com/FailproofAI/failproofai/commit/a7932a0a5065d7c3aa5aeea77f17c16e88310d76
- README at pinned revision: https://github.com/FailproofAI/failproofai/blob/a7932a0a5065d7c3aa5aeea77f17c16e88310d76/README.md
- Enforcement capability table: https://github.com/FailproofAI/failproofai/blob/a7932a0a5065d7c3aa5aeea77f17c16e88310d76/src/hooks/enforcement-capability.ts
- Capability tests: https://github.com/FailproofAI/failproofai/blob/a7932a0a5065d7c3aa5aeea77f17c16e88310d76/__tests__/hooks/enforcement-capability.test.ts
- Harness capability documentation: https://github.com/FailproofAI/failproofai/blob/a7932a0a5065d7c3aa5aeea77f17c16e88310d76/docs/reference/harnesses.mdx
- Policy authority documentation: https://github.com/FailproofAI/failproofai/blob/a7932a0a5065d7c3aa5aeea77f17c16e88310d76/docs/policies/authority.mdx
- Policy authority tests: https://github.com/FailproofAI/failproofai/blob/a7932a0a5065d7c3aa5aeea77f17c16e88310d76/__tests__/hooks/policy-authority.test.ts
- Failure behavior: https://github.com/FailproofAI/failproofai/blob/a7932a0a5065d7c3aa5aeea77f17c16e88310d76/docs/policies/failure-behavior.mdx
- Complete pinned tree: https://api.github.com/repos/FailproofAI/failproofai/git/trees/a7932a0a5065d7c3aa5aeea77f17c16e88310d76?recursive=1
- License: https://github.com/FailproofAI/failproofai/blob/a7932a0a5065d7c3aa5aeea77f17c16e88310d76/LICENSE
