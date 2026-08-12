<ai_context>
summary: "HarnessOpt-Bench turns automated agent-harness improvement into a held-out, budgeted evaluation: an optimizer edits prompts, tools, control flow, memory, and orchestration, then nominates one candidate for inaccessible test scoring. Across 111 scored runs on four tasks, model choice moved normalized gain about 1.8 times as much as coding-harness choice; native harnesses were not consistently best. More importantly for evaluation design, optimizers used a median 4% of the call cap but 82% of the case allowance, and visible validation bests were generally optimistic. Harness optimizers therefore need case-level budgets, immutable candidate lineage, and held-out scoring—not just API-call limits or self-reported validation gains."
triggers: ["2608.06301", "HarnessOpt-Bench", "harness optimization", "automated harness engineering", "held-out harness evaluation", "agent meta-optimization", "case-pass budget", "candidate lineage"]
last_updated: "2026-08-08"
source_basis: "arXiv 2608.06301v1 metadata, abstract, and full HTML inspected; quantitative claims are attributed to the paper's reported 111-run evaluation."
</ai_context>

# Harness optimization needs held-out outcomes and case-level budgets

**Date:** 2026-08-08  
**Source:** https://arxiv.org/abs/2608.06301v1  
**Source:** https://arxiv.org/html/2608.06301v1  
**Source:** https://export.arxiv.org/api/query?id_list=2608.06301  
**Tags:** agent-harness, evaluation, meta-optimization, held-out-testing, resource-budgets

## Finding

*HarnessOpt-Bench* evaluates whether one AI system can improve another agent's **harness**: its prompts, tools, control flow, context and memory, and orchestration code. The optimizer receives a seed harness plus graded development and validation feedback, can edit the harness under a fixed target-evaluation budget, and must nominate a final candidate. That candidate is scored by normalized gain over the seed on a test partition that remains inaccessible during search.

The protocol makes three choices that are easy to omit from self-improving-agent demonstrations:

1. non-overlapping development, validation, and test partitions;
2. isolated execution that meters target-agent resources and prevents test access; and
3. versioned candidate harnesses, preserving the search lineage for audit.

The paper reports **111 scored runs**, covering five frontier optimizer models, a shared coding harness and model-native harnesses, and four target tasks: OfficeQA, BrowseComp-Plus, Terminal-Bench, and GAIA.

## Results that change the operational picture

The headline is not simply that frontier models can improve harnesses. Their ability is uneven, and the evaluation surface strongly affects what appears to work:

- Holding task and coding harness fixed, changing the optimizer model moved normalized gain by **0.142 on average**. Holding task and model fixed, changing the coding harness moved it by **0.079**—a reported model contrast about **1.8×** larger.
- The shared harness beat the corresponding native harness in **11 of 20 model-task pairs**. Native tooling was therefore not a generally dominant baseline, although the GPT models benefited materially from their native Codex harness in this experiment.
- Search had caps of 100 evaluation calls per partition and four full case passes on each development and validation partition. The median optimizer used only **8 calls (4% of the call allowance)** but **82% of its case allowance**; 55 of 100 analyzed cells exhausted at least one partition's case budget.
- Submitted candidates' held-out test scores were generally below the best visible validation scores observed during search. The authors appropriately limit the conclusion: this shows that the visible best is optimistic, but does not by itself separate selection overfitting from validation-test mismatch.
- Detailed trace spans were requested only 16 times across 111 cells, by seven cells. This is evidence about behavior in these tasks—not proof that trace diagnosis is broadly unnecessary.

## Why it matters

Automated harness editing is a form of agent self-improvement that can overfit quietly. A loop can repeatedly tune prompts or orchestration against visible cases and report its best validation point while delivering much less on unseen work. Counting evaluation API calls also understates the effective search budget when one call can sweep many cases.

A credible harness-improvement workflow should therefore treat the following as first-class state:

- **case exposure**, not only call count or token spend;
- immutable seed and candidate revisions;
- the optimizer model and the coding harness as separate experimental factors;
- a nomination decision made before held-out scoring; and
- evaluation noise or resolution bands, so small differences remain unresolved instead of becoming rankings.

This makes harness optimization resemble controlled software experimentation more than unconstrained prompt iteration. The harness is executable policy, and improving it requires the same separation between search evidence and acceptance evidence that protects ordinary model evaluation.

## Scout takeaway

**The scarce resource in harness optimization may be fresh cases, not evaluation calls.** Runtime operators should meter how often candidate policies see each case, preserve every candidate's provenance, and reserve inaccessible acceptance cases. Without those controls, an agent can appear to improve its own operating system while mostly learning the evaluator.

## Evidence limits

This is one benchmark suite with four tasks, pinned target models, deliberately weak or incomplete seed harnesses, and vendor-selected frontier optimizer configurations. GAIA begins from a non-functional stub, so its reported gain is raw held-out performance rather than improvement over a competent baseline. The paper describes its setup as hack-resistant, not hackproof, and repeated feedback may still reward strategies specific to fixed evaluations. The results support the evaluation pattern more strongly than a universal ranking of models or harnesses.
