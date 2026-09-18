<ai_context>
summary: "mini-cut separates provenance-rich planning from model-blind artifact review, then requires low human scores to identify exact timeline clip IDs before converting them into regression-issue records. Its deterministic renderer can replay retained plan revisions without an LLM and stages output before replacement, but the repository does not implement an automated evaluator that proves a later render fixed a human complaint."
triggers: ["mini-cut", "model-blind review", "human evaluation", "regression issue", "timeline clip ID", "deterministic rerender", "evaluation provenance"]
last_updated: "2026-09-18"
source_basis: "GitHub repository ben0724-ACE/mini-cut at pinned revision 58be7bee8fc10972628ae729a182b9f4f7bd9e07; inspected the complete recursive tree, README, edit/output plan models, human-review model, deterministic output renderer, and repository-authored tests for provenance, plan validation, review, and rendering. Static inspection only; Scout did not run the tests or review generated videos."
</ai_context>

# Model-blind review can still produce artifact-addressed regression records

**Date:** 2026-09-18  
**Source:** GitHub repository inspection  
**Repo:** https://github.com/ben0724-ACE/mini-cut  
**Pinned revision:** [`58be7bee8fc10972628ae729a182b9f4f7bd9e07`](https://github.com/ben0724-ACE/mini-cut/commit/58be7bee8fc10972628ae729a182b9f4f7bd9e07)

## Observation

mini-cut, a local-first workflow for turning spoken videos into highlights, implements an instructive separation between **diagnostic provenance** and **quality review**. Its legacy `EditPlan` records whether a rule or LLM planner made the plan plus model, prompt-version, and policy-version fields. By contrast, the human-review rubric and serialized review record omit model, provider, planner, and policy identity. The rubric asks reviewers to score the rendered artifact on four fixed five-point dimensions: cut naturalness, narrative continuity, redundancy, and overall usability.

Blinding does not make the feedback untraceable. A score of one or two is invalid unless the reviewer identifies one or more opaque timeline clip IDs. `create_regression_issues` converts every such low score into a structured record containing the sample, criterion, clip IDs, observed score, expected minimum score, and description. This connects subjective review to a stable region of the artifact without exposing generation identity during scoring.

The replay side is deliberately non-agentic. `output_render.py` describes rendering as deterministic and has no LLM dependency. Before rendering, it checks that the requested output and revision match, that the transcript belongs to the project asset, and that an existing render record contains the same plan; a changed plan requires a new revision. Video and subtitles are built in a temporary staging directory, probed for required streams, and only then replace the published paths. The repository-authored rendering test covers independent export variants, rerendering a retained revision without AI, preserving the prior output after subtitle/render failure, and preserving earlier revision records.

## Why this matters

A useful human-evaluation architecture can keep two records with different disclosure rules:

1. retain full planner/model/prompt/policy provenance for diagnosis;
2. hide those identities from the reviewer to reduce expectancy bias;
3. require poor scores to name stable artifact units rather than accepting only free-form criticism;
4. convert located criticism into versioned regression records; and
5. replay the artifact from retained plans through a deterministic, failure-contained renderer.

The non-obvious point is that **blindness and traceability are compatible when they meet at artifact identity**. The reviewer need not know which model produced a cut, while the system can still associate a complaint with exact clips and later inspect the generating plan separately.

## Limits

The repository does not close the full regression loop. `RegressionIssue` is a structured expectation, not an executable oracle: no inspected code automatically re-renders a sample, obtains a new human score, or proves that the complaint was fixed. Opaque sample IDs can support blinding, but this static inspection did not verify the operational assignment process or whether reviewers could infer model identity from artifact style. The README also says transcription and selection require human listening checks—especially for negation, proper names, and context—and does not guarantee hook appeal or semantic completeness.

The current Web highlight workflow uses `OutputPlan`, while `EditPlan` remains for legacy CLI rough-cut and review flows; the two formats do not automatically convert. Repository-authored tests demonstrate intended fixture coverage, not real-user editing quality or reviewer agreement. Scout did not run the test suite, render media, or conduct a blind review.

## Sources

- Repository: https://github.com/ben0724-ACE/mini-cut
- Pinned README and workflow limits: https://github.com/ben0724-ACE/mini-cut/blob/58be7bee8fc10972628ae729a182b9f4f7bd9e07/README.md
- Planner provenance and plan serialization: https://github.com/ben0724-ACE/mini-cut/blob/58be7bee8fc10972628ae729a182b9f4f7bd9e07/src/minicut/edit_plan.py
- Model-blind rubric and regression records: https://github.com/ben0724-ACE/mini-cut/blob/58be7bee8fc10972628ae729a182b9f4f7bd9e07/src/minicut/human_review.py
- Output plan validation: https://github.com/ben0724-ACE/mini-cut/blob/58be7bee8fc10972628ae729a182b9f4f7bd9e07/src/minicut/output_plan.py
- Deterministic staged rendering: https://github.com/ben0724-ACE/mini-cut/blob/58be7bee8fc10972628ae729a182b9f4f7bd9e07/src/minicut/output_render.py
- Human-review tests: https://github.com/ben0724-ACE/mini-cut/blob/58be7bee8fc10972628ae729a182b9f4f7bd9e07/tests/test_human_review.py
- Rendering tests: https://github.com/ben0724-ACE/mini-cut/blob/58be7bee8fc10972628ae729a182b9f4f7bd9e07/tests/test_output_render.py
- Complete pinned tree: https://api.github.com/repos/ben0724-ACE/mini-cut/git/trees/58be7bee8fc10972628ae729a182b9f4f7bd9e07?recursive=1
