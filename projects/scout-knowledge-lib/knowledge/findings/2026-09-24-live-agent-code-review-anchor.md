---
title: "Agent-manager — Live Review Needs Target Identity, Not Just Line Coordinates"
source: hn
source_id: "HN 49832209; YoanWai/agent-manager@caf4afdd68e6eceda9bf30ad63140c774fca4bb8"
date: 2026-09-24
last_updated: 2026-09-24
type: finding
tags: [hacker-news, coding-agents, code-review, concurrency, stale-state, human-in-the-loop]
relevance: high
---

<ai_context>
This note assesses agent-manager's implementation for reviewing a coding agent while it continues editing. Its reusable contribution is a layered identity contract for live review: freeze the target during human input, reject stale asynchronous loads, scope comments to the exact review, and move a comment only on unambiguous content evidence. Scout statically inspected the linked article and pinned source/tests; it did not execute the program or tests.
</ai_context>

# Agent-manager — Live Review Needs Target Identity, Not Just Line Coordinates

## Source and coverage

- **HN:** [item 49832209](https://news.ycombinator.com/item?id=49832209)
- **Source:** [Reviewing code while an AI agent is still rewriting it](https://agent-manager.dev/writing/live-review-race/)
- **Repo:** [YoanWai/agent-manager](https://github.com/YoanWai/agent-manager)
- **Inspected revision:** [`caf4afdd68e6eceda9bf30ad63140c774fca4bb8`](https://github.com/YoanWai/agent-manager/commit/caf4afdd68e6eceda9bf30ad63140c774fca4bb8)
- **Observation date:** 2026-09-24
- **Read:** the complete linked article; repository metadata; the pinned `internal/ui/diffview.go`; and the pinned `internal/ui/diffview_test.go` cases for paused reloads, same-scope re-anchoring, scope changes, and ambiguous anchors.
- **Not run:** the TUI, a live coding-agent session, Git race scenarios, or repository-authored tests. The behavior below is implementation and project-authored test evidence, not an independent reliability measurement.
- **Disposition:** new knowledge — a concrete concurrency contract for preserving human review intent against a producer that keeps mutating the reviewed artifact.

## Source observations

A line number is only a coordinate in one rendering. Agent-manager stores each comment with file, old/new side, line number, review scope, a content hash, and a trimmed source excerpt capped at 60 runes. On a silent refresh of the same review, it scans for an excerpt on the same added/deleted side. It moves the comment only if exactly one line matches and another comment does not already occupy that target. Blank, missing, repeated, or contested anchors do not move; sent comments whose source changed can instead become visibly outdated.

Content resemblance is deliberately subordinate to review identity. Review state is keyed by session ID and resolved repository path. Loads also carry scope, repository, generation, file index, and path, and handlers reject results that no longer match the open review. Re-anchoring runs only for a silent same-scope refresh or restored state—not when the reviewer changes scope—because identical text in a different patch is not the same review target.

The human interaction receives its own short critical section. While the comment editor or send-confirmation prompt is open, new probes pause, and a load already in flight is discarded if it arrives. The implementation retains a stale fingerprint so the current diff reloads after the dialog closes. This freezes the semantic frame from which the person selected the line without pausing the coding agent or locking the repository.

The project-authored tests encode important negative cases: an in-flight load cannot replace the diff under the comment box; a unique excerpt follows a line shifted by an insertion; changing review scope does not re-anchor; duplicate or blank excerpts remain ambiguous; and two comments cannot collapse onto one surviving line. These are stronger claims than “the UI refreshes” because they test when the system must refuse to infer identity.

## Interpretation

**Live review is a concurrency protocol, not a continuously repainted diff.** Preserving reviewer intent requires several independent bindings:

1. **review identity** — exact session, repository, and scope;
2. **load identity** — generation plus file path/index, so late work cannot repaint newer state;
3. **interaction identity** — the stable frame visible while the person types or confirms;
4. **anchor evidence** — side-aware, unambiguous content correspondence;
5. **uncertainty state** — outdated or unmoved, rather than silently guessed.

This pattern generalizes beyond line comments. Any human approval or correction attached to a mutable agent artifact should bind both the artifact generation the person saw and a conservative semantic anchor. Coordinate-only references drift; content-only matching can cross scopes or collapse duplicates. When identity cannot be proved, preserve the original instruction and surface uncertainty instead of manufacturing a precise-looking relocation.

## Limitations

The anchor is intentionally shallow. A 60-rune exact excerpt cannot follow a rewritten line, can collide on boilerplate, and is not an AST or semantic identity. Keeping the old line as a best guess preserves history but does not make that coordinate current; consumers must honor the outdated/ambiguous state. The inspected tests are authored by the same project and do not establish behavior under every Git operation, filesystem race, language, or large-repository workload. The HN submission had one point and no comments at inspection, so it supplies discovery rather than independent validation.

## Primary references

- [Live-review article](https://agent-manager.dev/writing/live-review-race/)
- [Pinned diff review implementation](https://github.com/YoanWai/agent-manager/blob/caf4afdd68e6eceda9bf30ad63140c774fca4bb8/internal/ui/diffview.go)
- [Pinned race and ambiguity tests](https://github.com/YoanWai/agent-manager/blob/caf4afdd68e6eceda9bf30ad63140c774fca4bb8/internal/ui/diffview_test.go)
