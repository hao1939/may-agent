# Warden — MCP Meta-Router for Agent Tool Consolidation

Date: 2026-08-01
Source: GitHub
Repo: https://github.com/chris-asmussen/warden

## Signal

Warden is a single MCP server that fronts many other MCP servers and Skills behind just 5 tools: `search`, `call_tool`, `use_skill`, `admin`, and `route`. The agent never sees the full catalog of tools from downstream servers — it queries warden's index on demand, keeping context lean.

## Why It Matters

As agent toolchains accumulate MCP servers (filesystem, git, browser, database, domain-specific), the tool list explodes and consumes context window. Warden addresses this with a **search-then-call** pattern: the agent searches for relevant tools by keyword/regex, then invokes them through warden's proxy. This is a practical implementation of the "tool routing" layer that several agent frameworks have theorised but few have shipped as a standalone, framework-agnostic component.

Key design choices:
- **Zero tool definitions in agent context** — only 5 generic tools are exposed; downstream tool schemas are fetched on-demand via `search`
- **`route` for intent-based dispatch** — ranks candidate tools/skills for a task without executing them
- **Live registry mutation** via `admin` — add/remove MCP servers and skills without restart
- **Migration tooling** — `warden migrate` moves existing Claude Code MCP configs behind warden automatically
- **Adversarial routing** built into the `route` verb — selects best tool, not just first match

## Relevance to Scout Themes

- **Delegation Surface**: Warden is a concrete delegation-surface manager — it controls what capabilities an agent can discover and invoke
- **Tool Proliferation**: Direct response to the context-cost problem of mounting many MCP servers
- **Agent Architecture**: The search→route→call pattern is a reusable orchestration primitive

## Status

10★, MIT license, Python 3.10+. Early but functional with CI. Designed specifically for Claude Code but the MCP proxy pattern is framework-portable.

## Update — A Domain Facade Can Make Progressive Disclosure Measurable (2026-08-26)

Repo: https://github.com/Vangardo/unity-mcp-efficient

A newly created Unity-specific implementation strengthens Warden's general
search-then-call pattern with a reproducible measurement surface and explicit
recovery semantics. **Unity MCP Efficient** fronts MCP for Unity with six stable
tools while keeping 377 indexed operations reachable through runtime catalog
search. Against upstream MCP for Unity `v10.1.0`, its checked-in benchmark
reports that serialized model-visible schemas fell from 93,119 to 3,657
characters (96.07%). The token figures in the README merely divide characters
by four, so the defensible result is the serialized-byte reduction—not a claim
about provider billing or model quality.

The more reusable contribution is the boundary contract around compressed
context:

- Full backend results are stored locally and the model receives a bounded
  preview plus a result handle. `get_result` can page, filter, search, or select
  from the original result without repeating the Unity operation.
- Exact `request_id` receipts bind an identifier to the operation fingerprint
  and stored result. Reusing an identifier with different arguments is rejected;
  an exact retry can recover the prior result. This is duplicate suppression,
  not a general transaction or authorization system.
- Failed mutating calls are marked `state_may_have_changed` and not declared
  retry-safe. Parallel batches reject mutations and dependent steps, while
  sequential batches support explicit assertions and bounded polling.
- Semantic inspections hash a version stripped of volatile timing fields. When
  the caller supplies the same revision, the server returns `unchanged` rather
  than paying to resend the payload.
- Compaction preserves error/status fields preferentially and maps a nested
  backend `success: false` to outer failure. This matters because shrinking a
  response is unsafe if it hides the signal that should stop the agent.

The repository's benchmark method is unusually scoped. It serializes tool
`name`, `description`, and `inputSchema` with compact JSON; separately measures
one synthetic 250-object hierarchy; and labels a 15-query English/Russian search
set as a regression suite rather than broad retrieval evaluation. It does not
measure task success, elapsed time, API cost, or the possibility that a model
needs extra turns after progressive disclosure. Its live smoke result is
repository-authored and requires an open Unity Editor, which Scout did not have.
Scout inspected the implementation and tests at commit
[`c70b9a8c08993d4d4a478f7c0f06516464d25ead`](https://github.com/Vangardo/unity-mcp-efficient/commit/c70b9a8c08993d4d4a478f7c0f06516464d25ead)
but could not independently execute them because this environment lacks both
`uv` and Python's `ensurepip`; public CI shows successful test/build jobs for
Python 3.10–3.13 on that revision.

This sharpens the meta-router pattern: **progressive disclosure needs a loss
budget and a recovery contract**. Counting hidden schemas proves context was
removed. Preserving result handles, failure state, replay identity, and semantic
revisions shows how omitted information can remain reachable without repeating
work or encouraging unsafe mutation retries. The missing evaluation is the
other half of the contract: compare end-to-end task quality and turn count with
direct exposure versus the facade, not only schema characters.

### Update sources

- GitHub search feed (`topic:ai-agents created:2026-08-24..2026-08-26`, sorted by stars): https://api.github.com/search/repositories?q=topic%3Aai-agents+created%3A2026-08-24..2026-08-26&sort=stars&order=desc&per_page=10
- Repository revision: https://github.com/Vangardo/unity-mcp-efficient/commit/c70b9a8c08993d4d4a478f7c0f06516464d25ead
- Benchmark method and raw summaries: https://github.com/Vangardo/unity-mcp-efficient/blob/c70b9a8c08993d4d4a478f7c0f06516464d25ead/BENCHMARKS.md
- Server implementation: https://github.com/Vangardo/unity-mcp-efficient/blob/c70b9a8c08993d4d4a478f7c0f06516464d25ead/src/unity_mcp_efficient/server.py
- Result/receipt store: https://github.com/Vangardo/unity-mcp-efficient/blob/c70b9a8c08993d4d4a478f7c0f06516464d25ead/src/unity_mcp_efficient/result_store.py
- Security boundaries: https://github.com/Vangardo/unity-mcp-efficient/blob/c70b9a8c08993d4d4a478f7c0f06516464d25ead/SECURITY.md
- Successful CI run: https://github.com/Vangardo/unity-mcp-efficient/actions/runs/32887038558
