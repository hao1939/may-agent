<ai_context>
summary: "Easl separates an agent transcript, which is an append-only event log, from a repository-scoped board that holds the human-agent pair's current working state. Its stronger pattern is explicit element-level context addressing: the user stages references to code lines, DOM elements, note blocks, terminal output, or diagram objects, sees the destination terminal, and sends revision-pinned context only with the next real prompt to that terminal. This is a promising interaction design, but the evidence is static inspection of a new macOS-only project, not an independent usability or reliability evaluation."
triggers: ["Easl", "shared human-agent workspace", "agent artifact board", "element-level context mentions", "transcript versus state", "visual agent oversight"]
last_updated: "2026-10-04"
source_basis: "HN item 49955035, the author's launch post, and static inspection of twaldin/easl at revision 9e3f5bdd26baa66c9baa6bf60f596fe3ad64bb18, including README, design record, contracts, schema, and agent guidance. Scout did not run the native macOS application or its test suite."
</ai_context>

# Keep shared working state beside the agent transcript

**Date:** 2026-10-04  
**Disposition:** New knowledge  
**Source:** https://news.ycombinator.com/item?id=49955035  
**Article:** https://tim.waldin.net/blog/2026-10-04-easl  
**Repo:** https://github.com/twaldin/easl  
**Inspected revision:** [`9e3f5bdd26baa66c9baa6bf60f596fe3ad64bb18`](https://github.com/twaldin/easl/commit/9e3f5bdd26baa66c9baa6bf60f596fe3ad64bb18)

## Question

What does Easl contribute to human oversight of coding agents beyond putting terminals, diagrams, and browsers on one canvas?

## Source-grounded finding

The launch post makes a useful distinction: an agent transcript is a chronological log, while the diagrams, code locations, pages, traces, and notes a person relies on are current working state. A transcript only grows at the bottom, so useful representations drift out of view and are often regenerated. Easl instead keeps one repository-scoped board where terminals and those artifacts remain spatially available beside each other.

Static inspection shows that the project makes this more than a visual layout choice. Its interaction contract turns board elements into explicit context addresses:

- A user can stage a code line or range, a note block, a browser DOM element, a terminal selection or last command, a drawing object, or a whole named group.
- Each staged mention appears as a numbered chip. The tray identifies the terminal that will receive it, permits explicit retargeting, and warns when the user is typing in a different terminal.
- Mentions are delivered only with the next real prompt submitted to that target. Prompts in other terminals and synthetic turns do not drain the tray.
- The integration pins staged mentions to their revision at submission and clears only the mentions it delivered. Edited targets remain visibly marked rather than silently pretending to be the same context.
- Worktree affinity can route a file-backed mention toward the sole agent terminal working in that checkout, reducing cross-branch context mistakes.

The board therefore acts as a human-readable selection and addressing layer over repository, browser, terminal, and authored artifacts. Spatial persistence helps the human return to an explanation, but the more reusable mechanism is that pointing becomes a reviewable context bundle with an explicit destination and consumption boundary.

## Operational pattern

A runtime does not need an infinite canvas to borrow the pattern:

1. **Separate history from shared state.** Retain the execution transcript as evidence, but keep the current plan, reviewed diff, important code locations, and decision artifacts as separately addressable objects.
2. **Represent references, not screenshots alone.** A useful selection carries stable identity, location, excerpt, source revision, and enough type information to reopen or validate it.
3. **Stage context before delivery.** Let the human inspect what will be sent, its ordering, and its target instead of injecting whatever currently has focus.
4. **Consume context at a named boundary.** Attach the staged set to one real user prompt or accepted operation, not to background wakes or unrelated agent turns.
5. **Expose staleness and routing.** Mark edited references and make the receiving agent or worktree visible; never silently retarget stale context.
6. **Preserve provenance and reversibility.** Easl records object creators and edit history, and treats agent board mutations as undoable user-visible actions.

This complements durable task and event systems rather than replacing them. The board is a presentation and context-selection surface; authoritative task status, permissions, source control, and effect receipts still need their own contracts.

## Evidence and limits

- The inspected repository's README, design record, contracts, API schema, and agent guidance consistently describe the transcript-as-log/board-as-state split and the staged-mention delivery rules. The codebase contains 54 test files, but Scout did not execute them.
- This is static source inspection, not an independent usability study. Detailed design-record anecdotes and reported behavior are project-authored evidence, not reproduced findings.
- The inspected release is `0.1.0`, and the HN item had one comment when observed. There is no evidence here of broad adoption, longitudinal use, or comparative performance.
- The application requires macOS 14 or later on Apple silicon. Scout's environment could not run the native application, so terminal persistence, mention delivery, browser capture, and recovery behavior were not exercised.
- Much of the implementation is product-specific: AppKit/WebKit, Ghostty terminals, zmx sessions, local sockets, and wrappers or hooks for particular agent CLIs. The reusable result is the interaction contract, not those dependencies.
- Persistent visual state can itself become stale or crowded. Easl exposes edited mentions, source-backed code tiles, navigation, and provenance, but this assessment does not establish that those controls prevent users from acting on obsolete artifacts.
- Element-level context can improve precision without proving correctness. A precisely referenced diagram box or DOM element may still embody a wrong explanation, and a board does not replace terminal-state checks or code review.

## Sources reviewed

- [HN item 49955035](https://news.ycombinator.com/item?id=49955035)
- [Launch post](https://tim.waldin.net/blog/2026-10-04-easl)
- [README at the inspected revision](https://github.com/twaldin/easl/blob/9e3f5bdd26baa66c9baa6bf60f596fe3ad64bb18/README.md)
- [Design record](https://github.com/twaldin/easl/blob/9e3f5bdd26baa66c9baa6bf60f596fe3ad64bb18/docs/design.md)
- [Interface contracts](https://github.com/twaldin/easl/blob/9e3f5bdd26baa66c9baa6bf60f596fe3ad64bb18/docs/contracts.md)
- [API schema](https://github.com/twaldin/easl/blob/9e3f5bdd26baa66c9baa6bf60f596fe3ad64bb18/schema/easl-api.json)
- [Guidance for agents without a native integration](https://github.com/twaldin/easl/blob/9e3f5bdd26baa66c9baa6bf60f596fe3ad64bb18/extensions/easl-guide.md)

## Discovery coverage

The live HN Algolia `search_by_date` query for `agent` stories (20 newest hits) surfaced item 49955035. It was selected because its repository exposes concrete interaction, routing, revision, and delivery contracts rather than only a product claim. Case-insensitive searches for the HN item ID, article URL, and repository URL found no existing Scout note. Broader searches found notes about shared context and persistent state, but none assessed this source or its element-level mention boundary, so a distinct source-level finding was warranted.
