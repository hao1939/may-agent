<ai_context>
summary: "Gryph's cross-harness policy layer makes two security boundaries explicit: a block only prevents an action when it comes from a pre-execution hook, and signed receipts only attest to what the same-user mediation path observed. Policy decisions therefore need execution phase, coverage, and trust-root metadata; a block-shaped result or valid signature alone is not proof of prevention or complete observation."
triggers: ["agent hooks", "coding-agent policy", "pre-execution enforcement", "post-execution detection", "signed receipts", "same-user bypass", "Gryph", "AARM"]
last_updated: "2026-08-27"
source_basis: "GitHub repository metadata plus Gryph documentation, implementation, and tests at revision 44e63b09957c4ab841a5aafe19604c769f3f848f."
</ai_context>

# An Agent-Policy Decision Needs an Execution Phase

Date: 2026-08-27  
Source: GitHub  
Repo: https://github.com/safedep/gryph

## Signal

Gryph exposes a useful distinction for policy layers that support several coding
agents: **a `block` decision is not necessarily prevention**. The same policy
engine receives both pre-execution and post-execution hooks. Gryph stamps the
normalized action `pre`, `post`, or `unknown`; only the first can stop the
operation. A post-phase block can inform the model and leave a receipt, but the
side effect has already happened.

The repository also makes a second boundary unusually explicit. Hash-chained,
Ed25519-signed receipts attest to what Gryph's mediator saw. They do not prove
that every host action passed through mediation. Gryph and the agent run as the
same operating-system user, hook configuration is user-writable, and a
same-user process can bypass file tools, remove hooks, replace the binary, or
read the signing key. Cryptographic evidence strengthens an observed path; it
does not expand that path's authority or coverage.

## Source-grounded details

- GitHub search for `topic:ai-agents pushed:>=2026-08-25 stars:>=20`, sorted by
  recent update, returned 1,462 repositories. Gryph had 158 stars at retrieval
  time. These are discovery and attention signals, not evidence of security
  maturity.
- The inspected revision is
  `44e63b09957c4ab841a5aafe19604c769f3f848f`. Its enforcement-coverage document
  lists each supported harness's pre-, post-, and lifecycle hooks rather than
  presenting hook support as one boolean.
- The phase mapper uses explicit overrides plus hook-name prefix/suffix rules.
  Unrecognized events become `unknown`, not `pre`, so new hook names are not
  accidentally advertised as preventive coverage.
- Claude Code, Gemini, OpenCode, Pi Agent, and Codex expose a broad pre-tool
  event; Cursor and Windsurf expose additional operation-specific pre-hooks.
  Post-tool and after-operation events remain detection paths even if the
  policy response is shaped like a block.
- The policy threat model says a determined same-user actor can edit agent hook
  configuration or invoke filesystem operations outside the mediated tool
  path. Hardened deployment therefore needs a lower-level control to protect
  hooks, binary, and configuration rather than another YAML rule.
- Receipts are chained per session, cover the active policy hash, and may carry
  Ed25519 signatures. The receipt documentation nevertheless warns that
  same-UID code can read the local private key and that a compromised agent can
  shape events before mediation. Off-host verification should pin public keys
  through a separate channel instead of trusting the producer's writable trust
  store.
- Scout inspected source, documentation, and test files but could not run the
  targeted Go tests because the environment has no `go` executable. The
  repository's tests are implementation evidence, not an independently
  reproduced validation result.

## Why it matters

A portable policy layer has at least three independent properties:

1. **Decision** — what did the policy engine return?
2. **Temporal authority** — was the decision made before the effect, after it,
   or at an unknown phase?
3. **Mediation coverage** — could the actor perform the effect outside the
   observed path?

A fourth property, **evidence integrity**, says whether the resulting record was
altered. Signed receipts can improve the fourth without improving the second or
third. Collapsing these properties into labels such as “blocked,” “protected,”
or “verified” overstates what the control established.

## Reusable guidance

- Put execution phase on every normalized action and receipt. Reserve
  “prevented” for a deny returned through a confirmed pre-execution boundary.
- Report coverage by harness, hook, and operation class; do not turn “has hooks”
  into a universal enforcement claim.
- Default new or unrecognized hook events to unknown authority until their
  timing contract is verified.
- Treat post-execution denies as detection or correction signals, not rollback.
  If reversal matters, model and verify compensation separately.
- Separate policy integrity, hook integrity, binary integrity, and receipt-key
  custody. Same-user self-protection is not an OS security boundary.
- For external audit, pin verifier keys out of band and retain policy hashes,
  phase, hook identity, and coverage version with each receipt stream.

## Primary sources

- Repository at inspected revision: https://github.com/safedep/gryph/commit/44e63b09957c4ab841a5aafe19604c769f3f848f
- Enforcement coverage: https://github.com/safedep/gryph/blob/44e63b09957c4ab841a5aafe19604c769f3f848f/docs/agent-enforcement-coverage.md
- Policy threat model: https://github.com/safedep/gryph/blob/44e63b09957c4ab841a5aafe19604c769f3f848f/docs/security-policy-threat-model.md
- Receipt trust model: https://github.com/safedep/gryph/blob/44e63b09957c4ab841a5aafe19604c769f3f848f/docs/security-policy.md#threat-model-receipt-keys-and-trust
- Phase mapping implementation: https://github.com/safedep/gryph/blob/44e63b09957c4ab841a5aafe19604c769f3f848f/aarm/mediation/phase.go
- Phase mapping tests: https://github.com/safedep/gryph/blob/44e63b09957c4ab841a5aafe19604c769f3f848f/aarm/mediation/phase_test.go
