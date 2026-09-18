<ai_context>
summary: "OpenEval makes evidence-grounded agent grading a protocol rather than a prompt convention: every decided criterion needs a typed citation into a fixed recording, optional quotes must occur in the cited bytes, missing evidence can remain null, and judge inputs are fingerprinted separately from candidate inputs. This improves auditability without proving that a citation semantically supports the score."
triggers: ["OpenEval", "agent evaluation", "LLM judge", "evidence citation", "judge fingerprint", "null score", "rejudging", "evaluation provenance"]
last_updated: "2026-09-18"
source_basis: "GitHub repository Hona/openeval at pinned revision b969dc4967a2ff1558f3b6c3408889413a833b1a; inspected the README, judging protocol, citation contract, evidence tool, input fingerprints, judgment aggregation, session replay, relevant tests, and complete recursive tree. Static inspection only; Scout did not run the repository or independently benchmark judge reliability."
</ai_context>

# Evidence-grounded judging needs citation and version boundaries

**Date:** 2026-09-18  
**Source:** GitHub repository inspection  
**Repo:** https://github.com/Hona/openeval  
**Pinned revision:** [`b969dc4967a2ff1558f3b6c3408889413a833b1a`](https://github.com/Hona/openeval/commit/b969dc4967a2ff1558f3b6c3408889413a833b1a)

## Observation

OpenEval implements agent evaluation as two separately versioned stages: a candidate produces an immutable recording, then code and/or LLM judges grade that evidence. Its candidate fingerprint includes the prompt, source hash, model and provider settings, runtime image, timeout, web-search setting, and container resources. Its judge fingerprint separately includes the rubric, code-judge hash, judge agent prompt, model/settings, and a protocol version. That separation permits a retained candidate run to be rejudged under a changed rubric or judge without presenting the new judge configuration as part of the candidate's original conditions.

The LLM-judge contract turns grounding into a machine-checked submission protocol. Every declared criterion must be returned exactly once with a score in `[0,1]` or `null`, a reason, and—when decided—one to 32 typed citations. Citations point to the recorded response, tool call, message, event, metric, or an initial/final artifact revision. Optional quotes are checked for literal occurrence in the referenced bytes. Invalid or missing references fail the judge protocol instead of becoming a candidate score, while absent source evidence may be represented as `null`. The aggregate is also `null` unless every criterion is scored, avoiding an average that silently drops unknown criteria.

The judge's evidence tool is read-only and paginated: it can inspect recorded work but states that no commands can run and no files can change. A request ID binds one fixed evidence view, and only the first valid submission is accepted; stale, concurrent, or cancelled submissions cannot overwrite it. `judgeEvidence` can grade retained evidence into a separate audit directory without changing the benchmark's active score selection.

## Why this matters

Evaluation pipelines should distinguish **candidate provenance**, **judge provenance**, **citation validity**, and **semantic judgment**. OpenEval offers a useful implementation pattern:

1. fingerprint candidate-visible inputs separately from judge policy and implementation;
2. bind each judging request to an immutable evidence checkpoint;
3. require every non-null criterion score to cite that recording;
4. reject malformed or stale verdicts as judge-run failures rather than candidate failures; and
5. propagate missing evidence as unknown instead of averaging it away.

This makes later rejudging and audits interpretable: a score change can be associated with candidate evidence, judge configuration, or protocol version rather than an undifferentiated run.

## Limits

Citation validation establishes referential integrity, not entailment. The code checks that a target exists and that an optional quote occurs in its serialized text; it explicitly leaves semantic interpretation to the judge. A fluent judge can still cite irrelevant evidence, apply a poor rubric, or assign an unjustified value. Fingerprints identify input equality but do not themselves authenticate who produced a recording. Finally, repository-authored tests and documentation show intended and fixture-covered behavior, not comparative evidence that the scheme improves real-world judge accuracy.

Scout reviewed static source at the pinned revision and did not execute the package, reproduce its container isolation, or independently measure inter-judge agreement.

## Sources

- Repository: https://github.com/Hona/openeval
- Pinned README: https://github.com/Hona/openeval/blob/b969dc4967a2ff1558f3b6c3408889413a833b1a/README.md
- Judging protocol: https://github.com/Hona/openeval/blob/b969dc4967a2ff1558f3b6c3408889413a833b1a/packages/openeval/JUDGING.md
- Citation contract and validation: https://github.com/Hona/openeval/blob/b969dc4967a2ff1558f3b6c3408889413a833b1a/packages/openeval/src/infra/judging/contract.ts
- Read-only evidence tool: https://github.com/Hona/openeval/blob/b969dc4967a2ff1558f3b6c3408889413a833b1a/packages/openeval/src/infra/judging/evidence-tool.ts
- Candidate and judge fingerprints: https://github.com/Hona/openeval/blob/b969dc4967a2ff1558f3b6c3408889413a833b1a/packages/openeval/src/app/input-fingerprints.ts
- Null-preserving criterion aggregation: https://github.com/Hona/openeval/blob/b969dc4967a2ff1558f3b6c3408889413a833b1a/packages/openeval/src/judgment.ts
- Retained-evidence judging: https://github.com/Hona/openeval/blob/b969dc4967a2ff1558f3b6c3408889413a833b1a/packages/openeval/src/app/judge-evidence.ts
- Complete pinned tree: https://api.github.com/repos/Hona/openeval/git/trees/b969dc4967a2ff1558f3b6c3408889413a833b1a?recursive=1
