<ai_context>
summary: "An XHS paper summary describes Code2Skill as extracting reusable agent skills from maintained source code and screening them by source-blind reconstruction. The useful architectural signal is that executable code can supply provenance and behavioral checks that trajectory- or document-derived skills lack, but the current evidence is secondary and does not independently validate the reported million-skill corpus or benchmark gains."
triggers: ["Code2Skill", "CodeSkillBank", "code-derived agent skills", "source-blind reconstruction", "agent skill verification", "skill provenance"]
last_updated: "2026-09-23"
source_basis: "Full body-level read of Xiaohongshu note 6ab0d3ab0000000034000d62. The note summarizes a Code2Skill paper and reports its methods, results, and limitations; Scout did not inspect the paper, repository, dataset, or benchmark artifacts in this XHS-only scan."
</ai_context>

# Code-derived skills add an executable validation anchor

## Assessment

- **Question:** What changes when reusable agent skills are extracted from source code rather than agent trajectories or prose documents?
- **Observation date:** 2026-09-23
- **Source:** [“100万条技能，从代码里挖出来”](https://www.xiaohongshu.com/explore/6ab0d3ab0000000034000d62), Xiaohongshu note `6ab0d3ab0000000034000d62`, by 林见鹿
- **Coverage:** Full XHS post body and its stated limitations. The underlying paper, code, data, and evaluation artifacts were not inspected in this source-specific scan.
- **Disposition:** New source-level signal. Existing Scout notes cover trajectory-derived skills, retrieval, and skill repair, but not this code-to-skill extraction and reconstruction-validation mechanism.

## What the post reports

The post frames **Code2Skill** as a third source for agent skills. Trajectory-derived skills can remain coupled to the model, tools, and environment that produced them, while prose-derived skills lack direct execution evidence. Code2Skill instead mines maintained repositories, whose source units are executable, versionable, and attributable.

According to the post, the pipeline:

1. samples source units from 19,769 maintained GitHub repositories;
2. represents them as atomic, composite, or recurring-pattern skill records;
3. hides the source and asks an LLM to reconstruct code from the skill record;
4. compares the reconstruction with the original using a source-aware judge, escalating unresolved cases to arbitration; and
5. stores accepted records with provenance and an index.

The post says the resulting **CodeSkillBank** contains 1,006,822 accepted records. It reports that a human sample judged 92% of descriptions accurate and 80% worth retaining. Across nine models and eight benchmarks, the post gives a macro average of 42.90 without the skills and 47.90 with them—a five-point absolute change, described there as 11.7% relative—and says 57 of 72 model-benchmark pairs improved. It also reports that inserting skills during planning or post-generation review was more stable than injecting them directly into first-pass generation, and that rendering the top three skills as summaries reduced context from 6,352 to 707 characters without a reported performance loss.

These numbers are **claims in the XHS summary**, not independently reproduced results. No primary paper URL or repository URL appears in the readable post body.

## Interpretation

The most reusable idea is not the million-item count. It is the validation anchor created by preserving a link to executable source. A code-derived skill can be checked against an implementation that existed before extraction, while a trajectory-derived lesson is often validated only against the same run that suggested it. Source-blind reconstruction is therefore a useful admission test: it asks whether the compact record preserves enough operational content to recreate the behavior rather than merely sounding plausible.

That test is still narrower than task-level usefulness. Similarity to the source can admit obsolete, unsafe, license-incompatible, or overly local behavior. A production skill registry would still need to bind each record to its repository revision and license, run generated code in a constrained environment, test held-out tasks, and track which model and insertion stage benefited. Retrieval quality remains a separate problem: a large accepted corpus does not show that an agent will select the right skill. This complements [the skill-library retrieval ceiling](./2026-08-07-skill-library-retrieval-ceiling.md), while activation and regression checks remain part of [structured skill repair state](./2026-09-15-structured-skill-repair-state.md).

The post's placement result is also operationally important. “Has a useful skill” and “injects it at a useful decision point” are different claims. Planning-time guidance and post-generation review can shape or check an artifact without crowding the initial generation path; direct first-pass injection may instead perturb model behavior. Skill evaluation should therefore record both the retrieved content and its insertion stage.

## Evidence limits

- This assessment is grounded in a full read of the XHS post, but that post is a secondary paper summary. The underlying paper, repository, dataset, prompts, and benchmark outputs were not available in the readable body and were not independently inspected.
- The post says only 10% of the retrieval pool was used in evaluation, the reinforcement-learning result used one checkpoint without repeated seeds, and skill-bank overfitting was not tested.
- Source-aware LLM judging and arbitration do not prove semantic equivalence unless their rubric, disagreement rate, and executable tests are disclosed.
- The 92% accuracy and 80% retention figures need sample size, sampling procedure, annotator agreement, and criteria before they can characterize a corpus of more than one million records.
- The benchmark summary aggregates heterogeneous models and tasks. It does not establish cost efficiency, cross-version durability, or safe production use.
