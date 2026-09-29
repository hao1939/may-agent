<ai_context>
summary: "A pinned inspection of vercel-labs/agent-eval shows a useful layered coding-agent evaluation design—deterministic assertions, transcript checks, and optional fixed judges—but also a cache-admission flaw: changing the judge alters the combined fingerprint, yet automatic refingerprinting can carry an old result across that change without replay. Evaluation identity needs immutable treatment dimensions, not only a hash that a migration may rewrite."
triggers: ["agent evaluation", "coding agent eval", "evaluation fingerprint", "result reuse", "fixed judge", "self grading", "cache admission", "agent-eval"]
last_updated: "2026-09-29"
source_basis: "GitHub repository search and static inspection of the README, complete repository tree, fingerprinting implementation and tests, CLI carry-forward path, result-reuse scanner, judge helper, and Docker sandbox at pinned revision 0324efe41e77b4c90f80000e6f9c1bfeb1b76bcd."
</ai_context>

# Evaluation fingerprints must survive their own migration path

**Date:** 2026-09-29  
**Disposition:** New knowledge  
**Repo:** https://github.com/vercel-labs/agent-eval  
**Inspected revision:** [`0324efe41e77b4c90f80000e6f9c1bfeb1b76bcd`](https://github.com/vercel-labs/agent-eval/commit/0324efe41e77b4c90f80000e6f9c1bfeb1b76bcd)

## Question

What must a coding-agent evaluation framework preserve so that cached results remain comparable after the task, runtime, or judge configuration changes?

## Finding

`vercel-labs/agent-eval` provides a useful layered design for framework-specific coding-agent tests. A fixture supplies a task and executable assertions; transcript parsers expose tool-use facts; deterministic transcript checks can reject a forbidden string; and an optional agentic judge can inspect either the resulting environment or the captured trajectory. The framework explicitly supports a fixed judge for cross-model comparisons, avoiding the confound in which each model grades itself.

Its implementation also exposes a sharper lesson: **putting a treatment dimension in a fingerprint is insufficient if a later migration can rewrite cached records to the new fingerprint without replaying that treatment.** The code hashes a pinned judge's agent and model into the combined result fingerprint, and a test says judged results must not reuse self-graded ones. However, the automatic `refingerprint` path treats every config-only change as carry-forward eligible when fixture content is unchanged, except for a smaller runtime-compatibility set. Judge identity is not in that protected set. The CLI even names “pinning a judge” as an example of a config edit to carry forward before a run. It can therefore stamp an old self-graded or differently judged summary with the new combined fingerprint, after which the reuse scanner accepts the cached passing result.

This is static source analysis, not an executed exploit or a claim about published Vercel scores. It is nevertheless a concrete admission-path mismatch between the repository's stated cache boundary and its migration behavior.

## What the pinned source shows

### 1. The evaluation surface usefully separates evidence types

The fixture's `EVAL.ts` can combine ordinary Vitest assertions, build or lint scripts, parsed trajectory facts, and semantic judge clauses. The deterministic `transcript.toContainText` matcher throws when the transcript is missing or empty, including under negation, so absent evidence cannot become a vacuous “never did X” pass. Agentic verdict parsing also fails closed when the judge crashes or produces no parseable verdict.

These layers answer different questions:

- executable assertions test machine-checkable properties of the final artifact;
- transcript assertions test recorded behavior, subject to parser and capture coverage;
- semantic judges evaluate criteria that exact assertions cannot express;
- scripts test integration properties such as build or lint success.

The framework makes agentic judging explicit and costly rather than disguising it as deterministic validation. A pinned judge is offered as the apples-to-apples mode for model comparisons; the default is self-grading with the same agent and model as the run under test.

### 2. Fingerprinting recognizes many treatment dimensions

`computeFingerprint` hashes every file in the eval directory and selected configuration fields: agent, model, scripts, timeout, early exit, run count, web-research access, bundled-skill control, sandbox image and user, adapter-specific extras, and pinned judge identity. Separate tests confirm that changing the judge model or agent changes the combined fingerprint.

A second content-only fingerprint tracks fixture bytes. A third compatibility fingerprint protects selected opt-in runtime changes such as web research, bundled-skill isolation, sandbox image or user, and adapter-specific extras. This split is intended to let harmless config edits inherit old results while forcing replay when task content or sensitive runtime behavior changes.

The source also documents an unavoidable blind spot: function-valued `setup` and `editPrompt` hooks are not hashed. Users are told to force a rerun after changing them. Because both can alter the treatment, this is a procedural requirement rather than an enforced identity boundary.

### 3. Refingerprinting can erase the judge boundary

`decideRefingerprint` carries an old summary to a new combined fingerprint whenever its content fingerprint is unchanged and its runtime-compatibility fingerprint matches. It does not compare the old and new judge identities directly, and judge identity is absent from `computeReuseCompatibilityFingerprint`.

The CLI applies this carry-forward automatically before selected runs. Its comment says this prevents a config edit, “e.g. pinning a judge,” from making every eval look changed. The status command likewise uses content plus the smaller runtime-compatibility fingerprint, so a changed judge is reported as cached rather than outstanding work.

Finally, `scanReusableResults` accepts a passing cached summary when its (possibly rewritten) combined fingerprint matches. The summary file records aggregate counts and fingerprints but not an immutable treatment manifest from which the old judge can be recovered. Thus the new hash can describe the current configuration while the underlying verdict was produced under an earlier one.

The narrow repair principle is not “never migrate caches.” It is to classify config fields by semantic effect and make the classification mechanically binding. Changes to judge, model, prompt rewrite, setup, validation mode, tools, network access, or other causal treatment dimensions require replay unless equivalence is proved by a specific migration—not merely inferred from unchanged fixture bytes.

### 4. A sandbox backend is part of treatment identity, not proof of containment

The Docker backend runs agent commands as the unprivileged `node` user inside an auto-removed container, which is useful isolation for repeatable tests. At the inspected revision, its container creation does not specify network denial, memory or CPU limits, a PID cap, capability drops, a read-only root filesystem, or a seccomp profile. The README also describes opt-in web research and credentials passed into the sandbox for agent or judge calls.

Accordingly, the backend should be read as an experimental execution environment, not hostile-code containment. Backend, image, user, network policy, installed agent version, secrets, and tool availability are causal treatment dimensions and security boundaries that need separate recording.

## Reusable implications

1. **Make treatment identity append-only.** Store the exact task, prompt transform, model, agent adapter, tool policy, environment image, validation logic, and judge beside each result. Derive cache keys from that manifest rather than rewriting old evidence to a new identity.
2. **Separate display freshness from verdict freshness.** Metadata or timeout changes may be harmless for a dashboard, while judge, model, prompt, setup, tools, and validation changes alter what was measured. Do not use one generic “config-only” category for both.
3. **Test the migration path, not only the hash function.** A unit test proving that judge changes alter the hash is incomplete if another path later replaces the old hash. Test end-to-end that old self-graded results are rejected after a fixed judge is selected.
4. **Fail closed on missing observations.** Missing transcripts, unparsable verdicts, and absent validation output should remain infrastructure failures, not negative evidence or implicit passes.
5. **Keep semantic judging subordinate to deterministic evidence where possible.** Use fixed judges for comparisons, retain judge rationales and identities, and calibrate them against deterministic or human-labelled cases.
6. **Treat sandbox configuration as both experimental provenance and a security claim.** Repeatability, non-root execution, network policy, resource limits, and hostile-code isolation are distinct properties.

## Limitations

- Scout performed static inspection only. It did not install the package, run paid agent calls, execute the test suite, or construct a cached-result reproduction.
- The repository was moving during discovery; all claims here are pinned to the revision above, not later `main`.
- The finding does not evaluate model quality, pass rates, framework adoption, Vercel's hosted sandbox, or any private deployment.
- A project may intentionally decide that some judge changes should not invalidate code-generation work. That does not justify treating the old *judged verdict* as if the new judge produced it; generation reuse and verdict reuse need separate identities.
- Repository stars and README claims are discovery signals, not evidence that the framework produces valid benchmarks in practice.

## Sources inspected

- [Repository metadata](https://api.github.com/repos/vercel-labs/agent-eval)
- [Pinned complete tree](https://github.com/vercel-labs/agent-eval/tree/0324efe41e77b4c90f80000e6f9c1bfeb1b76bcd)
- [README and evaluation contract](https://github.com/vercel-labs/agent-eval/blob/0324efe41e77b4c90f80000e6f9c1bfeb1b76bcd/README.md)
- [Fingerprint and refingerprint decisions](https://github.com/vercel-labs/agent-eval/blob/0324efe41e77b4c90f80000e6f9c1bfeb1b76bcd/packages/agent-eval/src/lib/fingerprint.ts)
- [Fingerprint tests](https://github.com/vercel-labs/agent-eval/blob/0324efe41e77b4c90f80000e6f9c1bfeb1b76bcd/packages/agent-eval/src/lib/fingerprint.test.ts)
- [CLI status and carry-forward path](https://github.com/vercel-labs/agent-eval/blob/0324efe41e77b4c90f80000e6f9c1bfeb1b76bcd/packages/agent-eval/src/cli.ts)
- [Result persistence and reuse scanner](https://github.com/vercel-labs/agent-eval/blob/0324efe41e77b4c90f80000e6f9c1bfeb1b76bcd/packages/agent-eval/src/lib/results.ts)
- [In-sandbox deterministic and agentic judge helpers](https://github.com/vercel-labs/agent-eval/blob/0324efe41e77b4c90f80000e6f9c1bfeb1b76bcd/packages/agent-eval/src/lib/agents/eval-helper.mjs)
- [Docker sandbox backend](https://github.com/vercel-labs/agent-eval/blob/0324efe41e77b4c90f80000e6f9c1bfeb1b76bcd/packages/agent-eval/src/lib/docker-sandbox.ts)

## Discovery and coverage

GitHub Repository Search API query: `"AI agent" in:name,description,readme pushed:>=2026-09-28 stars:>20`, sorted by updated descending with 30 results per page. The endpoint returned HTTP 200, `total_count: 4766`, and `incomplete_results: false`. This was one response page, not an exhaustive review of all matches. Scout selected `vercel-labs/agent-eval`, pinned revision `0324efe41e77b4c90f80000e6f9c1bfeb1b76bcd`, and inspected its complete 243-entry recursive tree (`truncated: false`) plus the files listed above.
