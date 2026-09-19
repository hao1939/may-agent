---
title: "MisakaNet — Retrieval Trust Needs One Canonical Evidence Predicate"
source: github
date: 2026-09-19
last_updated: 2026-09-19
type: finding
tags: [github, ai-agents, memory, debugging, evidence, provenance, retrieval, trust]
relevance: high
---

<ai_context>
This note examines trust labels and retrieval behavior in one pinned MisakaNet revision. It distinguishes the existence of a verification heading, declared evidence levels, URL reachability, writing quality, and demonstrated reuse. It is a source review, not an independent validation of the lessons or hosted service.
</ai_context>

# MisakaNet — Retrieval Trust Needs One Canonical Evidence Predicate

## Source and coverage

- **Repo:** [Ikalus1988/MisakaNet](https://github.com/Ikalus1988/MisakaNet)
- **Inspected commit:** [`b98e835e98b3a1257da49a9cfcd9c1a56bfe5a75`](https://github.com/Ikalus1988/MisakaNet/tree/b98e835e98b3a1257da49a9cfcd9c1a56bfe5a75)
- **Observation date:** 2026-09-19
- **Discovery query:** GitHub Repository Search API for `topic:ai-agents pushed:>2026-09-18 stars:>10`, sorted by recently updated; `incomplete_results` was `false`.
- **Read:** repository metadata, complete recursive Git tree, README, trust and verified-semantics documents, lesson schema, evidence-level implementation and tests, local search ranking code, provenance checker, and provenance workflow.
- **Not run:** repository tests, lesson scoring, local or remote search, MCP tools, hosted endpoints, provenance network sweep, or any lesson's prescribed recovery steps.
- **Disposition:** new knowledge — a concrete example of why an agent-memory system should derive ranking, badges, admission, and public language from one evidence state rather than several similarly named proxies.

## What exists at the pinned revision

MisakaNet is a Git-backed collection of debugging lessons for coding agents. Its source includes a zero-dependency local search engine, MCP-facing surfaces, structured lesson metadata, an E0–E4 evidence model, quality and trust scoring, and a provenance gate. These are substantive implementation surfaces rather than only a repository description.

The canonical `misakanet/evidence.py` model is conservative in one useful respect: missing or malformed evidence levels normalize to E0, and its progression separates self-report, maintainer review, local reproduction, CI or sandbox verification, and independent reuse. The trust score then scales writing quality by the declared evidence level instead of treating prose quality as proof.

## Implementation signal: “verified” is also a separate text predicate

The inspected local search engine does not use that E0–E4 state for its `verified` boost. `_is_verified()` returns true when lesson content contains a level-two `Verify` or `Verification` heading. `_compute_boost()` then adds `BOOST_VERIFIED = 0.10` to the composite search score. The accepted verified-semantics decision explicitly defines this badge as section presence.

Those mechanics create two independent trust vocabularies:

1. **Binary verified:** inferred from a heading's existence and used by the local search boost.
2. **Graded evidence:** read from frontmatter (or inferred by index-generation code), used for trust scoring and public evidence badges.

A heading is a useful structural requirement: it tells contributors where to put reproduction steps. It is not itself evidence that those steps ran, passed, matched the current environment, or were reviewed. A lesson can therefore receive the local `[verified]` label and ranking bonus while remaining E0 in the canonical evidence model. Conversely, a declared E4 lesson can win the graded trust calculation without the local search engine consulting that field for its verified boost.

## Provenance checks a citation's existence, not its entailment

The provenance gate adds another useful but narrower signal. It rejects placeholder URLs and newly dead 404/410 citations, handles GitHub links through public API resources, and treats network failures or unusual statuses as unknown rather than evidence of invalidity. For newly added E2/E3 lessons, absence of any resolvable citation produces an advisory in `--strict-new`; the workflow runs that command without converting the advisory into a failed step.

This proves—or fails to prove—URL reachability. It does not establish that the cited page supports the lesson's root cause, that the stated repair was executed, or that an external reuse succeeded. The workflow's default success comment, “every cited source resolves,” is accurate only for reachability and should not be promoted into “the lesson is verified.”

## Documentation drift makes the ambiguity visible

At the same pinned commit, the canonical evidence module and `docs/trust-semantics.md` define E1 as maintainer review, E2 as local reproduction, and E3 as CI/sandbox verification. A separate README table labels E1 “CI verified,” E2 “PR merged,” and E3 “Maintainer verified.” That is not merely wording drift: each mapping implies different proof and ordering.

The repository's trust document also defines verified as fact-checking against original source material, while the accepted verified-semantics record and search code define the same word as presence of a verification section. Consumers cannot safely interpret a bare `verified` badge without knowing which predicate produced it.

## Reusable design rule: compile trust once, project it everywhere

Agent memory is executable context: ranking a lesson higher makes future agents more likely to act on it. Treat trust as a typed record, not a collection of labels assembled independently by each surface.

A practical record should separate:

- **structure:** required problem, cause, repair, and verification sections exist;
- **provenance:** cited artifacts resolve, their immutable identities, and what claim each supports;
- **execution:** command or workflow identity, environment, timestamp, exit/result, and retained receipt;
- **review:** reviewer identity and exact revision reviewed;
- **reuse:** independent consumer, applicability conditions, and observed outcome;
- **freshness:** source revision and last revalidation;
- **admission:** which checks were mandatory, advisory, unknown, or bypassed.

Then compile every badge, rank boost, quality/trust score, API field, and public count from that one state machine. A human-readable `## Verification` section can remain required, but it should be an input to evidence review—not the predicate that grants a verification label.

This extends the library's broader [operational-memory control-plane principle](../hn-agent-operational-memory.md#shared-memory-turns-knowledge-writes-into-a-control-plane-operation-aug-2026): admission is incomplete unless retrieval uses the admitted state consistently.

## Limitations

This is static source inspection at one fast-moving commit. The recursive tree response was not truncated, but only the trust-, search-, schema-, and provenance-related files named above were read; absence claims are limited to those inspected paths. Project-authored tests show intended evidence semantics but were not executed here. No corpus-wide comparison was made between verification headings and E-level metadata, so this note identifies a representational gap, not its prevalence or measured effect on search outcomes. The hosted service may use a different revision or ranking path.

## Primary implementation references

- [Canonical E0–E4 semantics and trust-score implementation](https://github.com/Ikalus1988/MisakaNet/blob/b98e835e98b3a1257da49a9cfcd9c1a56bfe5a75/misakanet/evidence.py)
- [Trust semantics and promotion rules](https://github.com/Ikalus1988/MisakaNet/blob/b98e835e98b3a1257da49a9cfcd9c1a56bfe5a75/docs/trust-semantics.md)
- [Binary verification decision record](https://github.com/Ikalus1988/MisakaNet/blob/b98e835e98b3a1257da49a9cfcd9c1a56bfe5a75/docs/verified-semantics.md)
- [Local search ranking and `_is_verified()`](https://github.com/Ikalus1988/MisakaNet/blob/b98e835e98b3a1257da49a9cfcd9c1a56bfe5a75/misakanet/search/engine.py)
- [Lesson frontmatter schema](https://github.com/Ikalus1988/MisakaNet/blob/b98e835e98b3a1257da49a9cfcd9c1a56bfe5a75/schemas/lesson.json)
- [Citation reachability checker](https://github.com/Ikalus1988/MisakaNet/blob/b98e835e98b3a1257da49a9cfcd9c1a56bfe5a75/scripts/check_provenance.py)
- [Provenance workflow](https://github.com/Ikalus1988/MisakaNet/blob/b98e835e98b3a1257da49a9cfcd9c1a56bfe5a75/.github/workflows/provenance-gate.yml)
- [README with the conflicting E-level table](https://github.com/Ikalus1988/MisakaNet/blob/b98e835e98b3a1257da49a9cfcd9c1a56bfe5a75/README.md#evidence-levels)
