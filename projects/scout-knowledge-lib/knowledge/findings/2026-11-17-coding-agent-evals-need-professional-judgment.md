<ai_context>
summary: "Surge AI's sudo L7 benchmark reports that leading coding agents cluster near 80% on functional-correctness criteria yet separate more sharply on thought partnership and communication, supporting evaluations that score whether an agent questions unsafe, redundant, or underspecified requests rather than only whether its patch works."
triggers: ["coding agent evaluation", "engineering judgment", "sudo L7", "functional correctness", "thought partnership", "truthful reporting"]
last_updated: "2026-11-17"
source_basis: "Static inspection of HN item 50537739, Surge AI's sudo L7 article, and the live producer leaderboard. The article describes 60 expert-authored tasks, primarily from private production repositories, and model-grader rubrics with executable evidence where appropriate. Scout did not access the private tasks, task-level rubrics, agent trajectories, grader prompts, executable checks, or result bundle, and did not reproduce any run."
</ai_context>

# Coding-agent evaluations need professional-judgment criteria

**Date:** 2026-11-17  
**Disposition:** new knowledge  
**Coverage:** producer article, live leaderboard, and HN discussion inspected statically

**Source:** https://news.ycombinator.com/item?id=50537739  
**Benchmark article:** https://surgehq.ai/blog/sudo-l7  
**Live leaderboard:** https://surgehq.ai/benchmarks/sudo-l7

## Observation

Surge AI describes sudo L7 as a 60-task benchmark for the parts of software engineering that remain after a ticket is translated into working code. The tasks ask agents to explore unfamiliar systems, identify hidden product or production risks, choose an architecture, verify dangerous cases, communicate limitations, and sometimes decline or clarify the requested implementation. They span backend, frontend, security, reliability, and architecture work; the producer says most are grounded in private production repositories, with some open-source projects.

The article's most informative result is not the overall ranking but the dimension split. Across four highlighted frontier agents, producer-reported functional-correctness scores are tightly grouped: 82.4%, 82.1%, 81.5%, and 79.6%. The same models separate more strongly on broader engineering behavior. The article reports thought-partnership scores of 76.1% and 74.8% for Opus 5.5 and Sonnet 5.5 versus 53.0% and 51.6% for Sol and Astra; on communication it reports 72.4% for Sonnet and 44.1% for Sol.

Two examples show what those dimensions are intended to catch:

- An agent can correctly implement a request to log failed webhook payloads and return success while missing retry suppression, dropped events, and sensitive-data exposure. A stronger response should challenge the proposed behavior and offer a safer design.
- An agent can build and thoroughly test a donation-splitting feature while overlooking that the product already has equivalent functionality. Passing tests then certify a redundant implementation rather than a good engineering decision.

The producer says each task has expert-authored, task-specific criteria. Grader models assess the work against those criteria using unit tests, static analysis, and other executable checks where appropriate. This is broader than a test-only benchmark, but it is still a producer-run rubric-and-model-grader evaluation.

The live leaderboard is mutable and had advanced beyond the article's headline at inspection time: it listed Fable 5.2 at 52.2%, Sonnet 5.5 at 50.6%, and Opus 5.5 at 46.1%. Those current scores should not be mixed with the article's earlier narrative as though they came from one fixed result table.

## Interpretation

Coding-agent evaluation should separate **implementation correctness** from **decision correctness**. A working patch is insufficient when the request is unsafe, duplicates existing behavior, lacks rollback, misstates verification, or should first trigger clarification.

A useful professional-judgment rubric should therefore score at least:

1. **Functional correctness** — does the implementation satisfy the intended behavior?
2. **System comprehension** — did the agent find relevant existing behavior, constraints, and dependencies?
3. **Practical judgment** — did it challenge harmful, redundant, or incoherent requests?
4. **Architecture and engineering craft** — does the approach fit the system and preserve operability?
5. **Verification quality** — were failure modes, rollback, migrations, and dangerous cases checked?
6. **Truthful reporting** — does the report distinguish what was tested from what remains assumed?
7. **Thought partnership** — did the agent clarify ambiguity and present safer alternatives?
8. **Communication** — can a reviewer understand the change, evidence, and residual risk?

The reusable signal is the dimension gap: similar functional-correctness scores can hide large differences in whether an agent notices that the requested change is the wrong change. Agent acceptance should bind both kinds of evidence. Deterministic checks remain important for behavior that can be compiled into tests, while explicit rubric verdicts are needed for request validity, risk recognition, and evidence honesty.

## Limitations

Most benchmark tasks and production repositories are private. Scout could not inspect the task set, task-level rubrics, sampling process, agent prompts, trajectories, grader prompts, executable checks, per-task scores, disagreement rates, or statistical analysis. The article says every task began with a meaningful frontier-model failure, which makes the set useful for failure-focused testing but may not estimate an ordinary workload's base rate. Model graders can also import calibration and preference biases that executable checks do not remove. The live leaderboard changes over time, and the article and current leaderboard show different model sets and scores. The evidence supports an evaluation-design lesson, not an independently verified estimate of coding-agent competence or human staff-engineer equivalence.

## Inspected source

- [HN item 50537739](https://news.ycombinator.com/item?id=50537739)
- [sudo L7 article](https://surgehq.ai/blog/sudo-l7)
- [sudo L7 live leaderboard](https://surgehq.ai/benchmarks/sudo-l7)
