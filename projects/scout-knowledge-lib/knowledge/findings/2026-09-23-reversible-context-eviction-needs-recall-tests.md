<ai_context>
summary: "A Reddit project description proposes tiering live agent context into verbatim, compressed-pointer, and archived forms, while retaining immutable snapshots and a cheap in-prompt index for retrieval. The useful design lesson is that reversible eviction needs both discoverability and outcome-based recall tests: archive integrity alone does not prove the agent can notice when to restore omitted evidence, and keyword-overlap replay is only a correlation signal."
triggers: ["context eviction", "context garbage collection", "reversible compaction", "archived context", "recall safety", "shadow replay", "jev-gc"]
last_updated: "2026-09-23"
source_basis: "Complete body of Reddit post t3_1wnv3x2 read from Reddit's public Atom search feed; first-party project description only. Linked documentation, repository, comments, relevance quality, and runtime behavior were not inspected or reproduced."
</ai_context>

# Reversible Context Eviction Still Needs Recall-Safety Tests

Date: 2026-09-23  
Source: https://www.reddit.com/r/LLMDevs/comments/1wnv3x2/i_built_a_context_gc_for_longrunning_ai_agents/  
Stable post ID: `t3_1wnv3x2`  
Coverage: complete public Atom body; linked documentation, repository, comments, and implementation not reviewed

## Signal

A current Reddit post describes **jev-gc**, a Python library intended to reduce
the live prompt of a long-running agent. According to the author, it consumes
OpenTelemetry spans and assigns them to three tiers: HOT content remains
verbatim, WARM content becomes a one-line pointer, and COLD content leaves the
prompt but remains in an immutable archive. Deterministic rules handle cases
such as pinned, recent, empty, or errored spans; a relevance model handles the
ambiguous remainder in batches. Errored spans remain represented even when
their payload is compressed.

The post identifies an important failure mode in "reversible" compaction:
archived content can be functionally lost if the agent cannot know that it
should retrieve it. Its proposed mitigation is to retain a cheap keyword-only
index of evicted content in the prompt so the agent can recover an archive ID
and request the full record.

This separates three properties that are often collapsed into one:

1. **Preservation:** evicted bytes still exist in an immutable snapshot.
2. **Discoverability:** the active context contains enough of a pointer to make
   a relevant archived item findable.
3. **Recovery effectiveness:** the agent actually recalls the right item in
   time and improves or protects the task outcome.

A system can satisfy the first property while failing the other two. Reversible
storage is therefore necessary but not sufficient for reversible agent
behavior.

## Evaluation implication

The author describes a shadow-replay mode that compares the same task with full
context and with garbage collection enabled, then checks whether evicted spans
that overlap with the full-context answer are missing from the compacted answer.
The post explicitly labels the current keyword-overlap method as correlation,
not proof that an eviction caused harm.

A stronger recall-safety evaluation should preserve that caution and test the
retrieval loop directly:

- Plant evidence whose later relevance is not obvious at eviction time,
  including old failures, rejected alternatives, user constraints, and exact
  identifiers.
- Record separately whether the evidence was preserved, whether its pointer was
  visible, whether the agent attempted retrieval, and whether the restored
  evidence changed the final decision.
- Compare full-context, compacted-with-retrieval, and compacted-without-retrieval
  runs under the same task and model configuration.
- Score task-specific obligations and failure prevention, not only lexical
  overlap with a reference answer. A semantically necessary fact may share no
  keyword with the final prose, while copied keywords may have no causal value.
- Include negative controls where retrieval is unnecessary, so an always-recall
  policy cannot appear safe by simply reconstructing the entire prompt.

This complements the library's [context-compaction audit finding](./2026-08-08-compactdiff-session-history-audit.md): an external history can prove what
was removed, while recall-safety tests ask whether the active agent could
recover what mattered.

## Evidence boundary

This is a first-party project description from a pseudonymous Reddit account,
not an independently verified deployment or benchmark. The post reports about
96 microseconds of pipeline overhead per span, 1.14× overhead growth for a 100×
span-count increase, and roughly 2% memory growth from archived content, but it
also says these measurements used a fake relevance scorer. They therefore say
nothing about relevance-decision quality, end-task accuracy, or the cost of a
real scoring model. Scout did not inspect the linked documentation or source,
run the library, validate the benchmark, or read comments. The durable value of
this observation is the preservation/discoverability/effectiveness distinction,
not evidence that jev-gc currently satisfies it.
