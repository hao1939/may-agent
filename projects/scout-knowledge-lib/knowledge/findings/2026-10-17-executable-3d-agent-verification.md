<ai_context>
This finding records abstract-level evidence for evaluating coding-agent 3D output through executable programs, spatial measurements, and visual feedback rather than appearance alone. Scout read the complete arXiv v1 abstract and feed metadata supplied by the workflow; the full paper, dataset, harness, code, assets, verification records, experiments, and reported human evaluation were not inspected or reproduced.
</ai_context>

# Executable 3D agent output needs layered verification

**Date:** 2026-10-17  
**Source:** <https://arxiv.org/abs/2610.22341v1>  
**Source revision:** arXiv:2610.22341v1  
**Disposition:** New knowledge

## Question

What does the current arXiv record suggest about making generated 3D content editable and verifiable, and which parts remain unsupported by abstract-only evidence?

## Finding

The abstract for *3DCodeVerse: Exploring 3D Worlds as Code* describes a research ecosystem in which agents produce standalone executable 3D programs rather than only rendered images. It names three components:

1. **A packaged corpus:** 3DCodeVerse-2M is described as executable code packaged with the source files and assets needed for its declared environment, plus available descriptions and verification records.
2. **An agent harness:** a multi-agent directed acyclic graph generates and refines content.
3. **Several feedback channels:** execution checks, spatial measurements, and visual feedback automatically evaluate and revise programs without human feedback during generation.

The useful signal is the separation between an artifact that can execute, geometric properties that can be measured, and a rendered result that can be judged visually. An executable program is not by itself proof that objects have the intended placement or relationships; a plausible rendering is not proof that the source is complete, editable, or reproducible in its declared environment. For code-producing agents, those are different verdict layers and should retain separate evidence.

The authors also report that fine-tuning on their dataset improves open-model 3D coding and that their harness reaches a 90% pairwise-human-evaluation win rate against “Claude Design (3D Object)” when Claude Opus 5.5 drives both. From the abstract alone, that comparison does not isolate whether the reported advantage comes from orchestration, tools, feedback channels, prompt budget, assets, or another setup difference.

## Implication for agent evaluation

A reusable evaluation pattern for executable creative artifacts is:

- **Package validity:** required source, assets, dependencies, and environment declaration are present.
- **Execution validity:** the program runs under the declared environment and produces an inspectable result.
- **Structural validity:** deterministic or measurable constraints such as dimensions, positions, collisions, and relationships hold.
- **Perceptual validity:** visual output matches the requested appearance or quality criteria.
- **Revision validity:** automated feedback changes the program without breaking previously satisfied constraints.
- **Human preference:** pairwise judgment remains a separate, protocol-dependent signal rather than a substitute for the earlier checks.

This is a general design implication drawn from the abstract, not evidence that 3DCodeVerse implements complete or independent verification at every layer.

## Evidence boundary

Scout read the complete abstract and feed metadata supplied by the workflow, not the full paper or project site. All scale, capability, improvement, and win-rate statements are author-reported abstract claims. Scout did not inspect:

- corpus licenses, deduplication, generation share, quality filters, or train/test contamination;
- whether every program includes all dependencies and assets or how execution environments are pinned;
- the semantics, coverage, false-pass rate, or independence of verification records;
- the multi-agent DAG, prompts, models, budgets, stopping rules, failure handling, or revision traces;
- spatial and visual evaluators, their calibration, or whether they share model-induced errors with generators;
- fine-tuning baselines, ablations, statistical uncertainty, or per-category results;
- the human-evaluation protocol, sample size, rater blinding, ties, task matching, or definition of “Claude Design (3D Object)”;
- code, data, executable examples, project artifacts, or independent reproduction.

The abstract supports the layered verification concept and identifies the claimed artifact types. It does not prove package completeness, verifier validity, causal benefit from any harness component, the reported 90% comparison, or transfer beyond 3D coding.

## Retrieval record

The workflow made the cycle’s single canonical request:

- **Endpoint:** `https://export.arxiv.org/api/query?search_query=cat%3Acs.AI&start=0&max_results=20&sortBy=submittedDate&sortOrder=descending`
- **HTTP status:** `200`
- **Latency:** `298 ms`
- **Request count:** `1`
- **Retry-After:** not present (`null`)

## Sources inspected

- [3DCodeVerse: Exploring 3D Worlds as Code, arXiv:2610.22341v1](https://arxiv.org/abs/2610.22341v1) — complete abstract and feed metadata only
- Feed-declared [project page](https://3dcodeverse.com/) was identified but not opened or inspected in this bounded arXiv scan.

## Related Scout knowledge

- [Agent Runtime Verdict Integrity](../agent-runtime-verdict-integrity.md) separates operation evidence from accepted verdicts; 3D execution, spatial checks, visual judgment, and preference likewise should not collapse into one success flag.
- [Declared agent plans need separate selection and execution checks](2026-09-30-declared-plans-versus-agent-execution.md) provides the broader distinction between a proposed artifact and evidence from executing it.
