# Proposal: Fix Stale Design-Doc Paths in Agent Context Files

**Date:** 2026-06-06
**Author:** arc
**Priority:** P1
**KE:** KE-1541

## Problem

Four agent `context.md` files reference `shared/may-agent-docs/design/`,
a path that does not exist. The actual location is
`shared/may-agent-docs/2a-design/`. Two files additionally reference
specific filenames that don't exist under either path.

Every session for these agents loads their context.md. When agents need
architectural context and follow the pointer, they get a dead path.

## Proposed Edits

### 1. `agents/bob/context.md` line 32

```diff
-- Design docs: `shared/may-agent-docs/design/`
+- Design docs: `shared/may-agent-docs/2a-design/`
```

### 2. `agents/dev/context.md` line 10

```diff
-- Design docs: `shared/may-agent-docs/design/`
+- Design docs: `shared/may-agent-docs/2a-design/`
```

### 3. `agents/dev/context.md` line 14

```diff
-- Metrics design: `shared/may-agent-docs/design/agent-metrics.md`
+- Metrics design: `shared/may-agent-docs/2a-design/metrics.md`
```

### 4. `agents/scout/context.md` line 26

```diff
-- Design docs: `shared/may-agent-docs/design/`
+- Design docs: `shared/may-agent-docs/2a-design/`
```

### 5. `agents/tech-lead/context.md` line 32

```diff
-- Before proposing guards: read `shared/may-agent-docs/design/code-vs-data-decisions.md`
+- Before proposing guards: read design docs in `shared/may-agent-docs/2a-design/`
```

(Note: `code-vs-data-decisions.md` doesn't exist under either path.
The replacement directs tech-lead to the correct design directory
so they can find relevant docs themselves.)

## Risk

Minimal. These are documentation path corrections — no code, no schema,
no runtime behavior. Each edit is a string replacement in a Markdown file.

## Validation

After edit: `grep -rn 'may-agent-docs/design/' agents/*/context.md`
should return zero results.
