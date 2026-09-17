<ai_context>
This finding separates agent evaluations' narrative labels from what their checked-in harnesses and fixtures actually execute. It is based on repository-authored code and result material at pinned revisions; Scout did not rerun model trials or independently validate the reported outputs.
</ai_context>

# Benchmark labels must match the executable treatment

**Date:** 2026-09-12  
**Repo:** [redevops-io/multiagent-orchestration-benchmark](https://github.com/redevops-io/multiagent-orchestration-benchmark)  
**Inspected revision:** [`b5528a29012d8ef9855243089ad61e5119a1fcb8`](https://github.com/redevops-io/multiagent-orchestration-benchmark/commit/b5528a29012d8ef9855243089ad61e5119a1fcb8)

## Observation

The repository presents a small paired experiment asking whether “formal runtime-managed orchestration” beats a “strong supervisor decomposing work, running parallel workers, and integrating their output.” It reports 11/11 deterministic gate passes for both arms, a 5–5–1 blinded quality split, and nearly equal manager cost. The write-up is commendably explicit about small N, toy Kotlin tasks, one judge family, unmetered worker token cost, and a corrected empty-completion harness failure.

Reading the executable harness narrows what the experiment actually changes:

- Subtasks come from checked-in `parts.json`; the manager does not decompose the task. The harness loads those parts and assigns workers itself ([`bench.py` lines 20–25](https://github.com/redevops-io/multiagent-orchestration-benchmark/blob/b5528a29012d8ef9855243089ad61e5119a1fcb8/harness/bench.py#L20-L25), [88–101](https://github.com/redevops-io/multiagent-orchestration-benchmark/blob/b5528a29012d8ef9855243089ad61e5119a1fcb8/harness/bench.py#L88-L101)).
- Worker calls run inside an ordinary `for` loop with blocking `subprocess.run`; the worker CLI itself is configured with `--max-subtasks 1 --concurrency 1`. This is sequential execution, not supervisor-managed parallel dispatch ([lines 48–64](https://github.com/redevops-io/multiagent-orchestration-benchmark/blob/b5528a29012d8ef9855243089ad61e5119a1fcb8/harness/bench.py#L48-L64), [93–101](https://github.com/redevops-io/multiagent-orchestration-benchmark/blob/b5528a29012d8ef9855243089ad61e5119a1fcb8/harness/bench.py#L93-L101)).
- Both arms receive the same full contract and hard-coded part descriptions. The formal arm changes contract wording and adds an empty-output retry plus a concatenated-parts compile probe whose state is shown to the integration manager ([lines 96–120](https://github.com/redevops-io/multiagent-orchestration-benchmark/blob/b5528a29012d8ef9855243089ad61e5119a1fcb8/harness/bench.py#L96-L120)).
- The recorded `worker_secs` is the **sum** of per-worker durations, not end-to-end parallel latency ([lines 126–129](https://github.com/redevops-io/multiagent-orchestration-benchmark/blob/b5528a29012d8ef9855243089ad61e5119a1fcb8/harness/bench.py#L126-L129)). It is useful as accumulated worker time, but it cannot support a claim about orchestration makespan.

The checked-in evidence also has an audit boundary. `final_report.json` records quality winners and names a blinded Claude judge, but `bench.py` contains no judge invocation or aggregation routine. Generated `runs/` artifacts—including solutions, prompts assembled at runtime, and traces—are gitignored. The repository therefore enables a fresh rerun of the harness, but the committed aggregate does not carry enough artifacts or derivation code to replay the reported judge decisions. Likewise, the frozen rubric names reliability, replay, and no-loss gates, while the implemented `gate_pass` combines only build, hidden-test correctness, and a substring-based architecture check ([`frozen_config.json` lines 23–25](https://github.com/redevops-io/multiagent-orchestration-benchmark/blob/b5528a29012d8ef9855243089ad61e5119a1fcb8/spec/frozen_config.json#L23-L25), [`bench.py` lines 66–85](https://github.com/redevops-io/multiagent-orchestration-benchmark/blob/b5528a29012d8ef9855243089ad61e5119a1fcb8/harness/bench.py#L66-L85), [`final_report.json` lines 28–84](https://github.com/redevops-io/multiagent-orchestration-benchmark/blob/b5528a29012d8ef9855243089ad61e5119a1fcb8/results/final_report.json#L28-L84)).

## Why this matters

A benchmark can be reproducible in one sense—its source lets another team launch new trials—without making its published result auditable. It can also label an arm with a broad system concept while implementing only a narrow proxy for that concept.

For agent-orchestration studies, use three separate receipts:

1. **Treatment receipt:** enumerate the executable differences between arms. Here the observed treatment is best described as *brief wording plus pre-integration checks and feedback*, not full formal orchestration versus supervisor-led decomposition and parallel dispatch.
2. **Measurement receipt:** define what each number times or counts. Summed worker duration, wall-clock makespan, manager tokens, all-model tokens, and retry overhead answer different questions.
3. **Result-lineage receipt:** retain trial artifacts, blinded-order mapping, judge prompts/responses, exclusions, and aggregation code—or publish hashes and an independently accessible artifact bundle—so reported tables can be derived again without rerunning stochastic models.

This does **not** show that the reported 11 paired outcomes are false. It limits the justified conclusion: the committed material supports a comparison of the harness's narrow treatments on three toy task shapes, while broader claims about supervisor decomposition, parallel orchestration, replay-gated reliability, or auditable judge outcomes need additional executable and artifact evidence.

## Update — expected outputs must be reachable from the fixture (2026-09-15)

A second repository shows the same conformance problem inside a much smaller operations-agent evaluation. [`xiao-w123/ai-agent`](https://github.com/xiao-w123/ai-agent), inspected at [`1c0d63660dbd894a4d5441935f6c38dc61fc5492`](https://github.com/xiao-w123/ai-agent/commit/1c0d63660dbd894a4d5441935f6c38dc61fc5492), checks five live model responses against expected tool names and answer substrings. Its README reports 100% tool-call accuracy and 90% keyword hits, but the checked-in fixture cannot ground some of those expected answers:

- `search_logs` always returns connection-pool exhaustion and timeout lines for an `error` query, regardless of service. Yet the `product-service` case expects the answer to mention cache penetration while listing only that log tool as expected.
- `query_prometheus` returns a fixed 60% memory value and no leak evidence. Yet the `user-service` case lists only that metric tool as expected and scores the final answer for the substrings “memory” and “leak.” Historical reports may contain such evidence, but calling the retrieval tool is not part of that case's expected-tool list.
- “Tool accuracy” is implemented as expected-tool recall: expected calls found divided by expected calls listed. Extra or irrelevant calls carry no penalty.
- “Keyword hit rate” is raw substring presence in the final answer. It does not require the substring to be entailed by a tool observation, so unsupported model completion can improve the score.

The repository does include an executable script, but no committed per-case result or trace from which the README's 100%, 90%, and 4.8-second figures can be derived. Scout did not run the evaluation because it invokes a configured external model and local vector store; static inspection establishes the scorer and fixture mismatch, not what any particular run returned.

This adds a fourth receipt to the benchmark checklist: a **fixture-conformance receipt** should map each expected answer fact to reachable environment or tool evidence, and should distinguish required-call recall from precision, sequence validity, argument validity, and grounded answer support. Before spending model calls, a deterministic preflight can reject cases whose expected evidence is absent from the fixture. Without that check, a high score can reward hallucinating the evaluator's label rather than diagnosing from observations.

## Sources

- [Repository README at the inspected revision](https://github.com/redevops-io/multiagent-orchestration-benchmark/blob/b5528a29012d8ef9855243089ad61e5119a1fcb8/README.md)
- [Executable harness](https://github.com/redevops-io/multiagent-orchestration-benchmark/blob/b5528a29012d8ef9855243089ad61e5119a1fcb8/harness/bench.py)
- [Frozen configuration and decision rule](https://github.com/redevops-io/multiagent-orchestration-benchmark/blob/b5528a29012d8ef9855243089ad61e5119a1fcb8/spec/frozen_config.json)
- [Gate and judge rubric](https://github.com/redevops-io/multiagent-orchestration-benchmark/blob/b5528a29012d8ef9855243089ad61e5119a1fcb8/spec/gates_and_rubric.md)
- [Committed aggregate report](https://github.com/redevops-io/multiagent-orchestration-benchmark/blob/b5528a29012d8ef9855243089ad61e5119a1fcb8/results/final_report.json)
- [Committed per-pair metric matrix](https://github.com/redevops-io/multiagent-orchestration-benchmark/blob/b5528a29012d8ef9855243089ad61e5119a1fcb8/results/full_matrix.json)
- [Narrative write-up and limitations](https://github.com/redevops-io/multiagent-orchestration-benchmark/blob/b5528a29012d8ef9855243089ad61e5119a1fcb8/writeup/does-formal-orchestration-help.md)
- [Operations-agent README and reported scores](https://github.com/xiao-w123/ai-agent/blob/1c0d63660dbd894a4d5441935f6c38dc61fc5492/README.md)
- [Operations-agent deterministic tool fixture](https://github.com/xiao-w123/ai-agent/blob/1c0d63660dbd894a4d5441935f6c38dc61fc5492/tools.py)
- [Operations-agent evaluation script](https://github.com/xiao-w123/ai-agent/blob/1c0d63660dbd894a4d5441935f6c38dc61fc5492/eval.py)
