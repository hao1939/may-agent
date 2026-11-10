<ai_context>
summary: "Uncle binds requirements, plans, reviews, verification, approvals, and release evidence to one Git tree and refuses to collapse artifact integrity, signer authenticity, human approval, and software correctness into one green verdict. The reusable rule is that evidence applies only to the exact artifact identity it inspected; a later edit makes the old evidence stale even when the review itself was valid. Scout inspected the producer-authored article, pinned repository documentation, verifier implementation, selected tests, and complete tree metadata, but did not run the software or independently verify its attestations."
triggers: ["artifact-bound evidence", "stale agent review", "Git tree attestation", "Uncle verifier", "agent verification provenance", "integrity versus authenticity"]
last_updated: "2026-11-10"
source_basis: "HN item 50446314; Brian Woods' article; and static inspection of unclehq/uncle at commit 6e439044600872267e2498f178d6dfa7e21c5af2, including README, docs/verify.md, scripts/uncle-verify.py, attestation builders, selected tests, and the complete untruncated 638-entry repository tree. Scout did not execute Uncle, its test suite, an agent run, signing, or verification against a live change."
</ai_context>

# Agent Evidence Must Bind the Exact Artifact

**Date:** 2026-11-10  
**Disposition:** new knowledge  
**Source:** https://news.ycombinator.com/item?id=50446314  
**Article:** https://brian.biz/blog/ai-agents-verify/  
**Repo:** https://github.com/unclehq/uncle  
**Inspected revision:** [`6e439044600872267e2498f178d6dfa7e21c5af2`](https://github.com/unclehq/uncle/commit/6e439044600872267e2498f178d6dfa7e21c5af2)

## Observation

The article describes a common coding-agent failure without claiming that the
review itself was necessarily bad: an agent or second reviewer inspects one
version of the code, another edit happens, and the system publishes a different
version while retaining the earlier green verdict. The central claim is that
the software change—not the agent or review session—should be the unit to which
evidence is attached.

The pinned Uncle repository implements that idea around a Git-tree identity.
Its documentation says that requirements, approved plans, implementation,
review, verification, audit, human approvals, and the release artifact are
recorded in an in-toto statement, optionally wrapped in a signed DSSE envelope.
The verifier checks that stage inputs and the released tree agree, approved
document hashes still match, blocking findings have dispositions, required
gates have the stated approval mode, and the current filtered tree matches both
the release artifact and attestation subject.

The source also keeps four claims separate:

1. **Artifact integrity:** the held tree is the tree to which the recorded
   process evidence applies.
2. **Signer authenticity:** a signature validates against a supplied trust
   root; a present but untrusted signature is not upgraded to authentication.
3. **Review and approval evidence:** named stages recorded pass and required
   approval records exist, including whether a gate was unattended.
4. **Software correctness:** not established by the attestation; tests,
   reviewers, requirements, and verifier code can all still be wrong.

That separation is visible in the command contract. The documented exit codes
distinguish verified, refused, usage failure, and integrity-only results. The
verifier source compares the normalized current tree with both the release tree
and subject digest, and it reports unattended gates separately rather than
silently translating them into human approval.

## Reusable finding: evidence has a subject identity and a claim type

An agent result should not be stored as an unqualified statement such as
“review passed” or “tests green.” A durable receipt should include at least:

- the exact artifact identity inspected, such as a Git tree, immutable bundle
  digest, or content-addressed deployment revision;
- the check identity and its resolved inputs;
- the observed outcome, including unavailable and failed states;
- the actor or mechanism that produced the evidence;
- the approval identity and delegation mode, if approval is claimed; and
- the claim class: integrity, authenticity, process conformance, observed
  effect, or correctness evidence.

Before publication or effect execution, the system should recompute the
artifact identity and reject or expire evidence bound to a different subject.
The important distinction is not “the reviewer was wrong” but “the evidence no
longer applies.” Re-running only the final check is insufficient when earlier
requirements, plans, reviews, or approvals were also bound to the old artifact.

This complements [Agent-written software needs fixtures with independent
evidence](./2026-11-10-zthr-fixtures-need-independent-evidence.md). That finding
asks whether an acceptance mechanism can reject its target defect and whether a
later observer confirms the effect. Uncle contributes a different boundary:
even a discriminating check and valid review become stale when the artifact
changes after they run.

## Evidence boundaries

- The article, repository, examples, verifier, and tests are producer-authored.
  The HN submission had two comments, one criticizing it as promotional and one
  author response; it did not provide independent validation.
- Scout inspected the complete 638-entry tree metadata and targeted source for
  attestation construction, verification, and selected tests, but did not run
  Uncle, the verifier, the tests, any supported coding agent, or a full
  plan-to-publication workflow.
- A valid artifact binding does not establish that the tests or review were
  adequate, that approval identity was authenticated, or that published code is
  correct or secure.
- The repository documentation says its currently committed attestation lacks a
  usable trust root and may yield only integrity status. It also says not every
  project pull request carries an attestation and some changes are committed
  directly, so the repository is not evidence of universal self-application.
- Unsigned evidence stored beside writable code can be replaced by an actor
  able to modify both. The project itself says hostile unsandboxed agents need a
  signing key outside their reach and an appropriate sandbox; Scout did not
  test that threat boundary.
- The inspected revision was current during this scan, but the project is young
  and changing quickly. Findings apply to the pinned source, not future releases
  or deployments.

## Sources inspected

- HN discovery item: https://news.ycombinator.com/item?id=50446314
- Producer article: https://brian.biz/blog/ai-agents-verify/
- Pinned repository: https://github.com/unclehq/uncle/tree/6e439044600872267e2498f178d6dfa7e21c5af2
- README: https://github.com/unclehq/uncle/blob/6e439044600872267e2498f178d6dfa7e21c5af2/README.md
- Verification contract: https://github.com/unclehq/uncle/blob/6e439044600872267e2498f178d6dfa7e21c5af2/docs/verify.md
- Verifier implementation: https://github.com/unclehq/uncle/blob/6e439044600872267e2498f178d6dfa7e21c5af2/scripts/uncle-verify.py
- Attestation construction: https://github.com/unclehq/uncle/blob/6e439044600872267e2498f178d6dfa7e21c5af2/scripts/lib/build_attestation.py
- Selected tests: https://github.com/unclehq/uncle/tree/6e439044600872267e2498f178d6dfa7e21c5af2/scripts/tests
- Complete tree API: https://api.github.com/repos/unclehq/uncle/git/trees/6e439044600872267e2498f178d6dfa7e21c5af2?recursive=1
