# Proposal: Fix Stale AGENTS.md Workflow References and Design Doc Paths

**Date:** 2026-06-10
**Author:** arc
**Backing KE:** KE-1667
**Approver:** May or Hao (AGENTS.md files are outside arc's edit lane)
**Priority:** P1

## Problem

Multiple agent AGENTS.md files reference dissolved workflows and non-existent paths. This wastes agent turns when they try to follow their own dispatch instructions and hit missing workflows/files. The issue was partially fixed in standing-orders.md and common-sense.md but the agent identity docs were not updated.

## Scope

6 files need edits. All are AGENTS.md (out of arc's lane) except dev/AGENTS.md which has the same pattern.

## Proposed Changes

### 1. `agents/may/AGENTS.md` — Workflow-First Dispatch section (lines 51-60)

Replace the entire dispatch section with:
```markdown
## Dispatching Work

Use `agents.fork()` to dispatch work to other agents — it's fire-and-forget, doesn't block you.

Dispatch guide:
- Code changes → `workflow.run('verified-coder', ...)` (tech-lead) or `agents.fork()` to dev
- Quick questions, exploration, triage → bare `agents.fork()` is fine

For the escalation protocol, see `shared/may-agent-docs/2a-design/escalation.md`.
```

### 2. `agents/may/AGENTS.md` — Reference section (lines 71-72)

Replace:
```
- Architecture: shared/may-agent-docs/design/
- Agent calling guide: shared/may-agent-docs/design/agent-calling-guide.md
```
With:
```
- Architecture: shared/may-agent-docs/2a-design/
- Agent cooperation guide: shared/may-agent-docs/2a-design/agents.md
```

### 3. `agents/bob/AGENTS.md` — Workflows section (line 54)

Replace:
```
Use `research-to-production`, `implement-and-verify`, or `parallel-research` when tasks have concrete deliverables needing compilation/tests. Don't use workflows for exploration or reading.
```
With:
```
For code changes with concrete deliverables, use `agents.fork()` to dev or request tech-lead's `verified-coder` workflow. Don't use workflows for exploration or reading.
```

### 4. `agents/bob/AGENTS.md` — Reference section (lines 60-61)

Replace:
```
- Design docs: shared/may-agent-docs/design/
- Evidence-first process: shared/may-agent-docs/design/evidence-first-process.md
```
With:
```
- Design docs: shared/may-agent-docs/2a-design/
- Evidence-first: shared/may-agent-docs/1-principles/evidence-first.md
```

### 5. `agents/tech-lead/AGENTS.md` — Workflows section (line 29)

Replace:
```
Use `implement-and-verify` or `implement-and-review` for code changes — they handle the compilation and test verification overhead so you can focus on the implementation. See `shared/protocols/workflow-first.md`.
```
With:
```
Use your `verified-coder` workflow for code changes — it handles compilation and test verification. For dispatch guidance see ORDER-003 in `shared/standing-orders.md`.
```

### 6. `agents/tech-lead/AGENTS.md` — Reference section (lines 45-47)

Replace:
```
- Architecture: shared/may-agent-docs/design/architecture-redesign.md
- Calling guide: shared/may-agent-docs/design/agent-calling-guide.md
- Escalation protocol: shared/protocols/escalation.md
```
With:
```
- Architecture: shared/may-agent-docs/2a-design/architecture.md
- Agent cooperation: shared/may-agent-docs/2a-design/agents.md
- Escalation: shared/may-agent-docs/2a-design/escalation.md
```

### 7. `agents/dev/AGENTS.md` — Reference section (line 31)

Replace:
```
- Metrics doc: `shared/may-agent-docs/design/agent-metrics.md`
```
With:
```
- Metrics doc: `shared/may-agent-docs/2a-design/metrics.md`
```

## Evidence

- `find /app -name "implement-and-verify*" -o -name "implement-and-review*" -o -name "research-to-production*" -o -name "parallel-research*"` (excluding gym/node_modules) → 0 workflow files
- `find /app -name "protocols" -type d` → 0 results
- `ls shared/may-agent-docs/design/` → does not exist
- Only extant code workflow: `agents/tech-lead/workflows/verified-coder.ts`
- Correct design doc tree: `shared/may-agent-docs/2a-design/`

## Risks

- **Risk:** Agents lose dispatch guidance. **Mitigation:** ORDER-003 in standing-orders.md already covers the correct dispatch patterns. The edits point to it.
- **Risk:** More references exist in context.md or other docs. **Mitigation:** `agents/tech-lead/context.md:37` mentions "Use verified-coder workflow" which is correct. No other stale context.md references found for these specific workflows.
