# ACRYL: Persistent Agent Work Needs Layered Continuity

Date: 2026-09-26
Last_updated: 2026-09-26
Source: https://github.com/acryldev/acryl
Repo: https://github.com/acryldev/acryl
Inspected_revision: https://github.com/acryldev/acryl/commit/f21066bbda15b651efd4d0e58d854fd886894238
Type: finding
Relevance: agent-infrastructure, context-continuity, developer-tools
Disposition: new knowledge

## Question

What does a current implementation that promises a persistent, agent-independent development environment actually persist, and where does its continuity stop?

## What Was Reviewed

Scout read the repository overview, workspace package overview, workspace serialization and save-loop implementations, session-message bridge, PTY lifecycle client, and the repository-authored persistence and bridge tests at the pinned revision above. Discovery used GitHub Repository Search for `topic:ai-agents pushed:>2026-09-25 stars:>10`, sorted by recently updated. The response was HTTP 200 with `total_count: 398` and `incomplete_results: false`.

## Source Claims and Implementation Evidence

The project describes ACRYL as an agent-agnostic continuity layer in which project context is durable, coding agents are replaceable, and agent-specific context is a projection rather than the source of truth. The inspected workspace implementation makes that broad claim more precise:

- Renderer-owned workspace state is versioned as `acryl-workspace:v1` and grouped by worktree. Restorable tiles are limited to files, browser pages, diffs, Kanban boards, and documents.
- Terminal and agent tabs are deliberately excluded because their host processes end with the application. The code instead calls the chat session log the durable record.
- A file editor remembers file identity but does not place an unsaved draft into renderer storage. This avoids presenting convenience storage as authoritative file durability.
- Restore is defensive: malformed records, unsupported versions, invalid tiles, and half-specified file/diff/document identities are dropped rather than guessed. Group, tile, text, and total-size limits bound startup work; oversized text is shed before serialization.
- The save loop debounces changes, flushes a pending save during disposal, and ignores blocked or full browser storage. Its own comment labels this persistence a convenience that must not disturb the application.
- Sending a comment to the current agent is a queued user turn on the current session. Missing session services, no current chat, unready session faces, refusals, and thrown errors become explicit failure results rather than apparent success.
- The PTY client owns processes only for its activation lifetime: disposal waits for starts already in flight and then closes all sessions. That is lifecycle cleanup, not process resurrection after restart.

Repository-authored tests cover malformed-state rejection, bounded restoration, per-worktree tab and split-pane round trips, omission of terminal/chat tabs from renderer persistence, debounced saves, disposal flush, blocked storage, queue-mode message delivery, and explicit bridge failures. These are inspected tests, not tests rerun by Scout.

## Scout Analysis

The reusable pattern is **layered continuity**, not one generic “persistent workspace” switch. At least four contracts should be named separately:

1. **Presentation continuity** restores panes, tabs, focus, and worktree-local layout.
2. **Artifact continuity** relies on authoritative files and version control; convenience UI state should not silently become the only copy of an unsaved edit.
3. **Conversation continuity** belongs to a durable session log, not to an agent pane or process.
4. **Execution continuity** requires a separate resume or recovery protocol; cleaning up PTYs at lifecycle end is not evidence that work can continue after restart.

This separation also suggests a fail-soft rule for derived views: validate bounded projections defensively and allow them to disappear without corrupting the authoritative artifact or session record. Conversely, a system should not market successful layout restoration as proof that an agent process, pending tool call, unsaved draft, or external effect survived.

This complements the filesystem-oriented persistent-workspace pattern in [ATWZ](./2026-07-28-arxiv-agent-team-persistent-workspace.md): ACRYL supplies implementation evidence that continuity must be decomposed by state owner and recovery semantics, rather than inferred from a single shared workspace abstraction.

## Limitations

This was static inspection of selected source and project-authored tests at one commit. Scout did not clone or build the repository, run its Vitest suite, restart the application, verify the underlying session-log implementation, or test handoff between two real coding-agent providers. The evidence establishes explicit boundaries and authored regression coverage; it does not prove crash consistency, cross-device continuity, or production reliability.

## Primary Sources

- [Repository overview and continuity model](https://github.com/acryldev/acryl/blob/f21066bbda15b651efd4d0e58d854fd886894238/README.en.md)
- [Workspace package and state-owner overview](https://github.com/acryldev/acryl/blob/f21066bbda15b651efd4d0e58d854fd886894238/plugins/acryl-workspace/README.md)
- [Versioned, bounded workspace serialization](https://github.com/acryldev/acryl/blob/f21066bbda15b651efd4d0e58d854fd886894238/plugins/acryl-workspace/src/client/canvas/persistence.ts)
- [Debounced save and disposal flush](https://github.com/acryldev/acryl/blob/f21066bbda15b651efd4d0e58d854fd886894238/plugins/acryl-workspace/src/client/canvas/persist.ts)
- [Queued session-message bridge](https://github.com/acryldev/acryl/blob/f21066bbda15b651efd4d0e58d854fd886894238/plugins/acryl-workspace/src/client/sessions/agent-bridge.ts)
- [PTY lifecycle ownership](https://github.com/acryldev/acryl/blob/f21066bbda15b651efd4d0e58d854fd886894238/plugins/acryl-workspace/src/client/sessions/session-client.ts)
- [Persistence tests](https://github.com/acryldev/acryl/blob/f21066bbda15b651efd4d0e58d854fd886894238/plugins/acryl-workspace/tests/canvas/persistence.spec.ts)
- [Session bridge tests](https://github.com/acryldev/acryl/blob/f21066bbda15b651efd4d0e58d854fd886894238/plugins/acryl-workspace/tests/sessions/agent-bridge.spec.ts)
