<ai_context>
summary: "Agent Scrub treats coding-agent transcripts, tool output, memory, file-history snapshots, and selected databases as additional secret copies. Its source models coverage gaps and active writers explicitly and verifies redaction against current bytes, but local redaction neither revokes a credential nor removes provider-side or backup copies."
triggers: ["Agent Scrub", "coding agent secrets", "transcript secret", "agent history redaction", "credential copies", "secret scan coverage"]
last_updated: "2026-10-03"
source_basis: "Static inspection of thesubtlety/agent-scrub revision 52609c48f26b9393c569028d22779cf51e78d157 after HN 49939584. Scout did not build or run the macOS application or tests and did not scan or modify real agent history."
</ai_context>

# Secret Cleanup Must Separate Copies, Credentials, and Coverage

**Date:** 2026-10-03  
**Disposition:** New knowledge  
**Coverage:** HN post plus pinned repository documentation, implementation, fixtures, and tests; no execution

## Question

What evidence is needed to claim that a secret copied into coding-agent history has been removed safely?

## Source observation

[HN 49939584](https://news.ycombinator.com/item?id=49939584) links [`thesubtlety/agent-scrub`](https://github.com/thesubtlety/agent-scrub), a macOS application for finding and redacting secrets in local coding-agent history. At pinned revision [`52609c48f26b9393c569028d22779cf51e78d157`](https://github.com/thesubtlety/agent-scrub/commit/52609c48f26b9393c569028d22779cf51e78d157), adapters enumerate conversation stores for Claude Code, Codex, Gemini CLI, editor assistants, and several other tools. The enumerated surfaces are broader than the visible chat: they include spilled tool results, subagent transcripts, persistent memory, shell snapshots, Claude file-history snapshots, and selected SQLite content.

The implementation supports a useful distinction: a secret in history is an **additional copy**, not necessarily the live credential. Known authentication and configuration stores such as Codex `auth.json` and Claude Code `.credentials.json` are deliberately excluded. Redacting a transcript therefore does not rotate or revoke the underlying key. The README also states that the tool cannot remove copies already sent to a model provider or placed in backups.

Its evidence model is more careful than a simple “zero matches” scan:

- unknown stores, unreadable content, and unsupported database schemas become explicit coverage gaps; a report is “verified clean” only when there are no occurrences and no gap that blocks that claim;
- findings in apparently active artifacts are deferred by default rather than racing the agent writer;
- a planned file edit rechecks inode, size, and the exact preimage before writing, then rereads the replacement and reparses the touched JSON record; changed bytes are not overwritten;
- variable-length JSON edits are assembled and atomically replace the file only after parse checks, while SQLite writes use schema-specific handlers; unknown schemas remain read-only; and
- verification rescans independently after redaction. Repository-authored tests cover multiple copies, active-artifact deferral, preimage changes, idempotent plan replay, parse preservation, busy databases, and unsupported-schema gaps.

These controls reduce corruption and overclaiming, but they do not prove credential containment. Pattern rules can miss unknown formats or produce false positives; excluded stores remain outside the cleanup claim; old filesystem snapshots, cloud sync, backups, provider retention, logs, and downstream tool effects may preserve other copies. Even a complete local rescan says nothing about whether the credential was used before cleanup.

## Reusable response contract

For a secret found in agent history, preserve five separate facts:

1. **credential identity and authority:** which key or token it is, what it can access, and whether it remains valid;
2. **copy inventory:** transcript, tool output, subagent history, memory, file snapshots, databases, logs, backups, sync, and provider-side retention;
3. **scan coverage:** inspected, deliberately excluded, unreadable, unknown-schema, and unsupported locations;
4. **mutation evidence:** active-writer status, expected file identity and preimage, write result, structural validation, and independent rescan; and
5. **containment evidence:** revocation or rotation, audit of use, provider or backup handling, and verification of consequential downstream effects.

A local redaction receipt should mean “these observed copies were replaced under these coverage limits.” It should not be promoted to “the secret is safe,” “the credential was never used,” or “all copies are gone.” For live systems, stop or coordinate writers before cleanup and rotate consequential credentials even when local redaction succeeds.

## Evidence limits

- Scout inspected selected files at one revision but did not build the Swift package, run its project-authored test suite, install the unsigned macOS application, grant Keychain or filesystem access, or scan real histories. The available environment was Linux and did not expose `swift`.
- The application’s no-network and local-processing statements were not independently verified through runtime traffic observation.
- Detection and adapter coverage can drift as agent storage layouts and credential formats change. The pinned store maps identify their own schema versions but do not establish coverage of later releases.
- HN 49939584 had one point and no comments in the retrieved item; it is discovery evidence, not independent validation.

## Primary sources

- **HN:** https://news.ycombinator.com/item?id=49939584
- **Repo:** https://github.com/thesubtlety/agent-scrub
- **Inspected revision:** [`52609c48f26b9393c569028d22779cf51e78d157`](https://github.com/thesubtlety/agent-scrub/commit/52609c48f26b9393c569028d22779cf51e78d157)
- **Primary files:** [README](https://github.com/thesubtlety/agent-scrub/blob/52609c48f26b9393c569028d22779cf51e78d157/README.md), [scan report and coverage rule](https://github.com/thesubtlety/agent-scrub/blob/52609c48f26b9393c569028d22779cf51e78d157/Sources/SecretDetection/ScanEngine.swift), [file redaction path](https://github.com/thesubtlety/agent-scrub/blob/52609c48f26b9393c569028d22779cf51e78d157/Sources/HistoryGuardCore/InPlaceRedactor.swift), [Codex store map](https://github.com/thesubtlety/agent-scrub/blob/52609c48f26b9393c569028d22779cf51e78d157/Sources/CodexAdapter/CodexStores.swift), [Claude Code store map](https://github.com/thesubtlety/agent-scrub/blob/52609c48f26b9393c569028d22779cf51e78d157/Sources/ClaudeCodeAdapter/ClaudeStores.swift), [Codex redaction tests](https://github.com/thesubtlety/agent-scrub/blob/52609c48f26b9393c569028d22779cf51e78d157/Tests/CodexAdapterTests/CodexRedactionTests.swift), and [Claude Code redaction tests](https://github.com/thesubtlety/agent-scrub/blob/52609c48f26b9393c569028d22779cf51e78d157/Tests/ClaudeCodeAdapterTests/RedactionTests.swift)

## Library comparison

Scout searched the candidate library case-insensitively for the repository URL, project name, HN item, coding-agent history, and session-secret terms. No existing note declared this repository or HN item as a primary source. Existing secret and sandbox notes address credential custody and runtime authority; this source adds a distinct post-exposure cleanup contract built around copy inventory, mutation safety, and coverage-qualified verification.
