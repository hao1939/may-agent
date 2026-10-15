<ai_context>
summary: "A pinned coding-agent companion repository separates two assurance questions: 26 deterministic, model-free failure drills test whether guards reject seeded mistakes, while a 270-run author experiment tests whether rules and gates change agent outcomes. The source-owned reproduction script reports mixed, small-sample results, so drill success should be tracked separately from accepted-task quality and residual defects."
triggers: ["coding agent guard", "failure drill", "harness evaluation", "seeded defect", "false done", "destructive command", "book-companion"]
last_updated: "2026-10-15"
source_basis: "HN item 50101157 and book-companion commit 5990efe337e7ea31c55b3840dc211ba19731fb35 inspected 2026-10-15; Scout reviewed the README, drill inventory, selected drill specifications, experiment protocol, methodology, result records, and source-owned reproduction script, then ran that script over the published records. The drills, guards, agent runs, and hidden acceptance tests were not independently executed."
</ai_context>

# Rehearse guard failures separately from measuring agent outcomes

**Date:** 2026-10-15  
**HN:** [item 50101157](https://news.ycombinator.com/item?id=50101157)  
**Repo:** [second-time-is-a-bug-book/book-companion](https://github.com/second-time-is-a-bug-book/book-companion)  
**Reviewed revision:** [`5990efe337e7ea31c55b3840dc211ba19731fb35`](https://github.com/second-time-is-a-bug-book/book-companion/tree/5990efe337e7ea31c55b3840dc211ba19731fb35)  
**Coverage:** complete repository README; complete drill inventory; selected specifications for false-done, destructive-command, and guard-retirement drills; complete experiment protocol, results overview, methodology, published JSONL records, and reproduction script. Scout ran the source-owned reproduction script over those records, but did not run the guards, drills, agents, or hidden acceptance tests.

## Question

How can a coding-agent harness prove both that its guards still catch known failure modes and that those guards improve real agent outcomes?

## Finding

The repository usefully treats these as two different tests.

Its **26 failure drills are deterministic guard-contract tests**. Each drill creates a scratch copy, establishes a passing baseline, injects one named mistake or tool call, expects the corresponding guard to reject it, prints both outcomes, and removes the scratch copy. Examples include stale test evidence after a code change, deleting or skipping tests, hollow assertions, destructive commands, irreversible migrations, dependency drift, an unbounded loop, and a merge gate. The drills need no model, API key, or network. One further audit uses synthetic guard logs to flag guards that no longer fire, turning retirement criteria into a testable maintenance question.

That design makes a drill good evidence for a narrow statement: **this guard recognizes this fixture and fails with the expected status and diagnostic**. It does not show how often an agent causes the failure, whether the guard can be bypassed, whether the fixture represents production mistakes, or whether the overall harness improves accepted changes.

The repository therefore supplies a separate **agent-outcome experiment**. It compares no harness, rules only, and full gates on seven tasks with hidden acceptance tests. Conditions are interleaved; runs start from the same revision; failures can receive up to three rework rounds; the protocol logs acceptance, first-pass success, rework, tokens, estimated cost, and time. Batch 2 also restores the release's own guards before a defect sweep so an agent cannot hide defects by weakening the checks being used to score it.

Scout ran the pinned `reproduce.ts` over the published records. It reports 270 author-run Claude Code sessions, all ultimately accepted and 267 accepted on the first pass. The residual-defect rows are mixed rather than a simple “gates win” result:

- for Sonnet on the four harder tasks, defects at done were 5/20 with no harness, 4/20 with rules, and 1/20 with gates;
- for Opus they were 5/20, 5/20, and 3/20;
- for Haiku they were 5/20 in every condition;
- none of the preregistered two-sided Fisher tests comparing gates with no harness was significant at conventional thresholds.

The records also expose outcome trade-offs that a single pass rate would hide. On one migration task, 14 of 15 no-harness runs omitted a migration test, versus 0 of 15 with rules or gates. On another task, however, a pre-existing test was left failing in 0 of 15 no-harness runs, 14 of 15 rules runs, and 9 of 15 gates runs; the methodology says many rule-conditioned runs stopped and asked a person rather than violating an explicit constraint, and the defect metric still counts that as a defect at done.

## Scout interpretation

A guard suite should expose at least two independent scorecards:

1. **Enforcement health:** for each known failure fixture, did the guard allow the safe baseline, reject the seeded violation, emit an actionable diagnostic, and leave the real workspace unchanged?
2. **Work outcome:** on held-out tasks, did the current agent-plus-harness produce accepted changes with fewer residual defects, less rework, bounded cost, and no increase in unresolved handoffs or collateral edits?

This split prevents a common category error. A green drill suite proves that enforcement paths are wired for known fixtures; it does not prove that agents finish real work better. Conversely, a small task study can miss a broken or never-exercised guard. Failure drills are especially useful after hook adapters, command schemas, evidence formats, or guard implementations change, while held-out agent tasks should remain the release-level test of net value.

The experiment also suggests grading **abstention and escalation separately from defective completion**. Counting “stopped for a person” as a defect is conservative for delivery, but it cannot tell whether a rule prevented an unsafe edit at the cost of throughput. A practical harness evaluation should retain terminal categories such as accepted, rejected by guard, escalated with a precise blocker, falsely reported complete, and timed out, then measure both safety and delivery.

## Evidence limits

This is an author-controlled companion repository and experiment. The same author created the tasks, hidden tests, harness, and defect sweep; only seven tasks on one small TypeScript application, one agent product, three models from one vendor, and five repetitions per cell were used. Costs are tool estimates, review time was not measured, and the records omit transcripts, diffs, reference solutions, hidden tests, and the tool-specific runner. Scout verified that the published reproduction script emits the quoted aggregates from the published JSONL, not that those records faithfully reconstruct the original runs. Scout also did not execute the drills or inspect every guard implementation. The HN snapshot had one point and no comments, so it adds discovery but no independent validation.

## Disposition

**New knowledge.** No existing library file declares this HN item or repository. The closest notes discuss layered verification and deterministic evidence generally, but not the operational separation between model-free guard failure drills, guard-retirement fixtures, and held-out agent-outcome evaluation represented by this source.
