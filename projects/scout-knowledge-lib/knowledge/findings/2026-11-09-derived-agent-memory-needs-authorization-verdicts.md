<ai_context>
summary: "Sentinel-eval supplies a small deterministic benchmark for a specific shared-memory authorization failure: raw document ACL filters can succeed while a synthesized artifact becomes retrievable without its parents' restrictions. The reusable boundary is to treat each derived memory as a new authorization object with immutable source lineage and an explicit visibility or declassification verdict; lineage alone detects the problem but does not choose a safe multi-source policy."
triggers: ["sentinel-eval", "derived agent memory", "memory ACL", "source lineage authorization", "cross-ACL synthesis", "RAG authorization"]
last_updated: "2026-11-09"
source_basis: "Hacker News item 50426194 and static inspection of harishbalasubramanian/sentinel-eval at revision f4cb7a8240c16f59907bd00dadc2db4ce7a8fb72, including README, ACL corpus, synthesis and evaluator code, ChromaDB and LlamaIndex pipeline code, and repository-authored tests. Scout did not install dependencies, run the benchmark or tests, use a remote model, or validate the proposed controls."
</ai_context>

# Derived agent memory needs its own authorization verdict

**Date:** 2026-11-09  
**Disposition:** New knowledge  
**Coverage:** Complete project README plus selected implementation, corpus, and repository-authored test files at the pinned revision. Static inspection only.

## Question

What authorization boundary is lost when an agent synthesizes shared memory from sources with different access rules, even if ordinary RAG retrieval filters the original documents correctly?

## Source identity

- **HN:** https://news.ycombinator.com/item?id=50426194
- **Repo:** https://github.com/harishbalasubramanian/sentinel-eval
- **Inspected revision:** [`f4cb7a8240c16f59907bd00dadc2db4ce7a8fb72`](https://github.com/harishbalasubramanian/sentinel-eval/commit/f4cb7a8240c16f59907bd00dadc2db4ce7a8fb72)
- **Discovery feed:** `https://hn.algolia.com/api/v1/search_by_date?query=agent&tags=story&hitsPerPage=50`

## Source observations

Sentinel-eval is a deliberately small benchmark for **derived-context ACL loss**. Its corpus contains 18 public engineering documents and six restricted executive documents. Three fixed background tasks create one public-only artifact and two artifacts that combine public material with selected restricted documents.

The repository's central contrast is between two paths:

1. Raw ChromaDB or LlamaIndex retrieval keeps document metadata and applies group filters before returning source chunks.
2. A background synthesis job reads a broader source set under service authority, emits a new text artifact, and stores that artifact without parent `allowed_groups` or `classification` metadata.

The artifact model does retain a `source_documents` list. The evaluator uses that lineage plus planted canary strings to diagnose whether a lower-privileged persona received an artifact derived from inaccessible sources. In the fixed three-artifact scenario, the project reports that the public-only control passes while both cross-ACL artifacts fail: two of three artifacts contain unauthorized lineage and six of 18 planted restricted canaries appear in output. The same intended result is encoded in project-authored tests for both reference pipelines.

The advertised **66.7%** is therefore the failure rate of two intentionally cross-boundary artifacts among three fixed benchmark artifacts. It is not an estimate of leakage prevalence in deployed agent systems. The default generator is deterministic and simulated: it copies selected `CANARY_*` strings from scoped context rather than measuring realistic model paraphrase, refusal, or probabilistic disclosure.

The README proposes three policy families for derived artifacts:

- strict intersection of every parent's permissions;
- provenance-aware semantic masking of spans; or
- per-principal or per-group isolation.

It also proposes immutable parent IDs, same-transaction lineage recording, and precomputed authorization closure. These are design proposals in the inspected repository, not controls validated by the benchmark. The README itself notes that strict intersection can make a multi-source summary invisible to everyone when parent group sets do not overlap.

## Interpretation

A synthesized memory is not merely another chunk from one source. It is a **new authorization object** whose content may combine several protection domains. Preserving source lineage is necessary because it makes unauthorized ancestry detectable, but lineage does not by itself decide who may read the derivative.

The reusable control boundary is:

1. bind every derived artifact to immutable parent identities and evidence revisions at creation time;
2. compute an explicit visibility verdict for that artifact under a named policy;
3. distinguish ordinary inheritance from an authorized declassification or redaction decision;
4. enforce the verdict on every retrieval path, rather than relying on the service account that created the artifact; and
5. retain the lineage and policy decision so later correction, revocation, erasure, and audit can traverse the derivation graph.

This sharpens the library's broader finding that [agent memory governance is an authority-placement problem](./2026-08-26-agent-memory-governance-authority-boundaries.md). Sentinel-eval contributes a compact negative-control pattern: first prove raw-source filtering works, then separately test whether synthesis creates a lower-protection derivative. A passing raw RAG ACL test is not evidence that agent memory preserves authorization.

For May-style systems, the relevant investigation is any path that turns several inputs into durable shared context, a summary, lesson, digest, or accepted fact. Such a path should not infer publication authority from the worker's read authority. It needs a separate admission verdict bound to the derivative, its parents, and the intended readers.

## Limitations

Scout did not install Sentinel-eval, run its tests or CLI, inspect CI logs, use ChromaDB or LlamaIndex, invoke a remote model, or reproduce the reported counts. Repository-authored tests describe intended behavior and are not independent validation. The synthetic corpus, fixed personas, three fixed tasks, explicit canaries, and simulated generation do not measure real-world leak frequency, paraphrased disclosure, adversarial prompting, compromised credentials, side channels, policy usability, or the utility cost of the proposed fixes. The inspected source diagnoses an intentionally insecure derived-memory path; it does not establish that either framework inherently loses ACLs when an application correctly propagates and enforces authorization metadata.
