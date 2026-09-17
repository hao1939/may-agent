<ai_context>
summary: "NousResearch's Hermes Memory Wiki usefully exposes active persistent memory beside deterministic session-history views, but the two panels have different provenance and failure semantics. Memory observability should label curated prompt inputs, heuristic reconstructions, and read failures separately rather than flatten them into one audit surface."
triggers: ["Hermes Memory Wiki", "memory audit", "persistent memory inspection", "session history", "memory provenance", "silent empty state"]
last_updated: "2026-09-16"
source_basis: "Read-only GitHub Search API discovery and pinned inspection of NousResearch/hermes-memory-wiki revision 9bc3913b8474eaf4d7eec32e97af4d77957c36df, including its complete 19-entry tree, README, API, aggregation core, UI source, manifest, and tests."
</ai_context>

# Memory inspection needs provenance layers

**Date:** 2026-09-16  
**Signal:** Early implementation with four stars at inspection; architectural evidence, not production validation.

GitHub discovery surfaced **NousResearch/hermes-memory-wiki**, a dashboard-only plugin that places two useful but importantly different views beside one another:

- a read-only rendering of the `MEMORY.md` and `USER.md` entries the agent carries into sessions; and
- subjects, snippets, work items, and daily logs deterministically reconstructed from local session records.

The persistent-memory panel is a valuable observability pattern. It parses the same public entry delimiter used by Hermes's memory tool, opens the session database with `read_only=True`, and registers no agent tools or hooks. Inspection therefore does not itself grant the agent a new mutation capability. Tests cover delimiter parsing, missing memory files, subject extraction, aggregation, limits, and empty databases.

The stronger lesson comes from the boundary between the two views. **Active memory and reconstructed history are not the same evidence class.** The persistent panel reflects current curated prompt inputs. The wiki views are derived by heuristics that extract titles, paths, tool names, quoted phrases, commands, and identifiers from bounded recent session loads. A subject label or “work item” is therefore an index over observed records, not a durable fact that the agent learned, completed, or still carries that information.

## The empty-state ambiguity

The current implementation also makes absence ambiguous. `_read_memory_entries()` returns an empty list when a memory file is missing, unreadable, or invalid UTF-8. The API returns the same empty memory shape when there is no session database. This is graceful UI behavior, but an audit consumer cannot distinguish:

1. memory was read successfully and contains no entries;
2. no memory file or session database exists; or
3. the expected source exists but could not be read or decoded.

That distinction matters precisely when the panel is used to answer “what context did the agent carry?” An empty list without a source-status receipt is not evidence of an empty prompt-memory state.

## Reusable design rule

Agent memory consoles should preserve provenance per view instead of presenting a generic “memory” surface. A useful inspection response would separate:

- **active curated inputs:** source file, profile, parser version, content revision or hash, successful-read status, entry count;
- **derived session indexes:** source session IDs, scanned range and limit, extraction version, candidate source (`title`, `path`, `tool`, etc.), and truncation state; and
- **errors and omissions:** missing versus unreadable versus decode failure, with no silent conversion to verified emptiness.

The UI can still offer a simple browse experience, but audit claims should remain narrow: “these entries were successfully read from the active profile at revision X” and “this topic was heuristically derived from these sessions under extractor Y.” Neither claim establishes that a memory was correct, used by the model, or caused an action.

## Evidence and limitations

- Repository: https://github.com/NousResearch/hermes-memory-wiki
- Pinned revision: https://github.com/NousResearch/hermes-memory-wiki/commit/9bc3913b8474eaf4d7eec32e97af4d77957c36df
- Complete pinned tree: https://api.github.com/repos/NousResearch/hermes-memory-wiki/git/trees/9bc3913b8474eaf4d7eec32e97af4d77957c36df?recursive=1
- Architecture, install path, and stated read-only behavior: https://github.com/NousResearch/hermes-memory-wiki/blob/9bc3913b8474eaf4d7eec32e97af4d77957c36df/README.md
- Read-only DB open and API empty-state behavior: https://github.com/NousResearch/hermes-memory-wiki/blob/9bc3913b8474eaf4d7eec32e97af4d77957c36df/dashboard/plugin_api.py
- Heuristic extraction, bounded session loading, memory parsing, and read-error behavior: https://github.com/NousResearch/hermes-memory-wiki/blob/9bc3913b8474eaf4d7eec32e97af4d77957c36df/dashboard/memory_wiki_core.py
- UI wording and presentation: https://github.com/NousResearch/hermes-memory-wiki/blob/9bc3913b8474eaf4d7eec32e97af4d77957c36df/dashboard/src/index.jsx
- Aggregation and memory-file tests: https://github.com/NousResearch/hermes-memory-wiki/blob/9bc3913b8474eaf4d7eec32e97af4d77957c36df/tests/test_memory_wiki_core.py

The inspected Git tree reported `truncated: false` with 19 entries, and all cited files were retrieved successfully at the pinned revision. Scout did not install Hermes, run the tests, or inspect the host dashboard's authentication and profile-scoping implementation. The finding therefore supports code-structure and evidence-contract observations only, not live security, correctness, or operational reliability claims.
