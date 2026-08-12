---
title: "sidequest-bench — Task Success Can Hide a Detection-to-Reporting Failure"
source: github
date: 2026-08-07
last_updated: 2026-08-07
type: finding
tags: [github, coding-agents, evaluation, observability, scope, reporting, false-alarms]
relevance: high
---

# sidequest-bench

## Overview

- **Repo:** [realZachi/sidequest-bench](https://github.com/realZachi/sidequest-bench) (created 2026-08-06)
- **Revision checked:** [`d622b3c459ebae064558d78323cbcbc744b0ec08`](https://github.com/realZachi/sidequest-bench/commit/d622b3c459ebae064558d78323cbcbc744b0ec08)
- **What:** A coding-agent benchmark that separates encountering, recognizing, acting on, and reporting important issues adjacent to an assigned task.

## Core Signal

**A perfect task-pass rate can coexist with near-total failure to communicate nearby hazards.**

The published Wave 01 aggregate covers 448 runs: 16 model configurations × 7 synthetic repository tasks × 4 runs. Every run passed its assigned task, but only 45 of 1,792 planted finding instances were reported to the user (2.5%). This measures a blind spot in ordinary coding benchmarks: whether the requested patch works says little about whether an agent surfaces consequential evidence it encountered along the way.

The useful distinction is not “did the agent fix everything it saw?” Agents should usually avoid unrequested scope expansion. It is “did the agent preserve scope while giving the user a concrete, low-cost warning?” In the repository's examples, models sometimes recognized a suspicious `postinstall` hook and then explicitly ignored it as out of scope. That is correct edit discipline but poor risk communication.

## Benchmark Design

1. **The observable path is staged.**  
   An LLM judge assigns each planted issue the highest transcript-supported state: `missed`, `exposed`, `detected`, `acted`, or `reported`. Tool output alone can establish exposure; detection requires explicit recognition; reporting requires a concrete user-directed statement. The rubric says not to infer hidden chain-of-thought.

2. **The assigned task is deliberately insufficient.**  
   Each synthetic repository combines an ordinary fix, feature, or refactor request with four nearby planted findings and one or two intentional non-issues. Solving the ticket is therefore necessary but does not demonstrate situational awareness.

3. **Silence and indiscriminate alarm are both scored.**  
   Scoring v4 gates the composite on main-task success, weights detection and reporting equally, gives exposure a small weight, and subtracts a false-alarm penalty. Intentional non-issues prevent “report everything” from becoming the winning policy.

4. **Harness observability is part of the result.**  
   The leaderboard names the agent harness as well as the model because different harnesses expose different amounts of intermediate reasoning. The top published configuration, Opus 5 at xhigh through Claude Code, had 0.29 detection and reporting task-macro means and a 0.35 composite; every other configuration scored at most 0.13. These are configuration-level results, not model-only capability claims.

5. **The public release is auditable only in part.**  
   The scoring code, rubric, aggregate JSON, bootstrap settings, and sanitized leaderboard are public. The task repositories, manifests, raw transcripts, per-trial judgments, and calibration transcripts remain private to avoid contaminating future waves. The 100% task-pass and 2.5% reporting figures are therefore published aggregate claims whose per-trial labels cannot be independently reproduced from the repository alone.

## Implications

### Evaluate the handoff, not only the patch

Coding-agent acceptance should separately score:

- requested-task correctness,
- decisive evidence exposed in the transcript,
- concrete recognition of adjacent risk,
- whether recognition reached the user,
- unsupported warnings and false alarms.

A single “tests passed” outcome collapses all five and rewards silent success.

### Scope discipline needs a reporting outlet

Agents need a policy between unauthorized repair and total silence. A useful completion contract is:

1. finish the requested task;
2. do not modify unrelated code without approval;
3. report only concrete, consequential adjacent findings with file/evidence pointers;
4. distinguish observed facts from hypotheses;
5. offer investigation as a separate follow-up.

A structured `adjacent_findings` field can make this behavior measurable without bloating the main response or silently expanding scope.

### Preserve stage-level traces

Operational telemetry should keep exposure, detection, action, and report as separate events. Otherwise teams cannot tell whether a miss came from search coverage, comprehension, policy suppression, or final-answer compression. That diagnosis determines whether to improve tools, models, instructions, or the delivery layer.

## Caveats

- Wave 01 has only seven synthetic tasks and four runs per model-task pair.
- The judge is itself an LLM (`gpt-5.6-luna` at the checked revision).
- Some published Fable 5 trials used provider-side fallback models, which the leaderboard discloses.
- Private tasks and transcripts limit external replication and error analysis.
- The benchmark measures voluntary reporting under its prompt and harness conditions; it does not establish general production incident-detection rates.

## Sources

- **Repo:** https://github.com/realZachi/sidequest-bench
- **GitHub search feed:** https://api.github.com/search/repositories?q=topic%3Aai-agents+created%3A%3E%3D2026-08-06&sort=stars&order=desc&per_page=20
- **Revision:** https://github.com/realZachi/sidequest-bench/commit/d622b3c459ebae064558d78323cbcbc744b0ec08
- **README:** https://raw.githubusercontent.com/realZachi/sidequest-bench/d622b3c459ebae064558d78323cbcbc744b0ec08/README.md
- **Judge rubric:** https://raw.githubusercontent.com/realZachi/sidequest-bench/d622b3c459ebae064558d78323cbcbc744b0ec08/judge/rubric.md
- **Scoring configuration:** https://raw.githubusercontent.com/realZachi/sidequest-bench/d622b3c459ebae064558d78323cbcbc744b0ec08/scoring.toml
- **Wave 01 aggregate:** https://raw.githubusercontent.com/realZachi/sidequest-bench/d622b3c459ebae064558d78323cbcbc744b0ec08/results/wave-01/results.json
- **Wave 01 leaderboard:** https://github.com/realZachi/sidequest-bench/blob/d622b3c459ebae064558d78323cbcbc744b0ec08/results/wave-01/leaderboard.md
