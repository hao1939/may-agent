<ai_context>
summary: "Pinned-source assessment of Multi-Forge's cross-runtime semantic supervisor. The implementation usefully records review starts before dispatch and distinguishes completed, unavailable, incomplete, and cached outcomes, but a high-confidence divergent verdict can block on the presence of an unverified citation string."
triggers: ["Multi-Forge", "cross-runtime supervision", "semantic supervisor", "review attempt", "fail open", "citation verification", "policy evidence", "cached verdict"]
last_updated: "2026-10-17"
source_basis: "GitHub repository search plus static inspection of hapa1i/multi-forge at commit 09984440f481d81c01ca2c742e77f627d0202edb. Scout did not install or execute the package, tests, agent runtimes, models, proxies, or provider services."
</ai_context>

# Cross-runtime supervision needs attempt evidence, not only a verdict

**Date:** 2026-10-17  
**Disposition:** New source-grounded finding  
**Repo:** https://github.com/hapa1i/multi-forge  
**Inspected revision:** [`09984440f481d81c01ca2c742e77f627d0202edb`](https://github.com/hapa1i/multi-forge/commit/09984440f481d81c01ca2c742e77f627d0202edb)

## Question

What does a current implementation reveal about making one coding-agent runtime supervise another runtime's edits, and which evidence is needed to distinguish an actual review from a warning, cache reuse, or failed review attempt?

## Source observation

Multi-Forge describes itself as a research-preview control plane for Claude Code and Codex. Its README says a managed session can send each Write/Edit through a read-only cross-vendor supervisor, carry the supervisor lane across session operations, and reuse a short-lived verdict for exact repeats. Running either agent directly bypasses this managed policy path, so this is a mediated-route design rather than ambient enforcement over every process.

The pinned implementation makes a particularly useful distinction between **the policy decision** and **evidence that a review attempt occurred**:

- `run_supervisor_check()` creates a durable `ReviewAttempt` before model dispatch.
- The record includes an attempt ID, action identity, session and run correlation, target and plan identity, reviewer lane/model, purpose (`live` or `shadow`), start and deadline, and later the terminal state and verdict.
- A successful decision finishes as `completed`. A fail-open or typed failure finishes as `unavailable` and does not retain a verdict as though review succeeded.
- If the writer disappears or the deadline passes while the record is still pending, the read projection reports `incomplete`; it does not rewrite the record into success.
- Cache reuse creates a new attempt record marked `cached`, explicitly avoiding the fiction that another model invocation occurred.
- If evidence finalization fails after a policy decision was computed, the code preserves the decision and adds an `evidence_unavailable` diagnostic rather than silently claiming a fully evidenced review.

This yields four materially different facts that ordinary `allow`/`deny` telemetry often collapses: a fresh completed review, a cached reuse, an operationally unavailable review that failed open, and an interrupted attempt with uncertain completion.

## The remaining citation boundary

The verdict parser degrades empty, unparseable, malformed-confidence, Boolean-confidence, and non-finite-confidence responses to warnings or typed fail-open outcomes. A divergent verdict blocks only at confidence `>= 0.8` and when at least one nonblank citation string is present. The code also checks whether citation text is an exact substring of the captured plan snapshot and stores the result as `verified_citations`, avoiding a time-of-check reread of a changed plan.

However, the blocking threshold tests whether the raw citation list is nonempty, **not** whether `verified_citations` is nonempty. The source comment is explicit that citation verification selects feedback text and does not change the existing block bar. Therefore a high-confidence model response with a fabricated but nonblank plan quote can still produce `deny`; exact citation verification is diagnostic metadata rather than admission evidence.

That is not equivalent to the fail-open parsing behavior. The parser handles malformed transport/model output conservatively, while a structurally valid but unsupported semantic claim can still block. A stronger supervisor contract would type these separately:

1. **Reviewer outcome:** aligned, divergent, or unavailable.
2. **Evidence support:** no citation, citation supplied, or citation verified against the pinned plan snapshot.
3. **Execution provenance:** fresh invocation, exact cache reuse, or interrupted attempt.
4. **Effect authority:** warn, deny, or admit, derived from an explicit policy over the first three axes.

For an enforcement-grade route, `deny` should require the configured evidence grade—such as at least one verified snapshot citation—rather than merely preserving verification as feedback metadata. Shadow or advisory modes can retain weaker, unsupported divergences without letting them impersonate an evidenced block.

## Relevance to May-style agent control planes

The reusable pattern is not “use a second model.” It is to persist a review start before dispatch and reconcile the attempt independently from the verdict. That prevents model output, process failure, cache reuse, and evidence-write failure from becoming one ambiguous policy event. For a task-oriented control plane, analogous records would bind the candidate/action identity, governing snapshot, reviewer lane, attempt purpose, deadline, cache lineage, decision, evidence grade, and final admission effect.

The implementation also shows why a passing parser or successful reviewer call is not enough: source-grounded support and effect admission remain separate decisions. Verified citations can improve feedback and auditability only if the admission policy actually consumes their verification status.

## Evidence inspected

- [README and research-preview boundary](https://github.com/hapa1i/multi-forge/blob/09984440f481d81c01ca2c742e77f627d0202edb/README.md)
- [supervisor dispatch, fail-open classification, and attempt finalization](https://github.com/hapa1i/multi-forge/blob/09984440f481d81c01ca2c742e77f627d0202edb/src/forge/policy/semantic/supervisor.py)
- [verdict parsing, confidence threshold, and citation handling](https://github.com/hapa1i/multi-forge/blob/09984440f481d81c01ca2c742e77f627d0202edb/src/forge/policy/semantic/verdict.py)
- [durable attempt state and read-time incomplete projection](https://github.com/hapa1i/multi-forge/blob/09984440f481d81c01ca2c742e77f627d0202edb/src/forge/policy/semantic/attempts.py)
- [malformed-confidence regression cases](https://github.com/hapa1i/multi-forge/blob/09984440f481d81c01ca2c742e77f627d0202edb/tests/regression/test_bug_d002_supervisor_confidence_fail_open.py)

## Limitations

This is static source inspection at one pinned commit. Scout did not install or run Multi-Forge, its tests, Claude Code, Codex, any model or provider, the proxy paths, or an actual supervised edit. The repository labels itself a research preview and warns that APIs, commands, and file formats can change. The GitHub Search API response reported `incomplete_results: false`, but the query is discovery evidence rather than a census of agent runtimes. Repository metadata, code, and project-authored tests do not prove production reliability, route completeness, reviewer quality, or that every write effect is mediated.

## Discovery record

GitHub Repository Search API query:
`"agent runtime" AI in:name,description,readme`, sorted by `updated` descending, 10 results. The endpoint returned HTTP 200 and `incomplete_results: false`. Multi-Forge was then inspected at the pinned revision above.
