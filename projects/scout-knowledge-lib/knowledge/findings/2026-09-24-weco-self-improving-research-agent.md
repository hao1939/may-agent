<ai_context>
summary: "A current XHS post reports that Weco AI let a research agent revise its own code through an outer evaluation loop, accepting seven changes over eight days before testing the result on four held-out benchmarks. The durable signal is the separation between private selection tasks and external evaluation, while the reported gains remain unverified because the post supplies no paper, code, task definitions, run history, or baseline details."
triggers: ["Weco AI", "self-improving research agent", "agent edits its own code", "held-out agent evaluation", "outer optimization loop", "6ab4c3dd000000000a02067f"]
last_updated: "2026-09-24"
source_basis: "Full body-level read of Xiaohongshu note 6ab4c3dd000000000a02067f. Scout did not inspect a Weco AI paper, repository, benchmark suite, run logs, or implementation because the readable post supplied none."
</ai_context>

# Self-improving research agents need evaluation outside the selection loop

## Assessment

- **Question:** What evidence would distinguish useful self-modification from overfitting to an agent's private improvement loop?
- **Observation date:** 2026-09-24
- **Source:** [“研究Agent自己改自己，8天反超人类”](https://www.xiaohongshu.com/explore/6ab4c3dd000000000a02067f), Xiaohongshu note `6ab4c3dd000000000a02067f`, by 光头不砍树
- **Coverage:** Full readable XHS post body. The post is a short secondary description; no underlying paper, repository, benchmark, or run artifact was available in its body.
- **Disposition:** New source-level signal with material verification gaps.

## What the post reports

The post says **Weco AI** made an AI research agent's own code the object of optimization. An outer loop repeatedly rewrote the inner agent, scored candidate versions on a private test set, and retained selected changes. Over eight days of autonomous operation, the process reportedly accepted seven improvements.

The author says the resulting agent was then assessed on four external benchmarks that had not participated in selection and matched or exceeded a version refined by a human team over two years. The only task-level number in the readable body is an out-of-distribution weather-forecasting score reported as increasing from **0.262 to 0.793**.

These are claims in the XHS post, not independently verified results. The post does not identify the four benchmarks, define the weather score, name the compared agent versions or model backbones, state the number of candidate mutations and rejected changes, or link the underlying technical report.

## Interpretation

The reusable idea is not the “surpassed humans” framing. It is the attempt to put **selection and evaluation on different task sets**. A self-modifying agent that repeatedly observes one private score can optimize quirks of that evaluator, even when each accepted change appears locally beneficial. Testing the selected agent on tasks withheld from the modification loop is therefore a minimum check for transfer.

That check is necessary but insufficient. “Four unseen benchmarks” does not establish that benchmark authorship, task families, tools, prompts, or data sources were independent of the private selection set. It also does not reveal whether the comparison controlled the model, compute budget, tool access, wall-clock time, or retry policy. Seven accepted revisions say nothing about the number of attempted revisions or selection pressure. A credible self-improvement record should preserve, for every candidate:

1. the parent code revision and exact patch;
2. the generator model, prompt, tools, and compute budget;
3. private selection scores, rejected candidates, and evaluator version;
4. a frozen held-out suite that the modifying agent cannot inspect;
5. repeated-seed results and regression checks; and
6. final external evaluation performed without further adaptation.

The operational lesson is to treat an accepted self-edit as a **candidate**, not evidence of general improvement. Selection evidence authorizes promotion into held-out evaluation; it should not directly authorize production activation.

## Evidence limits

- The source is a short XHS summary, not a primary Weco AI artifact.
- No technical report, code revision, task list, evaluator rubric, run log, or comparison table was present in the readable post.
- “External” and “never participated in selection” are asserted but not operationally defined.
- The score change from 0.262 to 0.793 lacks a metric definition, variance, repeated runs, and baseline configuration.
- “Matched or exceeded” compresses four benchmark results into a directional claim and does not show per-benchmark outcomes.
- The human baseline is described as two years of team refinement, but team size, effort, inherited components, and compute are unspecified, so the eight-day comparison is not a controlled efficiency result.
