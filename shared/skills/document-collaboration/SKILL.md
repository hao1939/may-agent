---
name: document-collaboration
description: How agents review, comment on, and finalize shared documents.
version: 1.0.0
tools: []
---

# Skill: Document Collaboration

How agents review, comment on, and finalize shared documents.

## Core Principle

**Comments first, finalize per comments.** Reviewers add comments. The author or implementer
addresses each comment by updating the document, then removes the comment. The document
converges to a clean final state.

## Comment Format

Use markdown blockquotes with attribution:

```markdown
> [Bob 2026-03-12] This needs a size limit, otherwise agents will dump everything here.
```

## Workflow

### Phase 1: Review

The reviewer reads the document and adds inline comments using blockquotes.

Place each comment **directly above** the relevant section or paragraph:

```markdown
### 5. knowledge/INDEX.md

> [Bob 2026-03-12] Add a soft size limit — 4KB? Otherwise we're back to the same bloat problem.

> [Optimizer 2026-03-12] Agree with Bob. Also mention that agents should prune stale references.

Agent-curated knowledge context. Replaces `sharedKnowledge` and `systemPromptFiles`.
```

For document-level feedback that doesn't apply to a specific section, add an
`## Open Questions` section at the end:

```markdown
## Open Questions

> [Bob 2026-03-12] Should we version these documents? Agents editing each other's docs could cause confusion without a clear ownership model.
```

### Phase 2: Finalize

The author or implementer reads all comments and for each one:

1. Update the document text to address the feedback
2. Remove the comment blockquote

```markdown
### 5. knowledge/INDEX.md

Agent-curated knowledge context. Soft limit: 4KB — agents should keep this concise
and move heavy content to separate files referenced by path. Prune stale references
when they no longer apply.
```

When all comments and Open Questions are resolved and removed, the document is finalized.

## Rules

1. **Reviewers comment, authors edit.** Don't rewrite someone else's document. Add comments
   explaining what should change and why. The author decides how to address them.

2. **Inline over end-of-doc.** Place comments next to the relevant text. Only use
   `## Open Questions` for document-wide concerns that don't belong to any section.

3. **Always include reasoning.** Bad: `> [Bob] Add a size limit.` Good:
   `> [Bob] Add a size limit — 4KB? Otherwise agents will dump everything here.`
   The author needs to understand the why, not just the what.

4. **Remove comments when addressed.** A finalized document has zero blockquote comments.
   Don't leave addressed comments as history — git tracks that.

5. **Disagreements are visible.** If two reviewers conflict, both comments stay until
   the decision-maker resolves them. Don't silently drop one.

6. **Keep comments bounded.** If a document accumulates more than ~10 comments, it needs
   a deeper rework. Consider a sync `agents.call` discussion instead.
