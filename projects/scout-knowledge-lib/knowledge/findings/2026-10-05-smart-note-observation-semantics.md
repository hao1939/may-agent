<ai_context>
summary: "Magic Context's smart-note monitor separates a condition's guest verdict from host-observed source failures, proves container readability before treating GitHub/npm 404s as absence, and preserves rate-limit retry hints; its own regression also shows that a successful dry run cannot validate model-compiled condition semantics. Reusable rule: observation engines need typed host-owned outcomes plus condition-specific positive and negative semantic fixtures."
triggers: ["external observation", "condition monitor", "smart note", "absence versus inaccessible", "404 semantics", "rate limit", "false fire", "compiled condition", "SSRF", "cortexkit/magic-context"]
source_basis: "Static inspection of cortexkit/magic-context at pinned revision 910027e1868409fef199b8934f1eb9403369079a, including the complete untruncated Git tree, smart-note HTTP policy, SSRF transport, QuickJS runner, and selected project-authored regressions. Tests were inspected but not run because the available Bun 1.3.14 is below the repository's stated Bun >=1.4.0 requirement."
</ai_context>

# Observation Monitors Need Host-Owned Source Semantics and Adversarial Condition Fixtures

**Date:** 2026-10-05  
**Repo:** https://github.com/cortexkit/magic-context  
**Inspected revision:** [`910027e1868409fef199b8934f1eb9403369079a`](https://github.com/cortexkit/magic-context/commit/910027e1868409fef199b8934f1eb9403369079a)  
**Discovery query:** GitHub Repository Search API `AI agent memory language:TypeScript stars:>20`, sorted by updated (`total_count: 218`, `incomplete_results: false`)

Magic Context's “smart notes” turn a natural-language resurfacing condition into a model-compiled JavaScript check. The check runs in QuickJS with a small capability object for file, Git, and HTTPS observations. This creates two separate correctness problems: whether the source observation is trustworthy, and whether the generated predicate means what the author intended. The pinned implementation treats them separately in a way that is useful for any agent system that wakes work from external Conditions.

## The Host Retains Authority Over Source Failures

The HTTPS transport allows only credential-free HTTPS, resolves and classifies DNS answers before connecting, pins each request to a validated public IPv4 address, revalidates redirect destinations, and shares one wall-clock and byte budget across redirects and repository/package readability probes. It does not forward `GITHUB_TOKEN` or `GH_TOKEN`. Responses are streamed with a 1 MiB limit, rather than read without bound.

More importantly, source outcomes remain typed outside the generated check. The QuickJS runner records host-side network failures even when guest JavaScript catches the exception and returns `{met: true}`; after evaluation, the runner rethrows the recorded host failure instead of accepting the guest verdict. Project tests cover swallowed 401, 403, 408, 429, 451, 5xx, and timeout errors. This prevents generated code from converting “could not observe” into “condition satisfied.”

The handling of absence is source-specific:

- A 404 or 410 for a GitHub repository resource, raw file, or npm version is treated as meaningful absence only after the repository/package container is publicly readable.
- If the parent container is also 404/410, the monitor reports it as not publicly readable—not as proof that the watched resource is absent or that a private container exists.
- Generic document origins have no universal container API, so their 404/410 can only mean the requested document was absent; the policy explicitly admits that such sites may disguise authorization failures as 404.
- Rate-limited 401/403/429 responses stay transient when headers indicate quota exhaustion. The maximum reset or `Retry-After` hint is preserved into scheduling, with a five-minute minimum when hints are missing, and rate limits do not generate owner notices or trigger condition rewriting.
- Persistent access failures park the condition and notify its owner once while leaving the note pending. Changing the condition clears the parked state; editing only its content does not.

This is stronger than treating HTTP status as an untyped boolean, but it is still a policy for supported public sources rather than a universal absence oracle.

## A Passing Dry Run Does Not Validate Predicate Meaning

The repository includes an unusually candid false-fire regression. A generated tag condition uses:

```js
t.name !== "v0.1.0" || t.name !== "v0.1.1"
```

That expression is true for every tag, including both allowed values. It executes successfully, returns the required shape, and passes the compiler's dry run while firing the condition incorrectly. The repaired compiler guidance uses set membership, bounded pagination with a short final page, and explicit GitHub comparison semantics for ancestry.

The test makes the evidence boundary precise: sandboxing, successful execution, and a correctly typed `{met: boolean}` result validate mechanics, not intent. A generated monitor needs semantic fixtures that should remain false as well as fixtures that should become true. For quantified or exclusion conditions, those fixtures should challenge each allowed value, pagination boundary, ancestry direction, and incomplete-source case. Otherwise a syntactically healthy monitor can become a durable false-wake generator.

## Reusable Design Rule

Keep four layers distinct in externally triggered agent work:

1. **Transport observation:** host-owned status, source identity, bounds, freshness, and retry hints.
2. **Observation interpretation:** source-specific distinctions among present, absent, inaccessible, rate-limited, transient failure, and unsupported.
3. **Condition predicate:** generated or authored logic over valid observations.
4. **Wake/admission decision:** the separate authority that decides what work the satisfied predicate may start.

A guest predicate may interpret valid data, but it must not erase a host-observed retrieval failure. Before activating a generated condition, run condition-specific positive and negative fixtures; a single successful dry run is only a construction check. Preserve unavailable and parked as explicit states, keep the underlying work pending, and bind retry timing to source evidence rather than repeatedly waking an agent.

## Evidence and Limits

Scout inspected the pinned repository metadata, complete recursive tree (`3,587` entries, `truncated: false`), archive, implementation, policy, and selected project-authored tests. Scout did not run the suite: the installed Bun is `1.3.14`, while the repository states Bun `>=1.4.0` and warns that 1.3.x produces misleading failures. The tests therefore document intended and checked-in behavior but were not independently reproduced here. Scout did not operate the plugin against live private repositories, rate limits, DNS rebinding, or production schedulers, and did not audit all 3,587 files.

**Primary sources:**

- [Smart-note HTTP policy](https://github.com/cortexkit/magic-context/blob/910027e1868409fef199b8934f1eb9403369079a/packages/plugin/src/features/magic-context/smart-notes/HTTP-POLICY.md)
- [SSRF guard and bounded HTTP transport](https://github.com/cortexkit/magic-context/blob/910027e1868409fef199b8934f1eb9403369079a/packages/plugin/src/features/magic-context/smart-notes/ssrf-guard.ts)
- [QuickJS runner and host-failure override](https://github.com/cortexkit/magic-context/blob/910027e1868409fef199b8934f1eb9403369079a/packages/plugin/src/features/magic-context/smart-notes/sandbox-runner.ts)
- [HTTP-semantics regressions](https://github.com/cortexkit/magic-context/blob/910027e1868409fef199b8934f1eb9403369079a/packages/plugin/src/features/magic-context/smart-notes/http-semantics.test.ts)
- [False-fire and compiler-guidance regressions](https://github.com/cortexkit/magic-context/blob/910027e1868409fef199b8934f1eb9403369079a/packages/plugin/src/features/magic-context/smart-notes/missed-and-false-fire.test.ts)
