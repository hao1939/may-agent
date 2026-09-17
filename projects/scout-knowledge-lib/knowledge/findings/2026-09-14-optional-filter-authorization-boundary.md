<ai_context>
This finding documents a pinned GitHub implementation in which authorization based only on explicitly supplied resource arguments was insufficient for collection-wide tools. It separates repository evidence from the broader design inference and does not claim independent security validation.
</ai_context>

# Optional filters are not authorization boundaries

**Date:** 2026-09-14  
**Source:** GitHub  
**Repo:** [tddh/clum](https://github.com/tddh/clum)  
**Pinned revision:** [`c4f71905127ac5a478a01b1758ddc4b7f1c0c520`](https://github.com/tddh/clum/commit/c4f71905127ac5a478a01b1758ddc4b7f1c0c520)

## Finding

Clum, an MCP-facing terminal and host-management project, records a concrete authorization failure mode in its design invariants: `search_recordings` previously omitted group isolation, so a restricted key could search and decrypt recordings across groups when it did **not** supply the optional `host` argument. The important boundary is not specific to terminal recordings. A pre-dispatch check that validates only resource identifiers present in request arguments cannot constrain a tool whose omitted filter means “all resources.”

The pinned implementation makes the repair inspectable:

- [`authorize()`](https://github.com/tddh/clum/blob/c4f71905127ac5a478a01b1758ddc4b7f1c0c520/crates/clum-mcp/src/tools/mod.rs#L117-L160) checks explicit `host` and `hosts` arguments, but cannot by itself scope an unfiltered collection operation.
- The [`search_recordings` dispatch branch](https://github.com/tddh/clum/blob/c4f71905127ac5a478a01b1758ddc4b7f1c0c520/crates/clum-mcp/src/tools/mod.rs#L464-L490) independently derives the caller group's allowed-host set and passes it into the search implementation even when the caller omitted `host`.
- The empty-set case is handled explicitly as a zero-result response. This matters because the search helper defines [`None` as unrestricted](https://github.com/tddh/clum/blob/c4f71905127ac5a478a01b1758ddc4b7f1c0c520/crates/clum-mcp/src/tools/search.rs#L176-L186); accidentally converting “caller has no allowed hosts” into absence of a filter would fail open.
- The project's [`GROUP_SCOPED_TOOLS`](https://github.com/tddh/clum/blob/c4f71905127ac5a478a01b1758ddc4b7f1c0c520/crates/clum-mcp/src/tools/mod.rs#L163-L188) list is explicitly documented as a design anchor and debug self-check, **not** a runtime enforcement mechanism. Enforcement remains in each tool's dispatch branch.

Clum's [invariants document](https://github.com/tddh/clum/blob/c4f71905127ac5a478a01b1758ddc4b7f1c0c520/clum-docs/INVARIANTS.md#6-%E5%AE%A1%E8%AE%A1%E5%BD%95%E5%88%B6%E7%B1%BB%E5%B7%A5%E5%85%B7%E5%BF%85%E9%A1%BB%E7%BB%84%E9%9A%94%E7%A6%BBgroup_scoped_tools) preserves the historical reason for this duplication. That is useful evidence of intent, while the pinned dispatch and filtering code is the implementation evidence. This repository observation is not an independent audit of every path.

## Design implication

For list, search, export, aggregate, and “all” operations, authorization should produce a mandatory server-derived resource scope before business logic runs. Request filters may narrow that scope but must never create it. The type or API contract should distinguish at least:

1. **Unrestricted principal** — intentionally no scope restriction.
2. **Restricted principal with a non-empty allowed set** — intersect caller filters with that set.
3. **Restricted principal with an empty allowed set** — return no resources or deny; never encode this as a missing filter.

A registry of sensitive tools is still valuable for review coverage, but a registry assertion is not enforcement unless dispatch is structurally required to consume an authorization result. Tests should therefore exercise omitted filters and empty allowed sets, not only explicit unauthorized IDs.

## Why it matters for agents

Agent tools often expose optional selectors because models work better with forgiving schemas. That convenience creates a dangerous semantic mismatch: omission frequently broadens retrieval, while generic middleware only validates arguments that exist. As agents gain search over traces, memories, recordings, artifacts, or tenant-wide resources, the no-filter path becomes a first-class authorization case rather than an input-validation edge case.
