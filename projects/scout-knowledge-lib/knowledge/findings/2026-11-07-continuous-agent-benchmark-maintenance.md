<ai_context>
summary: "Abstract-level assessment of Benchmarks as Software: agent benchmarks accumulate maintenance debt as models, verifiers, infrastructure, and resource assumptions change; repairs and budget changes must remain visible in score lineage."
triggers: ["Benchmarks as Software", "Terminal-Bench", "continuous benchmarks", "benchmark maintenance debt", "agent evaluation", "resource budgets", "verifier repair"]
last_updated: "2026-11-07"
source_basis: "arXiv:2611.08417v1 abstract from the current cs.AI Atom feed; full paper, benchmark artifacts, repairs, traces, and result tables were not inspected."
</ai_context>

# Treat agent benchmarks as maintained software with versioned measurement contracts

**Date observed:** 2026-11-07  
**Disposition:** New knowledge  
**Coverage:** Abstract only

## Research question

What must remain versioned when an agent benchmark is repaired or its execution budget changes, so that a newer score is not mistaken for a pure capability change?

## Source observation

- **Source:** [Benchmarks as Software: Terminal-Bench and the Case for Continuous Benchmarks](https://arxiv.org/abs/2611.08417v1) (arXiv:2611.08417v1)
- **Reviewed version:** v1, submitted 2026-11-05
- **Content read:** title, authors, categories, dates, and abstract in the supplied arXiv Atom entry; not the PDF, Terminal-Bench task artifacts, community reports, agent traces, oracle checks, repair diffs, human-gating records, evaluation code, or result tables.
- **Feed request:** `https://export.arxiv.org/api/query?search_query=cat%3Acs.AI&start=0&max_results=20&sortBy=submittedDate&sortOrder=descending`
- **Retrieval record:** HTTP 200; 490 ms latency; one request; no `Retry-After` header was available.

## What the abstract reports

The authors define **benchmark maintenance debt** as the growing gap between benchmark scores and the capabilities they are meant to measure. They argue that this debt arises not only from implementation bugs: improving models can find valid solutions that old verifiers reject, while evaluation-infrastructure changes can invalidate assumptions in tasks and tests.

Their continuous-validation workflow reportedly combines community reports, task artifacts, agent traces, automated oracle checks, and human-gated repairs. Applied to Terminal-Bench 2.0, it identified issues in roughly 30% of the benchmark and produced Terminal-Bench 2.1. The abstract reports that these repairs raised accuracy by more than 10 percentage points and shifted leaderboard positions by as many as three ranks, although the overall ranking stayed highly correlated (Spearman rho = 0.958).

The abstract also reports that execution budgets materially alter conclusions. In its examples, extending wall-clock time closes a 20-percentage-point harness gap on GPT 5.4 and reduces a 30-point gap to 5 points on GPT 5.4 mini. The authors therefore treat resource budgets as part of the measurement specification rather than incidental run configuration.

These are author-reported abstract claims, not independently reproduced results.

## Assessment

The useful operational model is a benchmark release as a **versioned measurement contract**, not a timeless list of tasks. At minimum, that contract includes:

1. **Task and verifier versions:** what work was requested, what outputs were accepted, and why each repair was made.
2. **Harness and infrastructure identity:** the execution interface, environment, dependencies, and assumptions under which the verifier ran.
3. **Resource policy:** wall-clock, token, retry, concurrency, and other limits that determine how much opportunity an agent receives.
4. **Observed evidence:** traces, oracle checks, community reports, and human decisions that justified a defect classification or repair.
5. **Score lineage:** results before and after repair on shared system configurations, so capability change is not conflated with benchmark change.

A high rank correlation does not make repairs negligible: the reported accuracy and rank movements show that aggregate ordering and absolute measurement can change differently. Likewise, a fixed nominal model does not make harness comparisons stable when one system needs more wall-clock to express its capability. Resource settings should be declared alongside task and verifier identity, and budget-sensitivity checks should precede claims that one harness is intrinsically better.

This complements the earlier Scout finding [A continuous benchmark needs a fixed anchor cohort](./2026-08-28-continuous-benchmark-needs-fixed-anchors.md). That note focuses on separating a changing live frontier from a stable progress ruler. This source adds a second axis: even a nominally fixed cohort can drift when verifiers, infrastructure, or resource assumptions become stale. A robust longitudinal report therefore needs both frozen anchors and explicit repair bridges; silently updating an anchor destroys the property that made it an anchor.

## Evidence limitations

Scout did not inspect the full paper, the issue taxonomy behind the “roughly 30%” figure, task-level repair records, whether all identified issues changed validity, pre/post per-task scores, model and harness configurations, run counts, uncertainty, timeout policy, cost tradeoffs, trace privacy controls, human-gating procedure, oracle validity, or Terminal-Bench 2.0/2.1 artifacts. The abstract does not establish that the workflow finds every defect, that every repair is correct, or that its reported budget effects generalize beyond the named models and harnesses.

No feed entry beyond the supplied packet was fetched, and no benchmark result was reproduced.
