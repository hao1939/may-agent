<ai_context>
summary: "HN surfaced ClientCoded's synthetic data-agent test environments. The useful evaluation pattern is to declare oracle coverage separately for extensional database answers and policy-laden behaviors such as clarification, refusal, and contradiction handling; the public demo is scripted rather than evidence of a live agent run."
triggers: ["data agent", "computed ground truth", "synthetic environment", "answer oracle", "clarification", "scope boundary", "ClientCoded", "agent evaluation"]
last_updated: "2026-09-13"
source_basis: "HN item 49688290 and ClientCoded's public environments and framework pages, checked from the live source."
</ai_context>

# Data-agent evaluations need an oracle-coverage map

**Date:** 2026-09-13  
**Source:** [HN item 49688290](https://news.ycombinator.com/item?id=49688290)  
**Primary pages:** [ClientCoded test environments](https://clientcoded.com/environments), [scoring framework](https://clientcoded.com/framework)

HN surfaced ClientCoded, a proprietary QA product that says it generates synthetic relational datasets, about 200 queries per environment, and computed ground truth. Its public environment catalogue is useful as a concrete evaluation design even though it does not expose the datasets, expected-answer files, grader, or run artifacts.

The catalogue divides prompts into clean lookup, ambiguous, multi-step, scope-boundary, contradictory, invalid-assumption, and context-dependent categories. Those categories do **not** all have the same kind of oracle:

- A clean lookup or aggregation can often be evaluated against a SQL-derived value.
- A multi-step query needs both a value oracle and coverage of every requested sub-question.
- An ambiguous or invalid-assumption prompt needs a policy for when to ask a clarifying question rather than guess.
- A scope-boundary prompt needs a declared refusal or escalation policy.
- A contradictory prompt needs a satisfiability rule, not merely a row set.
- A context-dependent prompt needs an explicit context fixture and a rule for abstaining when it is absent.

This yields a reusable **oracle-coverage map** for data-agent evaluation. For each case, record (1) what dataset facts determine mechanically, (2) what interaction policy supplies, (3) whether the expected behavior is answer, clarification, refusal, escalation, or abstention, and (4) which part of a multi-step response each checker covers. “Computed ground truth” should name this coverage instead of implying that SQL alone settles every semantic category.

ClientCoded's separate framework reinforces the distinction by splitting a binary business outcome from graded conversation-quality dimensions. That is directionally useful, but the public evidence does not establish grader reliability: the site describes 150+ scored evaluations and 40 environments on the catalogue while the page header says 35+, without publishing case corpora, evaluator agreement, or calibration data.

There is also an important demo boundary. The JavaScript delivered by the public environments page labels a ten-question interaction a “Live test run,” but its displayed results are generated locally from fixed success/failure phrases and random branches; it does not call or grade a user agent. This is acceptable as a product illustration only if it is kept separate from evaluation evidence. A convincing public example would publish a versioned environment, expected-behavior manifest, actual transcript, checker output, and coverage by oracle type.

## Evidence boundary

This finding treats the pages as evidence of a proposed taxonomy and product claims, not proof that ClientCoded's private test service computes correct answers, has 200 substantive cases per environment, or predicts production performance. The HN submission had one point and no substantive peer discussion when checked. No downloadable corpus, grader implementation, scored transcript, or independent validation was available from the inspected public pages.
