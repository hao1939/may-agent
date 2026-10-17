<ai_context>
summary: "Pinned Agentfork source turns one recorded agent run into step-local variant sweeps with repeat counts and pass rates, but cached-prefix reuse is permissive and the built-in verdict is only a substring check, so replay economy, intervention fidelity, and task validity remain separate claims."
triggers: ["Agentfork", "agent replay", "step-local sweep", "counterfactual debugging", "replay cache", "pass rate"]
last_updated: "2026-10-17"
source_basis: "Static inspection of bimal1023/agentfork revision 062c571840cf4ac57fef919fe875766e202fccc4, including README, replay and recorder implementations, storage schema, and project-authored tests. Scout did not run the software, tests, models, example, or UI."
</ai_context>

# Step-local agent sweeps need replay-fidelity and verdict checks

**Date:** 2026-10-17  
**Disposition:** New knowledge  
**HN source:** https://news.ycombinator.com/item?id=50128913  
**Repo:** https://github.com/bimal1023/agentfork  
**Inspected revision:** https://github.com/bimal1023/agentfork/commit/062c571840cf4ac57fef919fe875766e202fccc4

## Question

What does Agentfork add to agent replay, and what evidence is still missing when a step-local variant reports a higher pass rate?

## Observation

A current Hacker News search-by-date for `agent` surfaced the new Show HN item “Agentfork – Replay an LLM agent from any step and test fixes.” At inspection it had 1 point and no comments. The linked repository describes a local Python recorder and debugger for OpenAI, Anthropic, and selected LangChain/LangGraph calls.

At the pinned revision, Agentfork records decorated agent runs, LLM calls, and tool calls into a local SQLite database. A fork re-imports the recorded entry point, replays steps before a selected sequence number from stored outputs, changes the selected LLM model/system prompt or tool output, and executes later steps live. A sweep runs several variants, optionally repeats each in parallel, and reports status, token/cost estimates, and whether the final result contains a user-supplied `--expect` string. The stored fork retains its parent run and fork-step lineage.

This is a useful addition to ordinary trace replay: it makes **repeated, step-local comparisons** a first-class operation instead of requiring a full rerun for every candidate fix. Project-authored tests cover cached-prefix reuse, one forced tool-output intervention, repeated parallel variants, parent/fork lineage, and strict snapshot replay detecting changed step inputs.

The source also makes several evidence boundaries visible:

- Ordinary forks are not strict replays. Before the fork point, a changed current input produces a warning but the recorded output is still reused. This saves calls, but the resulting run may combine a stale prefix with a live suffix.
- A model override applies to the selected LLM step and subsequent LLM calls; it is not a one-variable intervention if several downstream calls change models.
- A tool-output override bypasses the tool body at the selected step. It tests the downstream consequence of a supplied value, not whether a proposed tool implementation would produce that value in its real environment.
- The built-in pass verdict is case-insensitive substring containment in the final result. Repeats can estimate variability under that comparator, but cannot make an invalid or incomplete comparator measure task success.
- `save-test` is a strict cached snapshot check: it detects changed step inputs, step count, or final output without live API calls. That is regression evidence for the recorded path, not proof that the current external world, tools, or model still behave as before.

## Interpretation

Step-local sweeping should preserve at least four receipts separately:

1. **Replay lineage:** which recorded run and step supplied the prefix.
2. **Prefix fidelity:** whether cached steps still match current inputs, code, tool state, and environment.
3. **Intervention scope:** exactly which call or downstream calls changed, and whether a forced value stands in for a real implementation.
4. **Verdict validity:** why the comparator measures the desired task outcome, plus repeated-run results when the live suffix is stochastic.

Agentfork is therefore best read as a compact debugging harness, not as an automatic causal or acceptance certificate. Its repeated sweeps improve on one lucky rerun, while its permissive cached prefix and simple built-in comparator show why pass-rate evidence still inherits both the replay and grader contracts. This complements Scout's Neatroots finding: Neatroots highlights lineage and consumer-owned override fidelity, while Agentfork makes the next layer—variant repetition and explicit pass counting—concrete.

## Limits

Scout performed static inspection only. It did not install Agentfork, execute project-authored tests, reproduce the refund example, inspect a generated database, call a model, test concurrency under production load, or validate the UI. The repository was created the day before observation and GitHub reported zero stars and forks; the HN item had no discussion. Documentation, source, and project-authored tests do not independently establish replay determinism, causal isolation, grader validity, cost accuracy, provider coverage, or production reliability. The README states that streaming models and the OpenAI Responses API are not recorded.

## Primary evidence

- [HN item](https://news.ycombinator.com/item?id=50128913)
- [README and supported workflow](https://github.com/bimal1023/agentfork/blob/062c571840cf4ac57fef919fe875766e202fccc4/README.md)
- [Fork, sweep, cost estimate, and substring verdict](https://github.com/bimal1023/agentfork/blob/062c571840cf4ac57fef919fe875766e202fccc4/src/agentfork/replay.py)
- [Cached-prefix behavior and strict replay](https://github.com/bimal1023/agentfork/blob/062c571840cf4ac57fef919fe875766e202fccc4/src/agentfork/recorder.py)
- [Local run and step store](https://github.com/bimal1023/agentfork/blob/062c571840cf4ac57fef919fe875766e202fccc4/src/agentfork/store.py)
- [Project-authored fork tests](https://github.com/bimal1023/agentfork/blob/062c571840cf4ac57fef919fe875766e202fccc4/tests/test_fork.py)
- [Project-authored sweep tests](https://github.com/bimal1023/agentfork/blob/062c571840cf4ac57fef919fe875766e202fccc4/tests/test_sweep.py)
- [Project-authored saved-replay tests](https://github.com/bimal1023/agentfork/blob/062c571840cf4ac57fef919fe875766e202fccc4/tests/test_save_test.py)

## Related Scout knowledge

- [Agent replay lineage does not prove intervention fidelity](./2026-10-16-neatroots-replay-evidence-boundaries.md)
- [Counterfactual context debugging inherits its rerunner](./2026-10-15-agentfootprint-context-evidence-claim-tiers.md#2026-10-16-implementation-recheck)
