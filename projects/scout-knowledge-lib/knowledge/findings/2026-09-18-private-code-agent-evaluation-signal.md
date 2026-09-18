---
summary: "An AI-generated XHS recap of a StackDebrief video claims that 530+ coding-agent runs on private production repositories scored far below public-benchmark expectations and failed mainly through requirement, integration, and assumption errors. The useful signal is methodological, not numerical: private-code evaluations should report provenance, integration breadth, and trajectory-length strata before their results are treated as evidence of real-world capability."
triggers: ["Real-SWE", "private production code", "coding agent evaluation", "benchmark contamination", "integration errors", "tool-call drift", "StackDebrief"]
last_updated: "2026-09-18"
source_basis: "Full text of XHS note 6aac8d62000000002502f721, explicitly labelled as AI-generated and presenting a recap of an external StackDebrief YouTube video; the video, benchmark artifacts, and underlying run records were not inspected."
---

# Private-Code Agent Evaluation Needs Provenance and Complexity Strata

<ai_context>
Treat this as a discovery lead from a secondary, AI-generated XHS recap—not as verified benchmark evidence. Its reusable contribution is an evaluation checklist: establish that tasks and runs exist, bind claims to model and harness versions, and stratify outcomes by integration breadth and trajectory length. Recheck every number against the original video and benchmark artifacts before reuse.
</ai_context>

**Observed:** 2026-09-18  
**Disposition:** New source-grounded discovery lead  
**Coverage:** Full XHS text post. The nine attached images, linked YouTube video, Real-SWE artifacts, and underlying 530+ runs were not inspected.

## Source

- **XHS body:** [【AI智能体企业落地】530次真实生产代码审计](https://www.xiaohongshu.com/explore/6aac8d62000000002502f721) — 探索AI与Peace, note ID `6aac8d62000000002502f721`
- **External source cited by the post, not reviewed here:** [“We Audited 530+ AI Agent Rollouts on Real Production Code”](https://www.youtube.com/watch?v=uWTRXyfUo4Y) — attributed by the post to StackDebrief

## What the XHS post claims

The post says “Real-SWE” evaluated more than 530 frontier-model and agent-CLI runs on private enterprise production repositories. It reports a 38.8% top pass rate and attributes failures to three broad categories: missed requirements, integration errors, and unverified assumptions. It further claims that tasks whose reference solution crossed services and changed a median of 11 files were especially difficult; failure did not decline for runs longer than ten minutes; and trajectories beyond 40 tool calls showed attention drift.

Those figures are **claims in an AI-generated recap**. The post does not expose a paper, dataset, repository, task list, scoring rubric, model/harness configuration, run-level records, or uncertainty estimates. It also asserts that public repositories were present in pretraining and that agents were recalling pull requests rather than reasoning, but provides no contamination test in the inspected text.

## Reusable evaluation signal

Even without accepting the numbers, the post points to a useful evaluation design gap. A private repository prevents direct public lookup only if task provenance, model access, and grader isolation are documented; “private” alone is not a contamination receipt. Likewise, wall-clock duration is not an explanatory variable by itself: long runs may simply identify harder, broader tasks.

A production-code agent report should therefore bind each score to:

`task provenance + repository visibility + model/harness version + grader + files/services touched + tool-call count + elapsed time + failure taxonomy`

Results should be stratified by integration breadth and trajectory length rather than comparing short and long runs as if time were randomly assigned. Requirement omissions, integration failures, and unsupported assumptions should be recorded separately from test failures, because each suggests a different intervention: coverage tracking, cross-service validation, or explicit hypothesis checks.

## Limitations and follow-up

- The XHS author says the content was generated and uploaded by “羊马仕”; transcription or synthesis errors are possible.
- The original video and benchmark materials were not reviewed, so none of the model names, percentages, cost claims, or benchmark-first claims are independently established here.
- Before citing results, locate the benchmark owner and immutable artifact set, verify that “Real-SWE” is the project’s actual name, recover the 530+ run denominator, and inspect task sampling, grading, contamination controls, and failure-label methodology.
- Compare difficulty-matched runs when testing whether extra time or more tool calls help; the post’s aggregate split cannot establish causality.

## Related Scout knowledge

- [Harness Lift Needs a Comparability Receipt and an Audit-Coverage Receipt](./2026-09-15-harnessmark-lift-and-audit-coverage.md) — version binding and transcript coverage for coding-agent benchmarks.
- [PAIChecker: Multi-Agent Detection of PR-Issue Misalignment in SWE-Bench](./2026-07-31-arxiv-paichecker-swe-bench-misalignment.md) — task-quality controls before interpreting coding-agent scores.
