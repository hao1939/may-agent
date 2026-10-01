<ai_context>
summary: "A current XHS explainer describes Harness of Harnesses as a host layer that composes model-plus-harness units through one protocol while adapting harnesses from failure experience. The post reports gains on a private planning benchmark and seven held-out HarnessBank benchmarks, but Scout did not inspect the paper, protocol, code, benchmark artifacts, baselines, costs, or experiments. The reusable evaluation lesson is to measure cross-harness composition and adaptation lift separately rather than treating both as one self-evolution result."
triggers: ["Harness of Harnesses", "HarnessBank", "MAOB", "meta-harness", "harness self-evolution", "6abe530200000000180041ab"]
last_updated: "2026-10-01"
source_basis: "Full visible body of XHS note 6abe530200000000180041ab, inspected 2026-10-01. This is a secondary social-media explanation; linked images, the paper, code, protocol, benchmark artifacts, and experiments were not inspected."
</ai_context>

# Separate cross-harness composition from harness adaptation

**Observed:** 2026-10-01  
**Disposition:** New source-grounded finding  
**Coverage:** Full visible XHS post body; no comments were returned. Images and primary research artifacts were not inspected.

## Source

- **Source:** [XHS note 6abe530200000000180041ab](https://www.xiaohongshu.com/explore/6abe530200000000180041ab)
- **Title:** “Agent Harness 自进化最新论文”
- **Author:** 沐白AI笔记

## What the source says

The post describes a paper titled “Harness of Harnesses,” attributed to the EverMind AI team. In the author's account, each **model plus harness** is treated as a composable unit. A host agent coordinates those units through a common protocol, while the harness can also adapt using experience from failures.

The author reports two groups of results:

- on a team-created planning benchmark called **MAOB**, Exact Match allegedly exceeds the strongest baseline by 10.4–10.5 percentage points; and
- across seven held-out **HarnessBank** benchmarks, the author reports positive Pass@1 changes, including +15.4 points on AppWorld, +13.9 on BrowseComp+, and +13.7 on LiveCodeBench.

These figures are claims in a secondary XHS explanation. Scout did not inspect the paper or establish its stable identifier, revision, publication status, experimental setup, baseline configurations, repeated-run uncertainty, or whether the quoted deltas compare otherwise matched systems.

## Reusable implication

The useful distinction is that a “harness of harnesses” makes at least two independent claims:

1. **composition:** a host can select and coordinate heterogeneous model–harness units through a shared interface; and
2. **adaptation:** failure experience can produce a changed harness that improves later performance.

A benchmark gain does not by itself show which claim caused the improvement. A credible evaluation should therefore include separate ablations for host routing/composition, experience collection, harness modification, and the unchanged base harness. It should also preserve the failed traces and resulting harness revisions so an evaluator can connect an adaptation to the evidence that motivated it.

The reported held-out gains, if primary evidence later confirms them, would make cross-task evaluation more informative than improvement on the benchmark used to generate revisions. They would still not establish general self-improvement: the seven tasks, host policy, candidate harness set, adaptation budget, and selection procedure define the scope of the result.

For operational use, a meta-harness also expands the admission boundary. A common protocol establishes interoperability, not authority or safety. Each selected unit and each generated harness revision would still need declared capabilities, version identity, budget limits, compatibility checks, and independent acceptance before activation.

## Evidence limits

- The inspected source is a social-media summary, not the paper or an author artifact.
- The post provides no paper URL, repository, revision, author list, protocol schema, or benchmark data.
- Scout did not inspect the attached images or verify that they faithfully reproduce the paper.
- The MAOB benchmark is described as team-created; its task composition and independence from development are unknown.
- The source does not state run counts, confidence intervals, model and harness versions, inference budgets, adaptation costs, or baseline details.
- No claim is made here that the system is reproducible, production-ready, safe, or able to improve outside the reported benchmark scope.

## Related library context

This finding complements [Harness-search traces can become scoped adaptation evidence](2026-10-01-turbo-harness-instance-adaptation.md). That primary-source assessment examines a different system that converts search traces into per-instance harness patches; the present XHS source instead describes heterogeneous harness composition plus failure-driven evolution. Both suggest treating adaptations as scoped candidates under independent admission rather than as proof of unrestricted self-improvement.
