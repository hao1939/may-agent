<ai_context>
summary: "Backendskills reports that three backend-focused instruction packs reduced critical failures from 25/150 to 2/150 completed Haiku/Sonnet runs, but 20 of the 25 baseline failures came from only login rate limiting and rolling column renames, 10 of 15 tasks had no critical failure in either arm, custom team conventions were added to the evaluated skills, and 21 Sonnet with-skills runs were excluded after usage-limit errors. Skill evaluation should preserve task-level outcomes, customization state, cost, and excluded-run receipts rather than promote only an aggregate rate."
triggers: ["agent skill evaluation", "coding agent skills", "backend safety", "task-stratified benchmark", "backendskills", "instruction evaluation"]
last_updated: "2026-11-14"
source_basis: "HN item 50493538 plus globalmpc/backendskills README, benchmark summarizer, recursive source tree, and producer-published runs.jsonl at commit 5a1779fb3ba7e2ba0f98a9db105851fb7842eea3. Scout reran the repository's summarizer over the published JSONL but did not run the agents, hidden checks, tasks, or application."
</ai_context>

# Agent skills need task-stratified evaluation

**Date:** 2026-11-14  
**HN:** [item 50493538](https://news.ycombinator.com/item?id=50493538)  
**Repo:** [globalmpc/backendskills](https://github.com/globalmpc/backendskills)  
**Reviewed revision:** [`5a1779fb3ba7e2ba0f98a9db105851fb7842eea3`](https://github.com/globalmpc/backendskills/commit/5a1779fb3ba7e2ba0f98a9db105851fb7842eea3)  
**Coverage:** Complete repository README, benchmark summarizer, recursive tree, and published `runs.jsonl`; selected task-check paths were identified but not exhaustively audited. The HN submission had no comments when inspected.  
**Disposition:** New knowledge

## Question

What does this producer-published benchmark establish about repository skills for backend coding agents, and which receipts are needed before its aggregate result can guide adoption?

## What the source reports

Backendskills packages three instruction sets for API endpoints, data integrity, and database migrations. They tell coding agents to apply practices such as caller-scoped queries, login rate limits, conditional writes or locks, idempotency keys, expand-contract migrations, concurrent indexes, lock timeouts, and batched backfills.

The repository evaluates the skills on 15 backend tasks. Each task has a hidden check that the agent does not see. For Claude Haiku 5.5 and Sonnet 5.5, five completed runs per task and condition produce 150 runs without and 150 with the skills. The README reports:

- critical-mistake runs fell from **25/150 without the skills to 2/150 with them**;
- Haiku changed from **12/75 to 2/75**, while Sonnet changed from **13/75 to 0/75**;
- team-convention misses changed from **30 to 4**, but the with-skills arm included a benchmark overlay that filled each skill's otherwise-unset “Make it yours” section;
- mean cost rose from about **$0.06 to $0.11 per run**, and mean turns rose from **14 to 23** across the two named models;
- 25 agent-error runs were excluded, including **21 Sonnet with-skills runs** stopped by a usage limit and four partial Opus runs.

Scout reran the pinned `bench/summarize.mjs` over the published 346-line `runs.jsonl`. It reproduced the task table and the README's Haiku/Sonnet critical-failure counts. The summarizer defines a critical mistake as any failed run whose failed checks are not solely prefixed `convention:`; agent-error runs are removed from the comparison.

## Why the task-level table matters

The aggregate improvement is real within the producer's published classification, but it is highly concentrated:

- login rate limiting accounts for **10 of the 25** critical baseline failures and falls to zero;
- rolling column rename accounts for another **10 of 25** and falls to zero;
- **10 of the 15 tasks** have zero critical failures in both conditions for both evaluated models;
- the two remaining with-skills critical failures are both Haiku payment-webhook runs, where that task changes from **1/5 without to 2/5 with**.

This means the benchmark supports a narrower claim than “skills make backend coding safe.” It shows strong measured benefit on particular hazards that the skills explicitly teach, under this task set and checker policy. It provides little discrimination on the ten tasks with floor-level critical-failure counts, and it retains at least one adverse task-model cell.

## Scout interpretation

A reusable skill should be evaluated as a versioned intervention, not as prose that is presumed beneficial. The minimum promotion record should retain:

1. **Skill bytes and customization state:** distinguish the distributable default from repository-specific overlays.
2. **Task-level paired outcomes:** preserve regressions and zero-information cells instead of reporting only an aggregate rate.
3. **Checker semantics:** record which failures count as critical, convention-only, inconclusive, or infrastructure error.
4. **Excluded-run accounting:** keep model, arm, task, and reason for every omitted run; asymmetric exclusions can change the effective comparison.
5. **Cost and interaction overhead:** quality gains can require more turns and spend.
6. **Held-out or external transfer:** tasks authored around the same guidance test instruction uptake, but not whether the skill generalizes to different repositories, stacks, or failure distributions.

The useful pattern is therefore “skill plus task-stratified evidence and explicit limits,” not “install a skill because its aggregate benchmark improved.”

## Evidence limits

The repository author supplies the skills, tasks, hidden checks, classifications, raw run records, and summary. Scout reproduced the published summary from the pinned JSONL but did not independently run Claude Code, the 300 completed Haiku/Sonnet trials, the task applications, or the hidden checks. The benchmark uses one application setting, 15 authored tasks, two fully represented model versions, five completed repetitions per task and arm, and one Claude Code version.

The task suite is aligned with the skills' stated content, so it measures whether those instructions improve selected targeted behaviors more directly than broad external transfer. The evaluated with-skills arm includes custom convention text that the shipped skills leave unset. Usage-limit exclusions are disclosed, but 21 of them occur in the Sonnet with-skills arm, including 20 rename-column attempts. No confidence intervals, preregistration, independent replication, contamination analysis, or evaluation against unseen repositories were inspected. HN supplied discovery only: the item had two points and no comments when read.
