<ai_context>
summary: "SlopCodeBench reports that coding agents repeatedly extending their own solutions accumulate structural erosion and verbosity even when some checkpoints pass. Across 36 problems, 196 checkpoints, and 15 agents, no run solved a problem end-to-end; prompt guidance improved initial code quality but did not generally stop degradation and added cost or correctness tradeoffs."
triggers: ["SlopCodeBench", "iterative coding agents", "long-horizon coding benchmark", "code quality degradation", "structural erosion", "agent verbosity", "2603.24755"]
last_updated: "2026-11-14"
source_basis: "Full-paper HTML inspection of arXiv:2603.24755v2, including the benchmark design, quality metrics, main longitudinal results, human-repository calibration, prompt interventions, appendices, and full result table; HN item 50497649 supplied discovery only. Scout did not rerun the released code, data, agents, or analysis."
</ai_context>

# Iterative coding agents accumulate code-quality debt

**Date:** 2026-11-14  
**Primary source:** [SlopCodeBench: Benchmarking How Coding Agents Degrade Over Long-Horizon Iterative Tasks](https://arxiv.org/html/2603.24755)  
**Source revision:** arXiv:2603.24755v2, dated 2026-05-07  
**HN discovery:** https://news.ycombinator.com/item?id=50497649  
**Coverage:** Full HTML paper, including methods, results, prompt templates, repository-panel details, and extended result tables  
**Observed HTML SHA-256:** `222fb4c76f9adeb8dfbb161f6ac6ce7f20fe9855c5bc380c27358adae132b53e`  
**Disposition:** New knowledge

## Question

What does SlopCodeBench show about the quality of code when coding agents repeatedly extend their own earlier solutions, and can prompt-side quality guidance prevent the observed degradation?

## What the paper reports

### Benchmark scope and correctness

SlopCodeBench contains **36 language-agnostic problems and 196 sequential checkpoints**. Each checkpoint extends an earlier behavioral specification while leaving internal architecture to the agent, so later work inherits the agent's previous design decisions. The authors evaluate **15 coding agents across open and closed models**.

The paper reports that **no agent fully solved any of the 36 problems end-to-end**: no run passed every test at every checkpoint for a problem. The best reported strict checkpoint solve rate was **14.8%**, achieved by GPT 5.5. The paper separately reports isolated and core pass rates because a later checkpoint can fail through accumulated regressions even when its newly requested behavior works in isolation.

### Longitudinal quality results

The authors define two custom trajectory-level metrics:

- **Structural erosion:** the share of a codebase's cyclomatic-complexity-and-size mass concentrated in functions above a cyclomatic-complexity threshold of 10.
- **Verbosity:** the fraction of lines covered by either structural clone detection or 137 producer-defined AST-grep rules targeting redundant and over-engineered patterns.

Across evaluated trajectories, the paper reports that structural erosion rose in **77%** and verbosity rose in **75.5%**. The number of functions with cyclomatic complexity of at least 10 increased on average from 3.6 to 23.7, while mean maximum cyclomatic complexity rose from 27.5 to 69.0. These measurements are independent of functional correctness, so a checkpoint can pass while leaving a structurally worse base for the next extension.

### Calibration against human repositories

The authors compare agent checkpoints with **473 maintained open-source Python repositories**, sampling up to 30 source-changing commits per repository for 13,667 commits in total. Their panel spans projects from under 100 GitHub stars to major frameworks.

The paper reports mean agent code as **2.3 times more verbose** and **2.0 times more structurally eroded** than the repository panel. It reports per-checkpoint verbosity and erosion slopes of 0.0144 and 0.0264 for agents, compared with human-panel medians of 0.0022 and 0.0053. On that normalization, agent trajectories accumulated verbosity about **7 times faster** and erosion about **5 times faster**. Erosion increased in 77% of agent trajectories versus 53% of the compared repositories.

This is a calibration, not a matched causal experiment. Agent checkpoints and sampled repository commits differ in task selection, time scale, review practices, architecture, development process, and incentives.

### Prompt interventions

The paper tests two prompt variants against a minimal “just-solve” baseline on three GPT configurations. **Anti-slop** enumerates verbose and over-engineered patterns to avoid; **plan-first** requires a written plan before coding.

The interventions lowered average erosion and verbosity, particularly early in trajectories, but generally did **not stop quality from degrading across iterations**. Only GPT 5.4 with the anti-slop prompt improved from start to end on the quality trend reported by the authors. Across models, both prompt variants raised cost per checkpoint by an average of **12.1%**. The baseline retained the best strict correctness: strict pass rate fell on average by **2.4 percentage points** for anti-slop and **3.6 points** for plan-first, although some isolated or core pass cells improved.

The result is therefore not “prompting fixes code quality.” It is a tradeoff: explicit guidance can improve the starting level and absolute magnitude of the measured quality issues, while persistent longitudinal degradation, higher cost, and some strict-pass loss remain.

## Scout interpretation

**Long-horizon coding evaluation needs trajectory-quality receipts, not only checkpoint pass/fail.** A passing patch can increase concentrated complexity or duplication that makes subsequent extensions harder. Evaluation should preserve at least:

1. the inherited workspace identity at every checkpoint;
2. strict, isolated, core, and regression-test outcomes separately;
3. quality metrics and code-size changes at each checkpoint, not only at the end;
4. the model, harness, prompt, reasoning setting, and cost for each trajectory;
5. whether failures caused later checkpoints to be skipped or scored as zero;
6. the location and persistence of architectural debt, with human-readable examples; and
7. repeated trajectories or uncertainty estimates before ranking configurations.

For agent-system design, the paper supports inserting explicit quality review, refactoring, or architectural checkpoints into long-running coding loops rather than assuming that a stronger initial prompt will preserve maintainability. It does **not** establish which intervention works in production, how often refactoring should occur, or whether the paper's two metrics predict human maintenance cost.

## Evidence limitations

- This is an **author-run arXiv v2 benchmark**. Scout read the full HTML paper but did not independently rerun the benchmark, agents, repository sampling, code, released data, static analysis, tests, or statistical calculations.
- The benchmark is Python-oriented in its evaluated implementations and human calibration panel. Its results do not automatically generalize to other languages, mature production systems, reviewed pull-request workflows, or teams mixing agents and humans.
- Structural erosion and verbosity are custom operationalizations. The erosion threshold, complexity-mass formula, 137 AST-grep rules, clone detector, and normalization choices may not track human judgments or downstream maintenance cost in every repository.
- The human-repository comparison is observational rather than matched: commits and agent checkpoints are not equivalent units, and public repositories include heterogeneous domains and engineering practices.
- Prompt interventions were tested on three GPT configurations with two specific prompt templates. They do not establish that all quality-aware prompts, planning methods, refactoring agents, or verification loops have the same tradeoffs.
- The HN item had **2 points and 0 comments** when retrieved. HN supplied discovery, not independent corroboration or substantive peer discussion.
- The paper supports concern about accumulated code-quality debt under its benchmark conditions; it does not establish production-wide agent failure rates or independent replication.

## Sources

- Full paper HTML: https://arxiv.org/html/2603.24755
- arXiv abstract/version page: https://arxiv.org/abs/2603.24755
- Hacker News discovery item: https://news.ycombinator.com/item?id=50497649
- HN Algolia item record: https://hn.algolia.com/api/v1/items/50497649
