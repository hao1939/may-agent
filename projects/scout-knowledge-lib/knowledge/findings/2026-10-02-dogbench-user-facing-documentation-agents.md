<ai_context>
This finding assesses DoGBench as an evaluation of agents maintaining existing user-facing software documentation. Scout read the public HTML manuscript sections covering benchmark design, validation, setup, results, failures, discussion, and limitations; the current project page; the repository README at revision 35bc80734093ffc3d0801476b02ceb2ab0c80bd2; and the HN submission. Scout did not read the full PDF appendices, execute the benchmark, inspect all repository code or trajectories, reproduce scores, or independently adjudicate the dataset and rubrics.
</ai_context>

# Documentation agents need workflow-completion and abstention checks, not prose review alone

**Date:** 2026-10-02  
**Source:** <https://dogbench.ai/>  
**Paper:** <https://dogbench.ai/paper>  
**Repo:** <https://github.com/Promptless/dogbench> (reviewed README at `35bc80734093ffc3d0801476b02ceb2ab0c80bd2`)  
**Dataset:** <https://huggingface.co/datasets/promptless-research/dogbench-dev>  
**HN:** [49928118](https://news.ycombinator.com/item?id=49928118)  
**Coverage:** Public HTML manuscript sections on design, validation, setup, results, failures, discussion, and limitations; current project page; repository README; HN submission and its one author comment  
**Disposition:** New knowledge

## Question

What does DoGBench reveal about evaluating agents that update user-facing software documentation?

## Finding

DoGBench makes two decisions jointly evaluable: **whether a repository event creates a documentation obligation**, and **whether the resulting patch lets the intended reader complete the affected task**. This is a stronger target than polished prose or factual snippets. Each task provides a pre-change repository plus a trigger such as a pull request or reported documentation gap. The agent must either emit one patch or abstain. Task-specific rubrics cover accuracy, completeness, reader guidance, placement, and repository conventions rather than similarity to the human patch.

The benchmark contains 292 real items: 205 require documentation and 87 require abstention. Its primary held-out split has 117 items (82 patch-needed and 35 abstentions). Delivered patch quality averages across all patch-needed items, assigning zero to missed or empty patches; abstention recall measures correct non-edits. Their harmonic mean prevents prolific editing from hiding poor restraint and prevents conservative abstention from hiding missed documentation. On this split, the paper's best of seven reproducible model-plus-harness lanes scored 47.3/100, while the best P0-clean delivery rate was 39.0% (32 of 82). The authors explicitly caution that 100 means satisfying every rubric requirement, not 100% of an expert's capability.

This abstention dimension matters operationally. The seven lanes' patch recall ranged from 79.3% to 96.3%, while abstention recall ranged much more widely, from 28.6% to 85.7%. A high-recall system can therefore impose substantial review, translation, versioning, and maintenance work by documenting refactors or performance changes that have no user-observable effect. Conversely, agents sometimes interpret the absence of an existing page as evidence that a subject is intentionally undocumented, when the absence is the gap they were asked to repair. A useful documentation workflow needs an explicit, evidence-backed obligation decision before it searches for somewhere to put text.

## Fluent patches fail at the reader's workflow

In a separate audit of 1,267 submissions, fabricated classes, flags, or endpoints appeared in 6.1%, but broader technical inaccuracies appeared in 36.6%. The most frequent problem was a task-completion gap (45.5%): an omitted prerequisite, decision, procedure, verification step, or recovery path. Other common failures included incomplete conceptual/reference coverage (32.5%), missing prerequisites (21.0%), findability or information-architecture failures (20.7%), and cross-surface inconsistency (13.3%). These categories overlap.

The corresponding trajectory audit connects patch defects to premature closure:

- 36.0% described an interface without checking how a reader would set up, decide, execute, verify, or recover;
- 33.1% stopped before decisive implementation, schema, test, or public-contract evidence and filled the gap with a plausible assumption;
- 30.1% edited the first plausible documentation surface without checking other maintained, generated, mirrored, migration, or workflow surfaces;
- 27.5% reached relevant evidence but did not turn it into a complete coverage checklist.

These are first-party observational labels, not causal intervention results. Still, they suggest a concrete review boundary: before drafting, record the user-visible obligation, decisive evidence, reader journey, affected surfaces, and claims that must survive into the patch. After drafting, test the patch as part of the documentation system: can the target reader find it, satisfy prerequisites, choose correctly, complete the steps, verify the result, recover from failure, and avoid contradictory guidance elsewhere?

## Reusable implications

1. **Separate admission from authoring.** First decide whether the trigger changes behavior a user can invoke, observe, or act on; only then authorize a documentation edit.
2. **Score correct non-action.** Patch recall without abstention recall rewards review spam. Keep both visible even when reporting a composite.
3. **Review for task completion.** Correct feature description is insufficient without prerequisites, decision points, procedure, verification, recovery, audience, and purpose.
4. **Require decisive evidence.** A nearby symbol or existing page is a lead, not proof. Check controlling code, schemas, tests, public contracts, and supported examples before generalizing.
5. **Inventory documentation surfaces.** Search navigation, guides, references, generated or mirrored pages, migrations, and examples before declaring the update complete.
6. **Use a coverage checklist as an intermediate artifact.** Preserve supported claims, setup conditions, scope boundaries, user actions, examples, and affected surfaces between investigation and drafting.
7. **Treat model plus harness as the evaluated lane.** The reported results pair named models with OpenCode, Claude Code, or Codex; they do not isolate model capability.
8. **Keep publication controls independent.** Benchmark success does not establish authorization to edit, repository policy compliance, review acceptance, link validity, build success, or safe publication.

## Evaluation design details worth preserving

The reported agent runs used fresh Docker environments and no network access except to model providers. The authors say an earlier connected pilot let 30.6% of 85 runs retrieve the upstream pull request and merged documentation, while shared-host runs sometimes copied prior agents' trajectories. This supports sealed, per-run workspaces when public answers exist. It does not imply production documentation agents should never use the internet; the paper reports that only 10 of 683 audited failed trajectories needed external evidence absent from supplied inputs.

The public development split contains 175 items, while held-out rubrics, references, and item-level scores remain private. The repository README says the release includes execution and scoring code, five development samples, and 735 sanitized historical trajectories; full development inputs and frozen rubrics are distributed separately. Its validation path checks exact input bindings, traces, and suspicious copying, and records weakened modes such as offline or missing-trace validation. Those mechanics are useful, but Scout did not execute or audit them.

## Limitations

- All numerical results are first-party. Scout did not run DoGBench, replay trajectories, reproduce scoring, or independently adjudicate a task.
- Each agent-item pair was run once, so the paper does not measure run-to-run reliability, pass@k, or best-of-k performance.
- Automated rubric generation and LLM judging may introduce error. Human validation covered subsets: the paper reports documentation-need agreement on 41 of 42 reviewed items, priority-weighted rubric recall of 0.892 on 21 items, and judge agreement on 310 of 330 criteria after author adjudication—not blinded agreement between independent humans.
- The rubrics have overlapping criteria, equal weighting for noncritical criteria despite maintainer preference differences, and no deterministic execution checks for code samples or links.
- Abstention labels are weaker than patch labels: some rely on no related documentation change appearing in a 90-day window, so forgotten or delayed updates may be mislabeled as correct abstentions.
- The sealed environment limits contamination but differs from connected production work. Reported model versions, harnesses, and cloud leaderboard entries can change.
- The benchmark covers maintenance of existing documentation under repository constraints, not greenfield documentation or unconstrained information-architecture redesign.
- Two authors are affiliated with Promptless, which builds documentation agents.
- Scout read the public HTML manuscript but not the full PDF appendices, and inspected only the repository README rather than the complete pinned source tree.

## Sources inspected

- Project page: <https://dogbench.ai/>
- Public HTML manuscript: <https://dogbench.ai/paper>
- Repository README at reviewed revision: <https://github.com/Promptless/dogbench/blob/35bc80734093ffc3d0801476b02ceb2ab0c80bd2/README.md>
- Dataset landing page referenced by the project: <https://huggingface.co/datasets/promptless-research/dogbench-dev>
- HN submission: <https://news.ycombinator.com/item?id=49928118>
