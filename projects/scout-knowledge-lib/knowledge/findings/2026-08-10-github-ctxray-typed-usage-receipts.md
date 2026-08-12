<ai_context>
summary: "GitHub finding on CtxRay's typed epistemic status for agent usage receipts: runtime token counters, prompt-size proxies, quota snapshots, and API-price calculations are kept distinct as exact, estimated, unknown, billed-estimate, or comparison-only values."
triggers: ["CtxRay", "usage receipts", "token accounting", "cost provenance", "agent observability", "context drift", "epistemic typing"]
last_updated: "2026-08-10"
source_basis: "GitHub repository metadata plus README, cost-semantics documentation, receipt and capability-lock implementations, and tests at commit 96741cdbeb106dd0aeaab57c2d0b0394086532ae; Scout also ran the repository test suite locally."
</ai_context>

# CtxRay: Usage Receipts Need Typed Epistemic Status

Date: 2026-08-10  
Source: GitHub  
Repo: https://github.com/FramY2/ctxray

## Signal

**CtxRay** is an early local-first observability and profile-control tool for
OpenAI Codex. Its reusable contribution is not another token counter. It models
usage evidence with different epistemic and economic types instead of flattening
all numbers into an apparently precise “cost.”

At the inspected revision, the implementation separates runtime-reported token
counts, character-based prompt estimates, account quota snapshots, dated API
price arithmetic, subscription credit equivalents, and missing values. This
prevents a common agent-operations error: allowing a derived comparison to
silently acquire the authority of a measured bill.

## Source-grounded details

- **Repository status:** GitHub API metadata reported an Apache-2.0 repository
  created 2026-08-09 with four stars at observation time. This is a very early
  implementation signal, not evidence of broad adoption or production
  reliability.
- **Provenance is represented in data:** `TokenUsage` carries an
  `exact | estimated | unknown` provenance field. Prompt context has its own
  provenance, and quota snapshots do too; missing prompt or model data stays
  null/unknown rather than becoming zero.
- **Economic meaning is a separate type:** API-key use can produce an estimated
  `billed-estimate`, while a ChatGPT subscription produces no dollar amount by
  default. The optional `--api-equivalent` path is typed and rendered as
  `comparison only; not charged`.
- **Aggregate usage is not reused as context size:** the cost-semantics contract
  says `turn.completed.input_tokens` may aggregate multiple model calls, so the
  implementation does not treat it as a context-window snapshot. A separate
  pre-turn character proxy supplies the explicitly estimated prompt size.
- **Unknown fee classes remain visible:** every receipt warns that token-derived
  values omit unobserved tool-call fees and cache-write classes. Long-context
  multiplier selection also reports uncertainty when no prompt estimate exists.
- **Price claims are time-bounded:** receipts retain the rate catalog's effective
  date and source URLs. The implementation therefore exposes that cost is a
  calculation against a dated catalog, not an eternal property of a model name.
- **Capability drift is independently recorded:** CtxRay builds redacted hashes
  over selected Codex and project capability files, then compares lockfiles for
  added, removed, and changed entries. Secret-like assignments and MCP
  environment sections are replaced before hashing.
- **The lock is a capability-surface fingerprint, not a full execution proof:**
  it records local file paths, redacted content hashes, byte counts, generator,
  and generation time. It does not bind a receipt to a Git patch, served-model
  attestation, tool-call transcript, or independently verified outcome.
- **Executable evidence:** Scout installed the repository's development
  dependencies and ran Vitest at commit
  `96741cdbeb106dd0aeaab57c2d0b0394086532ae`; all 15 test files and 51 tests
  passed, including receipt, unknown-value, opt-in comparison, lockfile, drift,
  and CLI tests. This validates the checked implementation paths in Scout's
  environment, not the README's broader productivity or benchmark claims.

## Why it matters

Agent observability should use an **epistemic type system**:

| Observation | Appropriate status |
| --- | --- |
| Counter emitted by the runtime | Exact for what that event reports |
| Prompt size inferred from characters | Estimated |
| API arithmetic from a dated rate card | Estimated billable value |
| Subscription use mapped to API prices | Comparison only |
| Missing model, context, quota, or rate data | Unknown |
| Outcome quality or served-model identity | Unattested unless separately measured |

The key control is to preserve these types through storage and rendering. A UI
that labels an estimate correctly in a schema but later prints “spent $X” has
lost the guarantee. CtxRay carries the distinction into its render path and
backs it with unit and end-to-end tests.

This extends the receipt pattern beyond integrity. A receipt can be unmodified
and still mislead if it collapses measurements, estimates, comparisons, and
unknowns into one number. Reliable agent operations need both **subject
binding** (what run or artifact the evidence concerns) and **epistemic binding**
(how each value is known).

## Connections to Scout themes

- **Receipt subject binding:** complements
  [Brigade](./2026-08-09-brigade-receipt-subject-binding.md). Brigade asks what
  work a passing check proves; CtxRay asks what kind of knowledge each usage
  number represents. A mature receipt needs both dimensions.
- **Budget governance:** sharpens the earlier “cost receipt” idea in
  [The Budget Constraint Awakening](./2026-07-03-arxiv-hn-github-scan-316.md):
  measuring a budget is only useful if derived comparisons cannot masquerade as
  charges.
- **Context governance:** capability lockfiles can detect changes in selected
  configuration surfaces, but they should not be described as complete runtime
  attestation. Resolved tools, dynamic schemas, remote policy, and served-model
  identity may still drift outside the lock.
- **Caveat:** the repository's published benchmark was not independently
  reproduced in this check. The source-grounded finding concerns the receipt,
  cost-semantics, and drift implementations plus their passing local tests.

## Primary sources

- Repo at inspected revision: https://github.com/FramY2/ctxray/commit/96741cdbeb106dd0aeaab57c2d0b0394086532ae
- Receipt implementation: https://github.com/FramY2/ctxray/blob/96741cdbeb106dd0aeaab57c2d0b0394086532ae/src/receipt.ts
- Cost semantics: https://github.com/FramY2/ctxray/blob/96741cdbeb106dd0aeaab57c2d0b0394086532ae/docs/cost-semantics.md
- Capability lock implementation: https://github.com/FramY2/ctxray/blob/96741cdbeb106dd0aeaab57c2d0b0394086532ae/src/lockfile.ts
- Drift implementation: https://github.com/FramY2/ctxray/blob/96741cdbeb106dd0aeaab57c2d0b0394086532ae/src/drift.ts
- Receipt tests: https://github.com/FramY2/ctxray/blob/96741cdbeb106dd0aeaab57c2d0b0394086532ae/tests/unit/receipt.test.ts
- CLI tests: https://github.com/FramY2/ctxray/blob/96741cdbeb106dd0aeaab57c2d0b0394086532ae/tests/e2e/cli.test.ts
