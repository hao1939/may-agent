<ai_context>
summary: "A same-model comparison of four agent harnesses found that two explicitly requested medium reasoning while two inherited an xhigh server default, forcing the report to split comparisons by effective effort. The reusable evaluation rule is to capture the request after harness and gateway transformation, not treat model identity alone as the experimental control."
triggers: ["harness-vs-harness", "agent harness benchmark", "same-model comparison", "reasoning effort", "effective request", "server defaults", "agent evaluation confound"]
last_updated: "2026-11-10"
source_basis: "Static inspection of hrishim/harness-vs-harness at commit 5ccc999113b143ab102b65cb7e6244ed574c883c: generated report, setup, exact task prompts, run table, and 180-row result CSV. Scout did not run the harnesses or receive the task input fixtures, grader implementation, raw trajectories, proxy logs, or discarded-run artifacts."
</ai_context>

# Harness Benchmarks Need Effective-Request Capture

Date: 2026-11-10  
Source: GitHub  
Repo: https://github.com/hrishim/harness-vs-harness  
Inspected revision: https://github.com/hrishim/harness-vs-harness/commit/5ccc999113b143ab102b65cb7e6244ed574c883c

## Question

What does a new same-model agent-harness comparison establish, and what must an
agent evaluation record to make “the model was held fixed” a valid control?

## Source observation

The producer ran four public agent harnesses on 15 synthetic laptop tasks, three
rounds per task. The tasks cover document extraction, accounting-file edits,
calendar and inbox work, file organization, coding, shell scripting, document
question answering, log diagnosis, and PDF form filling. Runs used fresh Docker
containers, one-shot prompts, a 45-minute limit, isolated task files, and a
recording proxy. The report says scoring was rule-based rather than performed by
an AI judge.

The repository publishes the exact prompts, environment and version
descriptions, generated result pages, and a 180-row `results.csv`. Its report
shows high but non-identical outcomes within each comparable pair:

- At **medium** reasoning effort, Hermes is reported at 99% average with 36 of
  41 graphed runs fully correct, while Pi is reported at 97% with 37 of 45 fully
  correct.
- At **xhigh** reasoning effort, DeepSeek Harness is reported at 99% with 38 of
  45 fully correct, while OpenCode is reported at 98% with 40 of 45 fully
  correct.

Those headline pairs cannot be combined into one four-way harness ranking. The
captured requests showed that Pi and Hermes explicitly sent
`reasoning_effort: "medium"`; OpenCode and DeepSeek Harness sent no effort field,
so the serving stack supplied its `xhigh` default. The report says xhigh produced
35% to 90% more reasoning per turn and therefore splits all comparisons by
effective effort.

The run lifecycle also affected the evaluated set. The report says 31 initial
runs were set aside and repeated because of setup or execution faults, including
23 OpenCode runs whose first setup blocked access outside the task folder. Four
Hermes runs remain in the downloadable table but are omitted from graphs because
of timeouts or post-work waiting failures. The project distinguishes these from
model-answer failures, but the available repository does not include the raw
artifacts needed to independently audit every exclusion and rerun decision.

## Finding

**Model identity is not a sufficient control for an agent-harness benchmark.**
The experimental treatment is the effective request and runtime contract after
all harness, adapter, gateway, and server transformations.

At minimum, a comparison receipt should preserve:

1. the request emitted by the harness, including omitted fields;
2. gateway rewrites, removals, and injected defaults;
3. the server-resolved sampling, reasoning-effort, output-limit, context, and
   tool-parser settings;
4. harness version, permissions, compression thresholds, and tool surface;
5. the task image and input-fixture identity;
6. per-run termination and inclusion status, with a reason and immutable link
   to any replaced run; and
7. separate quality, fully-correct-run, token, latency, tool-error, timeout, and
   infrastructure-failure measures.

This source makes the first three requirements unusually visible: one front end
removed `max_tokens`, the model server supplied defaults when harnesses omitted
settings, and the resulting effort difference was large enough to invalidate a
single pooled ranking. A benchmark that records only model name, prompt, and
harness label can silently attribute server-default behavior to the harness.

The source also supports keeping partial score and reliable-completion frequency
separate. Its report warns that a 99% score can still describe unusable
accounting or form output, while a fully correct count loses information about
narrow misses. Agent evaluations should retain both rather than collapsing them
into one leaderboard value.

## Relevance to May

For May workflows, executor comparisons, model changes, or release evaluations,
store a resolved inference receipt at the model boundary rather than relying on
planner configuration as proof of what ran. A useful receipt would join the
requested settings, post-adapter request, server-resolved defaults, tool and
permission contract, run disposition, and accepted output evidence. This would
make it possible to distinguish a harness change from a gateway-default change
and to keep retries caused by infrastructure separate from ordinary task
outcomes.

## Evidence limitations

- This is a producer-authored repository created on the observation day, with
  zero stars and zero forks when inspected; there is no independent replication
  or adoption evidence.
- Scout inspected static published artifacts and recomputed only simple CSV
  counts, not the benchmark runs or scores.
- The repository does not publish the synthetic input files, grader source,
  hidden checks, raw model requests and responses, task workspaces, recording
  proxy logs, or all discarded-run artifacts. Exact score reproduction and
  exclusion auditing are therefore unavailable from this revision.
- The four harnesses were not all run at the same effective reasoning effort,
  so the evidence supports two within-effort comparisons, not a four-way causal
  ranking or a general claim that one harness is best.
- Harnesses also differ in permissions, compression behavior, versions, and
  implementation. Even within an effort stratum, the result estimates the full
  configured harness package, not an isolated component.
- Fifteen synthetic tasks with three retained rounds each do not establish
  production reliability, security, long-running recovery, or performance on
  other models and serving stacks.

Disposition: **new knowledge** — the repository provides a concrete,
source-grounded example of server-resolved defaults breaking an apparent
same-model control, while its missing replay bundle limits stronger performance
claims.

## Primary sources

- Discovery query: https://api.github.com/search/repositories?q=%22AI%20agent%22%20created%3A2026-11-10&sort=updated&order=desc&per_page=50
- Repository: https://github.com/hrishim/harness-vs-harness
- Inspected revision: https://github.com/hrishim/harness-vs-harness/commit/5ccc999113b143ab102b65cb7e6244ed574c883c
- Setup and effective request description: https://github.com/hrishim/harness-vs-harness/blob/5ccc999113b143ab102b65cb7e6244ed574c883c/setup.html
- Exact task prompts: https://github.com/hrishim/harness-vs-harness/blob/5ccc999113b143ab102b65cb7e6244ed574c883c/tests.html
- Run inclusion and rerun table: https://github.com/hrishim/harness-vs-harness/blob/5ccc999113b143ab102b65cb7e6244ed574c883c/data.html
- Published result data: https://github.com/hrishim/harness-vs-harness/blob/5ccc999113b143ab102b65cb7e6244ed574c883c/data/results.csv
