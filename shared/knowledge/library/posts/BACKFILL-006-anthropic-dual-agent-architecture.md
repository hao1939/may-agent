# Anthropic Long-Running Agent: Initializer+Executor Dual Architecture

**Source**: insights-archive-kimi-2026-03-31.md (HB-2261)
**Date**: 2026-03-30
**Original**: XHS@无影寺 / Anthropic official release
**Type**: Architecture pattern documentation

---

## The Core Problem

Long-running agents must work across discrete sessions. Each new session starts with zero memory of previous sessions. This is not a bug — it's a fundamental architectural constraint.

**Analogy**: Shift engineers at a factory. The night engineer doesn't remember what the day engineer did unless there's a handoff document.

---

## Dual-Agent Architecture

| Component | Responsibility | When It Runs |
|-----------|---------------|-------------|
| **Initializer Agent** | Writes init.sh, creates claude-progress.txt, makes initial git commit, generates feature requirements list | Once, at project start |
| **Executor Agent** | Executes specific tasks, reads progress.txt to restore context | Every subsequent session |

### Key Mechanisms

1. **claude-progress.txt**: Work log that persists across sessions — the "handoff document"
2. **Feature requirements list**: 200+ features as long-term task state anchor
3. **Dual-version logging**: Human-readable version + Agent-optimized version

### Community Enhancement (MLE打怪日记):
> "Claude Sonet generates developer diaries that can serve as context for the next window, but sometimes the content is overly detailed for humans. Try generating agent-facing dev logs — separate the high-level and coding agent versions."

---

## OpenClaw Architectural Mapping

| Anthropic Pattern | OpenClaw Equivalent | Status |
|-------------------|---------------------|--------|
| Initializer Agent | Gateway initialization layer | ✅ Exists |
| Executor Agent | Main/Sub-agent execution | ✅ Exists |
| claude-progress.txt | Execution Log mechanism | ✅ Exists |
| Feature requirements list | Task Definition structure | ✅ Exists |
| Dual-version logging | — | ⚠️ Not yet implemented |
| Explicit cross-session state bridge | — | ⚠️ Not yet implemented |

---

## Unique Insight: The State Bridge Pattern

The deepest insight isn't the dual-agent pattern (which many systems use). It's the **explicit state bridge** — a structured artifact specifically designed to transfer context across session boundaries.

Properties of an effective state bridge:
- **Structured** (not free-form notes — parseable sections)
- **Append-only** (new sessions add, never delete)
- **Dual-audience** (both human and agent can extract meaning)
- **Task-anchored** (linked to a persistent task list, not floating)

This is exactly what `insights.md` / `Error Log` already do in the OpenClaw ecosystem — but the Anthropic pattern makes the design intent explicit and suggests the dual-version optimization.

---

## Actionable Recommendations

1. **Consider dual-version context files**: Current context.md serves both human reading and agent ingestion — separating these could improve both
2. **Explicit "state bridge" designation**: Mark certain files as cross-session state bridges (not just "logs") to clarify their architectural role
3. **Append-only discipline**: State bridge files should be append-only with structured sections, not edited in place
