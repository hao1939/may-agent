<ai_context>
summary: "memory-tripwires supplies 16 inspectable probes over eight synthetic agent-memory failure classes. Its strongest reusable contribution is experimental hygiene: export only the prefix visible at a probe boundary, start each probe from fresh state, keep paired questions visible, and report criterion-level outcomes rather than an aggregate score. The tiny English-only fixture set has no automatic semantic grader; one Mem0 observation is confounded by mismatched report and observation years."
triggers: ["memory-tripwires", "agent memory evaluation", "probe isolation", "temporal memory", "selective forgetting", "memory benchmark"]
last_updated: "2026-11-10"
source_basis: "Live GitHub Repository Search plus pinned inspection and local execution of Lopeloop/memory-tripwires at commit 2ac05f2fb65f1c179efc25599133e6ab97f5af52. Scout read the complete README, scenario corpus, fixture exporter, all seven repository-authored tests, and the relative-date example and observation record. The fixture validator and seven tests passed locally; Scout did not run any model or memory system, independently reproduce the Mem0 observation, or validate the semantic criteria."
</ai_context>

# Agent memory probes need isolated prefixes and criterion-level results

**Date:** 2026-11-10  
**Disposition:** New knowledge  
**Question:** What minimum experimental controls make a small agent-memory failure fixture useful without overstating it as a benchmark?  
**Repo:** https://github.com/Lopeloop/memory-tripwires  
**Reviewed version:** commit [`2ac05f2fb65f1c179efc25599133e6ab97f5af52`](https://github.com/Lopeloop/memory-tripwires/commit/2ac05f2fb65f1c179efc25599133e6ab97f5af52)  
**Coverage:** live repository-search metadata; repository metadata and complete recursive tree; complete README; all 16 probes in the scenario corpus; fixture exporter; all seven repository-authored tests; and the complete relative-date example and observed-result record. Scout ran the dependency-free validator and tests locally, but did not call a model or memory service.

## Source observation

`memory-tripwires` is a deliberately small set of eight synthetic two-probe scenarios for agent-memory mistakes:

- replacing a current preference without rewriting its history;
- separating event time from report time;
- resolving relative dates at the original message;
- preserving context-specific instructions;
- retaining uncertainty around a tentative plan;
- preserving negation and subject ownership;
- withholding a requested secret while retaining unrelated memory; and
- separating a source observation from a derived general preference.

The repository avoids presenting these as a leaderboard or validated benchmark. Each probe declares semantic `must` and `must_not` criteria, while the supplied tool only validates and exports fixtures. It does not call a model or grade an answer.

The useful control is the export boundary. A probe identifies an inclusive `after_turn`; the tool emits only that turn and earlier turns plus the question. It deliberately omits the criteria, case-level interpretation limit, later messages, and dataset wrapper. Tests reject unknown or duplicate boundaries, prove a pre-update probe cannot see the later preference, check report-time ordering, and verify export does not mutate the source fixture. In Scout's local replay, `python3 tripwires.py` reported eight valid cases and 16 probes, and all seven unit tests passed.

The README adds three experiment rules that are easy to lose in a general memory evaluation:

1. start from fresh isolated state for every probe, even when two probes share a scenario;
2. ingest only the exported turns in order and preserve their report timestamps; and
3. retain individual `PASS`, `FAIL`, `UNCLEAR`, or `UNSUPPORTED` outcomes rather than collapsing the set into one quality score.

Paired probes matter because they expose one-sided fixes. For example, a system can correctly adopt the new dairy-milk preference yet erase the historical oat-milk preference; withhold a locker code yet incorrectly forget an unrelated tea preference; or retract an inferred general preference while also losing the underlying observation. A single question would hide those asymmetric failures.

## The relative-date observation shows why transformation evidence matters

The repository includes one exploratory Mem0 OSS observation for the question, “What did I do on April 2?” The source prefix says that on April 2 the user only checked an application's status. The recorded extraction instead stored that activity as April 1, and the subsequent memory-only answer said no April 2 activity was available. The same answer model given the original prefix identified the April 2 status check.

The record preserves the extraction prompt, extraction response, stored memories, retrieved context, answer instruction, both answers, package and source revisions, model settings, storage setup, and manual assessment. That makes the failure inspectable across transformation stages rather than visible only as a wrong final answer.

However, the observation does not isolate a Mem0 defect. The adapter prefixed synthetic report timestamps from 2030, while Mem0's extraction prompt inserted its own observation and current date from 2026. The repository explicitly states that timestamp adaptation, the conflicting observation year, model behavior, or their interaction could have caused the error. This is a useful negative example of why an observed memory failure needs the source prefix, transformed extraction request, stored representation, retrieved representation, and answer—not just the final response.

## Reusable interpretation

Small diagnostic fixtures become useful when they preserve **experimental boundaries**, not when they imitate a large benchmark.

For agent-memory evaluation, a defensible probe record should bind:

1. the dataset and system revisions;
2. the exact visible prefix at the question boundary;
3. fresh-state or retained-state semantics;
4. source report time separately from event time and storage time;
5. every transformation from source turns to extracted and retrieved memory;
6. the actual answer plus each positive and negative criterion; and
7. an explicit unsupported state when the system cannot perform the requested operation.

This produces a failure-localization artifact. If source-context control passes but memory-backed answering fails, the record can show whether information changed during extraction, storage, retrieval, or answer generation. It does not by itself prove which component is causal, but it narrows the next experiment.

The selective-forgetting case also encodes an important evidence boundary: response-level withholding is not proof of physical deletion. Because the synthetic secret remains in the raw fixture, a non-disclosing answer says nothing about storage, summaries, logs, backups, or model weights. Deletion assurance therefore needs separate storage and lineage evidence rather than credit from the conversational answer alone.

For May-style agent infrastructure, these patterns suggest a compact regression suite for durable context and memory: isolate each probe, keep source and derived representations, use paired questions to detect overcorrection, and refuse a single aggregate score that hides which invariant failed. The fixture cases are examples, not a sufficient coverage set.

## Limitations

- The repository was created on the observation date and has no adoption or independent validation evidence.
- The dataset contains only eight tiny, synthetic, English-language scenarios and 16 probes. It is public and easy for models to memorize.
- It does not test long histories, scale, persistence across restarts, adversarial extraction, cost, latency, multilingual memory, or realistic user ambiguity.
- There is no automatic semantic grader. The `must` and `must_not` criteria require human judgment or a separately validated judge.
- Scout's passing local run verifies fixture structure and the repository-authored isolation tests, not memory-system quality or completeness of the scenarios.
- Scout did not run Mem0, call either recorded model, inspect provider logs, or independently reproduce the relative-date result.
- The sole observed Mem0 failure is confounded by synthetic 2030 report timestamps and a 2026 observation/current date in the extraction prompt. It cannot establish the component that caused the date shift or support a general Mem0 quality claim.
- The plain-context comparison shows that one answer path retained the needed detail; it does not isolate the memory mechanism from adapter, prompt, retrieval, or model differences.
- The forgetting probe tests answer behavior only and supplies no evidence of deletion from storage or downstream artifacts.
- GitHub Search returned `incomplete_results: false` for the bounded discovery query; this does not make the repository representative of agent-memory tools or evaluation practice.

## Sources

- **Repo:** https://github.com/Lopeloop/memory-tripwires
- **Inspected revision:** https://github.com/Lopeloop/memory-tripwires/commit/2ac05f2fb65f1c179efc25599133e6ab97f5af52
- **README:** https://github.com/Lopeloop/memory-tripwires/blob/2ac05f2fb65f1c179efc25599133e6ab97f5af52/README.md
- **Scenario corpus:** https://github.com/Lopeloop/memory-tripwires/blob/2ac05f2fb65f1c179efc25599133e6ab97f5af52/cases/scenarios.json
- **Fixture exporter:** https://github.com/Lopeloop/memory-tripwires/blob/2ac05f2fb65f1c179efc25599133e6ab97f5af52/tripwires.py
- **Isolation tests:** https://github.com/Lopeloop/memory-tripwires/blob/2ac05f2fb65f1c179efc25599133e6ab97f5af52/tests/test_tripwires.py
- **Relative-date example:** https://github.com/Lopeloop/memory-tripwires/blob/2ac05f2fb65f1c179efc25599133e6ab97f5af52/examples/relative-date/README.md
- **Observed relative-date record:** https://github.com/Lopeloop/memory-tripwires/blob/2ac05f2fb65f1c179efc25599133e6ab97f5af52/examples/relative-date/observed.json
