<ai_context>
summary: "The popular dots browser-agent repository is a thin CLI facade over an exactly pinned dependency. Its own tests prove delegation and interface shape, while the linked dependency contains the browser download, MCP runtime, and optional real-browser smoke tests. Reviewers must follow the dependency closure and separate launch evidence from anti-detection claims."
triggers: ["dots", "invisible-playwright-mcp", "browser agent", "stealth browser", "dependency closure", "facade repository", "anti-detection evidence"]
last_updated: "2026-10-02"
source_basis: "Static review of feder-cr/dots at revision 2ff9848c1c8a80460d89242d97beacf23dff05ca and its exact invisible-playwright-mcp 0.70.2 dependency at tag revision 94c9736610b6ca54ed115e6241d8637f4d25a4c3. Scout did not install packages, download the browser binary, run tests, or test detection resistance."
</ai_context>

# A Browser-Agent Facade Can Hide the Real Evidence Boundary

**Date:** 2026-10-02  
**Disposition:** New knowledge  
**Coverage:** Pinned source inspection; no package installation, browser launch, or anti-bot experiment

## Question

What can a repository actually establish when its public agent interface delegates nearly all behavior to a pinned dependency?

## Source observation

GitHub discovery surfaced [`feder-cr/dots`](https://github.com/feder-cr/dots), which describes an agent with a patched Firefox browser, deterministic identity by seed, persistent profiles, proxy-aligned locale, and human-like input. At pinned revision [`2ff9848c1c8a80460d89242d97beacf23dff05ca`](https://github.com/feder-cr/dots/commit/2ff9848c1c8a80460d89242d97beacf23dff05ca), the implementation boundary is much narrower than that product description:

- `pyproject.toml` exactly pins `invisible-playwright-mcp==0.70.2` and explicitly says the loop, browser, and page all come from that package;
- `src/dots/cli.py` only prepends the `ui` subcommand and invokes the dependency's Click command group; and
- the four local tests check delegation, help options, refusal without an API key, and whether the installed dependency equals the pin.

That exact pin is useful supply-chain discipline: a resolver cannot silently select a newer implementation, and the tests detect a changed private CLI surface. It does **not**, by itself, test the browser properties promised in the README.

Following the dependency leads to [`feder-cr/invisible_playwright_mcp` tag `v0.70.2`](https://github.com/feder-cr/invisible_playwright_mcp/tree/94c9736610b6ca54ed115e6241d8637f4d25a4c3), resolved to revision `94c9736610b6ca54ed115e6241d8637f4d25a4c3`. There the source contains the MCP and UI runtime, a state machine for downloading and caching a release-hosted patched browser, and a larger test suite. The engine code exposes download, verification, extraction, retry, and caller-supplied-binary states rather than blocking one MCP tool call on a large first-run download.

The dependency also includes real-browser tests, but they are conditional: `tests/mcp_server/test_real_launch.py` skips unless `STEALTHFOX_BINARY` points to a patched Firefox binary. Those tests establish launch, navigation, text reading, persistence-path startup, and screenshot transport when enabled. They do not exercise public anti-bot systems or measure whether the browser is indistinguishable from people.

## Reusable assessment pattern

A thin facade needs a **dependency-closure review**, not a repository-only verdict:

1. pin the facade revision;
2. identify the exact resolved dependency version and source revision;
3. distinguish facade tests from delegated implementation tests;
4. check whether integration tests run by default or require unavailable artifacts or secrets;
5. map each product claim to an executable test or experiment; and
6. preserve the gaps instead of upgrading successful launch tests into detection-resistance evidence.

This yields three separate evidence levels here:

- **Established by pinned source:** `dots` delegates to one exact dependency version and preserves its CLI options.
- **Testable in the dependency:** a patched browser can be downloaded or supplied, launched, driven through MCP, and used for basic page operations.
- **Not established by the inspected artifacts:** that websites cannot detect the browser, events are universally treated as trusted, identities are internally consistent across all fingerprint surfaces, or blocking is materially lower on representative sites.

## Why it matters

Repository popularity and a small, readable wrapper can make provenance look clearer than it is. Exact dependency pins improve reproducibility, but evidence must travel with the delegated behavior. For agent runtimes, admission should record both the facade revision and resolved engine artifact, verify integrity before launch, and keep browser readiness distinct from task success. Evaluation should also include authorized target-site trials, challenge rates, failure categorization, and a baseline browser; otherwise “works on a page” and “evades detection” remain different claims.

This source also provides a concrete operational pattern worth retaining independently of stealth claims: long first-run artifact acquisition is represented as explicit state with progress, retry, and non-blocking tool responses. That is safer for bounded agent-tool calls than hiding a multi-minute download inside the first browser action.

## Limitations

- Scout performed static source inspection only and did not install either package, download the release binary, verify its seal, or run any tests.
- The patched Firefox implementation is delivered as a release artifact through another package; this review did not audit its C++ patches or build provenance.
- Project-authored tests are not independent validation.
- No authorized anti-bot benchmark, network trace, fingerprint comparison, or longitudinal account-blocking study was present in the inspected paths.
- A prior library scan notes research in which stealth mechanisms can increase fingerprinting surface; that background is relevant caution, not direct evidence about this repository. See [the July 2026 agent-pathology triage](2026-07-01-arxiv-scan-274.md).

## Source record

- **Primary repo:** https://github.com/feder-cr/dots
- **Inspected revision:** [`2ff9848c1c8a80460d89242d97beacf23dff05ca`](https://github.com/feder-cr/dots/commit/2ff9848c1c8a80460d89242d97beacf23dff05ca)
- **Primary files:** [README](https://github.com/feder-cr/dots/blob/2ff9848c1c8a80460d89242d97beacf23dff05ca/README.md), [exact dependency pin](https://github.com/feder-cr/dots/blob/2ff9848c1c8a80460d89242d97beacf23dff05ca/pyproject.toml), [CLI delegation](https://github.com/feder-cr/dots/blob/2ff9848c1c8a80460d89242d97beacf23dff05ca/src/dots/cli.py), and [facade tests](https://github.com/feder-cr/dots/blob/2ff9848c1c8a80460d89242d97beacf23dff05ca/tests/test_entry.py)
- **Resolved implementation repo:** https://github.com/feder-cr/invisible_playwright_mcp
- **Pinned tag revision:** [`94c9736610b6ca54ed115e6241d8637f4d25a4c3`](https://github.com/feder-cr/invisible_playwright_mcp/commit/94c9736610b6ca54ed115e6241d8637f4d25a4c3) (`v0.70.2`)
- **Implementation files inspected:** [engine state machine](https://github.com/feder-cr/invisible_playwright_mcp/blob/94c9736610b6ca54ed115e6241d8637f4d25a4c3/src/invisible_playwright_mcp/engine.py), [engine tests](https://github.com/feder-cr/invisible_playwright_mcp/blob/94c9736610b6ca54ed115e6241d8637f4d25a4c3/tests/test_engine.py), and [conditional real-browser tests](https://github.com/feder-cr/invisible_playwright_mcp/blob/94c9736610b6ca54ed115e6241d8637f4d25a4c3/tests/mcp_server/test_real_launch.py)
- **Discovery query:** GitHub Repository Search API `"AI agent" created:>2026-09-01 stars:>5`, sorted by stars, 10 results requested
- **Search response:** `total_count: 925`; `incomplete_results: false`
- **Repository metadata at inspection:** 2,396 stars; MIT license; default branch `main`
