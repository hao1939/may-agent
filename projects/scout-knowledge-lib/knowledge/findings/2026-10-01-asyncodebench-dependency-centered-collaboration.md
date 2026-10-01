<ai_context>
summary: "A current XHS explainer presents AsynCodeBench as a dependency-centered benchmark for asynchronous multi-agent software engineering. Its key diagnostic split is between passing tests and actually resolving cross-agent dependencies: the post reports 32 runs above 80% test pass rate in one protocol while 26 had zero resolved cross-agent dependencies. These figures and the benchmark design were not checked against the linked project or paper."
triggers: ["AsynCodeBench", "ADPR", "DRS", "asynchronous multi-agent coding", "cross-agent dependencies", "collaboration evaluation", "6abdd9bc000000000e03f400"]
last_updated: "2026-10-01"
source_basis: "Full visible body of XHS note 6abdd9bc000000000e03f400, inspected 2026-10-01. Scout did not inspect the linked benchmark site, paper, repository, tasks, dependency annotations, or experiment artifacts."
</ai_context>

# Evaluate multi-agent coding by dependency closure, not pass rate alone

**Observed:** 2026-10-01  
**Disposition:** New source-grounded finding  
**Coverage:** Full visible XHS text post and its one returned comment. The linked project, paper, repository, images, and experiments were not inspected.

## Source

- **Source:** [XHS note 6abdd9bc000000000e03f400](https://www.xiaohongshu.com/explore/6abdd9bc000000000e03f400)
- **Title:** “🤝 or ⚔️？AI Agents真的会协作吗？”
- **Author:** Zhen Xiong
- **Project URL named by the post, not inspected:** https://asyncodebench.org

## What the source says

The post describes AsynCodeBench as a benchmark for asynchronous multi-agent software engineering that models dependencies between components assigned to different agents. Rather than evaluating only the final test result, it says the benchmark tracks a dependency graph throughout execution and reports two collaboration measures:

- **ADPR:** the proportion of cross-agent dependencies resolved by the end; and
- **DRS:** when those dependencies are first resolved during the collaboration.

According to the post, the benchmark contains 19 tasks from 16 open-source repositories, split into 64 implementation units with 52 cross-component dependencies. It attributes four findings to the benchmark experiments:

1. The best multi-agent mode improved results by 7.8%–22.7% for only 60% of the evaluated models, so adding agents was not uniformly better than a single-agent setup.
2. Under an `ASYNC-MANAGER-RO` setting, 32 runs exceeded an 80% test pass rate while resolving fewer than half of their cross-agent dependencies; 26 of those runs reportedly had ADPR equal to zero.
3. In the reported Qwen-family analysis, stronger single-agent coding performance did not reliably transfer to cross-agent dependency resolution.
4. Dependency closure was reportedly concentrated in short phases rather than improving smoothly throughout execution, although the visible text does not give the exact normalized progress interval.

These are claims in a social-media explanation. Scout did not verify the benchmark's definitions, denominators, protocol settings, statistical treatment, or results against the primary paper or artifacts.

## Reusable implication

A final test pass rate can conceal whether a multi-agent system actually coordinated. Tests may omit an interface, one agent may accidentally compensate for another, or a component may pass locally while the intended cross-agent contract remains unresolved. Multi-agent evaluation should therefore separate at least three questions:

1. **Outcome:** did the assembled system pass its tests?
2. **Dependency closure:** were the declared interfaces and prerequisites between delegated units actually satisfied?
3. **Timing:** when were those dependencies established, and how long did downstream work proceed against unresolved assumptions?

This suggests an operational evaluation pattern: declare cross-worker dependencies before execution, record the evidence that closes each dependency, and score both final closure and time-to-closure alongside ordinary tests. Sudden closure late in a run is also diagnostically different from steady early coordination: it may indicate delayed integration, manager bottlenecks, or repeated work against stale assumptions.

## Evidence limits

- The inspected source is a secondary XHS explanation, not the benchmark paper or artifact.
- The post links `asyncodebench.org`, but Scout did not open or verify that site in this source-bounded scan.
- No task specification, repository identity, paper identifier, model list, raw trajectory, confidence interval, or evaluation code was inspected.
- The visible source does not define the DRS formula in enough detail to reconstruct it, and it omits the exact interval for the reported dependency-closing “hopping window.”
- The figures above should remain attributed to the post until checked against a stable primary source revision.
