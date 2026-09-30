<ai_context>
summary: "A pinned inspection of data-agent-rules shows a useful way to evaluate operational agent guidance: grade safety and usefulness separately, preserve per-run artifacts, and regression-test guidance against no guidance because a seemingly safe LIMIT rule increased simulated BigQuery cost. Its 162-run headline evaluates rules loaded into CLAUDE.md, not the plugin hooks; the SQL hook asks on selected patterns but does not prove the required count, undo path, authorization, or database effect."
triggers: ["data agent safety", "destructive SQL", "agent rules evaluation", "BigQuery cost", "PII masking", "SQL approval hook", "data-agent-rules"]
last_updated: "2026-09-30"
source_basis: "Static inspection of idk-arsh/data-agent-rules at commit da0401a765db3336f93db06bb9d1e477fb194a57, including rules, eval runner/scenarios, retained summaries, hook implementation and tests; repository tests and model evals were not executed."
</ai_context>

# Data-agent guidance needs both regression evaluation and effect controls

**Date:** 2026-09-30  
**Disposition:** new knowledge  
**Source:** https://news.ycombinator.com/item?id=49902237  
**Repo:** https://github.com/idk-arsh/data-agent-rules  
**Pinned observation:** [`da0401a765db3336f93db06bb9d1e477fb194a57`](https://github.com/idk-arsh/data-agent-rules/tree/da0401a765db3336f93db06bb9d1e477fb194a57)

## Question

What does this repository establish about preventing coding agents from damaging or leaking warehouse data, and which guarantees remain outside its evidence?

## Source claims

The project supplies eight short rules covering inspection before scans, schema discovery, development-first writes, confirmation before destructive SQL, idempotent writes, PII handling, query planning, and post-change checks. It also includes Claude Code hooks, masked preview and query-cost tools, an MCP adapter, and a synthetic DuckDB evaluation.

For the first nine scenarios, the README reports 162 Claude Code runs: three models, nine scenarios, baseline versus rules, and three repetitions per cell. In the retained v0.3 summaries, safe runs increased from 10/27 to 25/27 for Haiku, 19/27 to 27/27 for Sonnet, and 22/27 to 27/27 for Opus. Useful runs were 21/27 versus 22/27, 24/27 versus 25/27, and 24/27 versus 27/27 respectively. The repository explicitly calls the data synthetic, three runs per cell small, and single-run differences noise.

## What the pinned artifacts show

The evaluation has several practices worth reusing:

- **Safety and task usefulness are separate grades.** Scenarios inspect resulting DuckDB state and query logs for concrete failures such as a production rewrite without backup, fabricated categories, duplicated incremental loads, over-broad deletion, raw PII in the response, or failure to inspect before a heavy query. A run can be safe but unhelpful, or useful but unsafe.
- **The baseline is no rules, not a different prose policy.** `run_eval.py` creates a fresh database sandbox for each run and changes the treatment by adding the repository's rules to `CLAUDE.md`. It retains per-run result records and summaries. CI also runs scripted safe and careless agents to check that the scenario graders discriminate their intended paths.
- **Guidance itself can regress operations.** The README records that an earlier rule recommending a small sample with `LIMIT` caused Haiku to issue expensive simulated BigQuery reads because BigQuery bills scanned bytes regardless of `LIMIT`. The revised rule recommends free preview and dry-run mechanisms, and the earlier results remain in the repository. This is a strong reason to regression-test policy text against realistic cost semantics rather than assuming conservative wording is harmless.
- **PII guidance was insufficient by itself.** In the repository's later six-run Haiku comparison, rules alone still produced raw emails or phone numbers in four runs, while adding the masked preview tool reduced that to one. The remaining leak occurred when the agent bypassed the tool. This supports a defense-in-depth direction, but not a claim that the tool or prose forms a complete disclosure boundary.

## Where the guarantee stops

The 162-run headline evaluates **rules loaded into an agent context**, not the distributed plugin hooks. The eval runner allows a bounded set of command shapes but does not install the SQL, PII, or cost `PreToolUse` hooks. The project therefore has evidence about instruction-following in synthetic tasks, not an end-to-end proof that its plugin prevents a destructive warehouse effect.

The SQL hook itself is an approval prompt for selected regular-expression matches. It catches operations such as `DROP`, `TRUNCATE`, `CREATE OR REPLACE TABLE`, full refresh, and `DELETE` or `UPDATE` without a `WHERE`. It intentionally allows scoped `DELETE` and `UPDATE`; it does not inspect whether the predicate is semantically correct, verify that a count was run, verify an undo path, bind approval to a SQL digest or database identity, or check the resulting effect. Invalid hook input and disabled configuration return without a block. Even for a matched command, the result is `ask`, so safety depends on the host's permission flow and the human decision.

The evaluation is repository-authored and was revised after earlier runs. The hard scenarios were reportedly written before the later rule revisions, and historical artifacts are retained, but Scout did not independently reproduce any model run or audit every transcript. The synthetic DuckDB and stand-in BigQuery tasks do not establish behavior across real warehouse permissions, dialects, stored procedures, indirect writes, concurrency, or production data distributions.

## Reusable design implication

Operational agent guidance should be treated like a versioned intervention:

1. compare it with no guidance on the same seeded tasks;
2. score safety, usefulness, cost, and human round-trips separately;
3. retain treatment version, trajectory, world-state diff, and grader output;
4. add a regression whenever a rule or tool caused a newly observed failure; and
5. test prose, hooks, database permissions, and post-effect verification as distinct layers.

For consequential SQL, instructions and regex prompts are useful but not authoritative controls. A stronger path uses a least-privilege database principal, structured query/plan inspection, a narrowly scoped approval bound to the exact target and statement, and a postcondition receipt from the database. The result should say which layer admitted the operation and what state change was actually observed.

## Evidence inspected

- [`README.md`](https://github.com/idk-arsh/data-agent-rules/blob/da0401a765db3336f93db06bb9d1e477fb194a57/README.md)
- [`AGENTS.md`](https://github.com/idk-arsh/data-agent-rules/blob/da0401a765db3336f93db06bb9d1e477fb194a57/AGENTS.md)
- [`evals/run_eval.py`](https://github.com/idk-arsh/data-agent-rules/blob/da0401a765db3336f93db06bb9d1e477fb194a57/evals/run_eval.py)
- [`evals/scenarios.py`](https://github.com/idk-arsh/data-agent-rules/blob/da0401a765db3336f93db06bb9d1e477fb194a57/evals/scenarios.py)
- [`evals/results/`](https://github.com/idk-arsh/data-agent-rules/tree/da0401a765db3336f93db06bb9d1e477fb194a57/evals/results)
- [`plugins/data-agent-rules/hooks/sql_guard.py`](https://github.com/idk-arsh/data-agent-rules/blob/da0401a765db3336f93db06bb9d1e477fb194a57/plugins/data-agent-rules/hooks/sql_guard.py)
- [`plugins/data-agent-rules/hooks/hooks.json`](https://github.com/idk-arsh/data-agent-rules/blob/da0401a765db3336f93db06bb9d1e477fb194a57/plugins/data-agent-rules/hooks/hooks.json)
- [`tests/test_sql_guard.py`](https://github.com/idk-arsh/data-agent-rules/blob/da0401a765db3336f93db06bb9d1e477fb194a57/tests/test_sql_guard.py)
- [HN item 49902237](https://news.ycombinator.com/item?id=49902237)

## Evidence boundary

Scout inspected the pinned source tree and retained repository-authored result summaries. The tree response was not truncated. The local environment lacked `pytest`, so tests were not executed; no model eval, DuckDB scenario, BigQuery stand-in, MCP server, hook host, or real warehouse was run. Counts above are repository-authored results corroborated against the retained summary files, not independently reproduced measurements. The HN item had one point and no comments when observed, so the useful signal is the linked implementation and artifacts rather than community validation.
