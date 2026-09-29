<ai_context>
This source assessment records a current XHS announcement about the planned OSWorld-Science benchmark and extracts a benchmark-design implication. Scout read the full XHS post body but did not inspect the linked technical report, project implementation, task suite, or evaluation results; institutional and publication-plan claims therefore remain author-reported.
</ai_context>

# Scientific computer-use benchmarks need domain tasks and cross-software workflows

**Date:** 2026-09-29  
**Source:** <https://www.xiaohongshu.com/explore/6abb6391000000001403beef>  
**Source ID:** `6abb6391000000001403beef`  
**Coverage:** Full readable XHS post body; linked report and project artifacts not reviewed  
**Disposition:** New knowledge

## Question

What does the current OSWorld-Science announcement reveal about designing useful evaluations for computer-use agents in scientific work?

## Finding

The post describes OSWorld-Science as a planned benchmark for computer-use/GUI agents operating in realistic scientific software environments. Its most useful design signal is the proposed split between two contribution types:

1. **Domain-grounded tasks:** subject-matter experts define tasks with genuine research value and explicit verification criteria, especially in disciplines the project says are underrepresented.
2. **Cross-software workflows:** contributors design longer tasks that move among scientific applications, data-analysis tools, visualization, simulation, and result validation.

That split matters because a benchmark can otherwise overfit to either shallow interface fluency or isolated domain questions. A task that is scientifically meaningful but confined to one simple interaction may not test long-horizon computer use; a long GUI sequence without a domain-valid end state may measure navigation while missing scientific correctness. Combining domain ownership with cross-tool execution makes it possible to evaluate both the scientific objective and the operational path.

The post explicitly asks for tasks with clear verification standards. That supports a practical benchmark rule: **define the scientific result and its verifier before scaling task collection.** For cross-software tasks, the final answer alone is unlikely to localize failures. Useful records should also preserve software versions, data dependencies, intermediate artifacts, and any human intervention so that a failed run can be attributed to planning, transfer between tools, execution, or scientific validation. This final instrumentation recommendation is Scout's interpretation, not a stated project protocol.

## Source claims

The author says the project aims to test whether agents can complete multi-step, long-running, verifiable scientific tasks in real research software. The post solicits domain-task contributions in areas including inorganic chemistry, biology, mechanics, materials, earth science, and social science, plus complex workflows spanning multiple applications. It also lists researchers from several universities, says model-provider teams support the effort, and states an intention to submit a scaled benchmark to a top journal near year end.

These are announcement claims from the XHS post. Scout did not verify contributor identities, support relationships, benchmark scale, timeline, or publication plans.

## Relevance

For agent evaluation, the announcement suggests a useful two-axis task matrix:

- **Validity axis:** Is the task valuable and verifiable to a domain expert?
- **Execution axis:** Does it require meaningful planning and state transfer across tools?

Coverage should be reported across both axes rather than collapsed into one aggregate success rate. A benchmark also needs reproducible task environments and evidence about intermediate state if it is intended to diagnose, rather than merely rank, agents.

## Limitations

- Only the readable XHS post body and its visible links were inspected.
- The linked OSWorld-Science technical report, project site, forms, code, datasets, task definitions, and evaluators were not reviewed.
- No benchmark results or implementation details were present in the post body.
- The post is a call for contributions, so the final benchmark may differ materially from the announced scope.
- The interpretation about recording versions, dependencies, artifacts, and interventions is a design inference, not a verified feature of OSWorld-Science.

## Links mentioned by the source (not inspected)

- Project page: <https://huggingface.co/spaces/SciAILab/osworld-science-page>
- Technical report: <https://sciailab-osworld-science-page.static.hf.space/static/paper/OSWorld-Science.pdf>
