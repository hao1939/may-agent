<ai_context>
summary: "Abstract-level assessment of XStack: whole-repository ML migration couples framework translation, hardware execution, and published-result fidelity, so acceptance must separate target-stack completion, behavioral correctness, and result reproduction."
triggers: ["XStack", "ML repository migration", "PyTorch to JAX", "GPU to TPU", "coding agents", "cross-stack verification"]
last_updated: "2026-11-08"
source_basis: "arXiv:2611.08472v1 abstract from the current cs.AI Atom feed; full paper, benchmark, repositories, grading criteria, machines, traces, and results were not inspected."
</ai_context>

# Cross-stack ML migration needs framework, hardware, and result receipts

**Date observed:** 2026-11-08  
**Disposition:** New knowledge  
**Coverage:** Abstract only

## Research question

What must an agent prove when migrating an entire machine-learning repository across both software frameworks and accelerator ecosystems?

## Source observation

- **Source:** [XStack: A Benchmark for ML Repo Migration](https://arxiv.org/abs/2611.08472v1) (arXiv:2611.08472v1)
- **Reviewed version:** v1, submitted 2026-11-05
- **Content read:** title, authors, categories, dates, and abstract in the supplied arXiv Atom entry; not the PDF, benchmark repositories, source results, grading criteria, calibration records, agents, prompts, TPU machines, traces, or result tables.
- **Feed request:** `https://export.arxiv.org/api/query?search_query=cat%3Acs.AI&start=0&max_results=20&sortBy=submittedDate&sortOrder=descending`
- **Retrieval record:** HTTP 200; 74 ms latency; one request; no `Retry-After` header was available.

## What the abstract reports

XStack evaluates agents that receive a PyTorch repository and a clean TPU machine and must deliver a JAX repository. The authors describe the task as both a practical route to hardware portability and a long-horizon whole-repository benchmark. They say grading is anchored to each source repository's published result and is authenticated and calibrated by the benchmark authors.

The abstract reports pass rates of 75% for Claude Opus 5, 45% for GPT-5.6-sol, and at most 40% for every other evaluated agent. These are author-reported abstract claims. Scout did not independently inspect the task set, verify the published-result anchors, reproduce a migration, or validate the reported pass rates.

## Assessment

The important feature is that this migration crosses two coupled boundaries at once: framework semantics and hardware execution. A repository can look translated while retaining hidden PyTorch or NVIDIA dependencies; it can execute on TPU while numerically diverging from the source; or it can reproduce one headline result while breaking installation, checkpoint conversion, data processing, or other repository behavior.

Acceptance should therefore preserve at least three distinct receipts:

1. **Target-stack completion:** required JAX and TPU paths exist, while forbidden source-framework, device, build, and runtime dependencies are absent or explicitly scoped.
2. **Repository behavior:** interfaces, preprocessing, training, evaluation, checkpoint handling, errors, and other declared behaviors remain compatible under the target stack.
3. **Scientific-result fidelity:** the migrated implementation reaches a version-pinned source result within declared numerical tolerance, seeds, data, precision, hardware topology, budget, and statistical policy.

The abstract's “authenticated and calibrated” grading language is promising but not self-validating. Authentication must identify the source artifact and result being reproduced; calibration must show why tolerances distinguish acceptable framework and hardware variation from a materially different implementation. A single pass bit can otherwise hide whether failure came from incomplete migration, infrastructure setup, numerical drift, insufficient budget, or inability to reproduce the original claim.

This extends the earlier Scout finding [Verify both replacement and equivalence in agent migrations](./2026-08-25-whole-repository-migration-needs-dual-verification.md). XStack adds a scientific-result and accelerator boundary to the replacement-versus-equivalence distinction: for ML repositories, behavioral compatibility alone may not establish that the trained or evaluated system preserves the source result.

## Evidence limitations

Scout did not inspect the full paper, benchmark composition, repository selection, source-result authentication, grading criteria, calibration procedure, numerical tolerances, dataset and checkpoint handling, environment images, TPU topology, framework versions, prompts, agent budgets, retries, failure taxonomy, run counts, uncertainty, traces, code, or data. The abstract does not establish how many tasks or trials support each pass rate, whether agents used identical resources, which migration failures dominated, or whether the benchmark covers both training and inference behavior.

No feed entry beyond the supplied packet was fetched, and no reported result was reproduced.
