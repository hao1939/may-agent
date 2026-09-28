<ai_context>
This finding records a static inspection of Microsoft’s proposed AGT Studio sidecar security posture. Its reusable lesson is that loopback binding, browser headers, a Save-button allowlist, and API conformance are not authorization boundaries; local authoring needs independent host/origin checks, server-owned workspace authorization, concurrency-safe writes, and an audit design that can represent partial completion. The inspected document is explicitly a design gate, not shipped functionality.
</ai_context>

# AGT Studio: a local sidecar still crosses multiple trust boundaries

**Date:** 2026-09-28  
**Source:** GitHub repository search and pinned repository contents  
**Repo:** https://github.com/microsoft/agent-governance-toolkit  
**Inspected revision:** [`033c7b8c4fa7ecdf930d047b37658e3e04bd7a58`](https://github.com/microsoft/agent-governance-toolkit/tree/033c7b8c4fa7ecdf930d047b37658e3e04bd7a58)  
**Primary file:** [`docs/studio/sidecar-security-posture.md`](https://github.com/microsoft/agent-governance-toolkit/blob/033c7b8c4fa7ecdf930d047b37658e3e04bd7a58/docs/studio/sidecar-security-posture.md)  
**Coverage:** Static inspection of the complete security-posture document plus the Engine API contract and conformance document at the pinned revision. No code execution or security testing was performed.  
**Disposition:** New knowledge — the library mentioned the repository as a governance toolkit but did not cover this Studio-sidecar design or primary file.

## What the source says

Microsoft’s repository describes a future local authoring/visibility sidecar, `agt serve`, between a Studio UI and an Engine API adapter. The security-posture document is unusually explicit that it is a **proposed implementation gate**, not evidence that the sidecar or controls have shipped. It also says Engine API conformance does not certify sidecar authentication, browser isolation, or workspace authorization.

The proposed design separates several boundaries that “local-only” architectures often collapse:

- **Browser to loopback:** an untrusted page can send requests to loopback, while DNS rebinding can make an attacker-controlled hostname resolve there. Exact `Host` and `Origin` checks, fetch-metadata checks, and non-simple write requests are therefore required. Those browser defenses still do not identify or exclude a hostile same-user process.
- **Credential to route:** non-loopback operation would require an explicitly provisioned bearer credential and fail-closed startup, but the document blocks off-host use until transport and proxy isolation have a reviewed design. A token over plaintext HTTP is not treated as sufficient.
- **Sidecar to filesystem:** the loaded engine policy directory is not automatically an authorized Studio workspace. The server, rather than the UI or request, must own the canonical workspace allowlist and defend against traversal, symlink/junction, hard-link, and time-of-check/time-of-use escapes.
- **Authoring to runtime:** the v1 surface has 11 read-only operations and one write operation. Save remains default-off; reload is excluded. The document flags unresolved tension between local authoring, registry re-scan, and any possibility that saving could activate production policy.

The write path exposes two less obvious consistency requirements. First, the current registry implementation removes sibling formats before replacing the target, so a later failure can leave a partial mutation; all sibling effects must become transactional. Second, the save request lacks a version precondition, so the design blocks authoring until optimistic concurrency can prevent stale clients from overwriting external edits.

The proposed local audit model also distinguishes **failure before mutation** from **failure after mutation**. If intent cannot be logged durably, deny the write. If the file replacement succeeds but the outcome append fails, do not report success or pretend rollback occurred; return an indeterminate/partial-completion error and stop further writes until logging recovers. The source explicitly says this user-editable local log is not the repository’s Merkle-backed engine audit chain and provides no non-repudiation.

## Why this matters

A sidecar is not a security boundary merely because it binds to loopback, speaks a conforming API, or exposes a restricted UI. The reusable design pattern is to decompose “local agent governance” into independent authorities:

1. **network reachability** — who can connect;
2. **browser provenance** — which web origin initiated a request;
3. **credential scope** — which routes a verified client may invoke;
4. **workspace authority** — which filesystem roots and formats may change;
5. **runtime activation** — whether an authoring save can affect enforcement;
6. **evidence semantics** — whether a log proves intent, completion, or only a locally editable record.

These controls are non-substitutable. In particular, a client allowlist or hidden Save button cannot authorize an HTTP caller, operating-system permissions are only an upper bound rather than a selected-workspace policy, and an audit append after a mutation cannot retroactively make that mutation atomic.

## Limitations

This is design evidence, not implementation evidence. The inspected source itself marks token format, off-host transport, YAML-versus-JSON behavior, optimistic concurrency, and save-versus-reload semantics as unresolved maintainer decisions. This review did not run the adapter, inspect every implementation path, validate the repository’s star count, or test authentication, filesystem races, logging, TLS, proxy behavior, privacy, or API conformance. Repository metadata and documentation establish that the design exists; they do not establish that it works.

## Related library context

Earlier library scans tracked `microsoft/agent-governance-toolkit` as part of the emerging agent control-plane category, including [The Persistence Attack Surface](2026-07-11-hn-arxiv-github-scan-349.md). This finding narrows from category-level adoption to one concrete sidecar design and preserves the source’s distinction between proposed controls and shipped behavior.
