# OpenAI Symphony: Agent Orchestration Spec

**Source**: XHS post by 随机比特 + GitHub repo `openai/symphony`
**Date**: 2025-04-30
**URL**: https://github.com/openai/symphony

## Summary

OpenAI open-sourced **Symphony** — not a product but a **specification** for orchestrating coding agents at scale. It's a long-running daemon that polls an issue tracker (Linear), creates isolated per-issue workspaces, and runs coding agent sessions with bounded concurrency.

## Key Design Decisions

1. **Orchestrator is single source of truth** — owns poll tick, in-memory state, dispatch/retry/stop decisions
2. **No persistent database** — state reconstructed from tracker + filesystem on restart
3. **Workspace as isolation boundary** — each issue gets its own directory; agent commands constrained to it
4. **Workflow policy in-repo** — `WORKFLOW.md` with YAML front matter (config) + markdown body (prompt template), version-controlled
5. **Concurrency as first-class** — global max + per-state slot limits (`max_concurrent_agents_by_state`)
6. **Hooks for lifecycle** — `after_create`, `before_run`, `after_run`, `before_remove`
7. **Retry with exponential backoff** — max 5min default
8. **Agent is a subprocess** — Symphony doesn't reason; it schedules. The agent does all ticket/PR work via its own tools.

## XHS Community Reaction

- "问一问" AI summary framed it as Agent evolution: 1.0 单兵 → 2.0 班排 → 3.0 军团
- Skeptics: "给我评测，稳定性和准确率，不然都是扯淡"
- Comparison to Cursor Composer (CC): "Open AI想抄CC的设计" vs "cc的设计连给codex提鞋都不配"

## 对我们系统的意义

Our system already implements many of these patterns:
- ✅ Per-agent workspace isolation
- ✅ File-based state (no DB)
- ✅ Workflow prompts in-repo (SOUL.md ≈ WORKFLOW.md)
- ✅ Orchestrator dispatching tasks

**Gaps/Ideas**:
- Symphony's `max_concurrent_agents_by_state` is elegant — we could limit how many agents are in "research" vs "implementation" state
- Their `hooks` pattern (before_run, after_run) could formalize our pre/post task verification
- Their WORKFLOW.md front matter approach (typed config + prompt in one file) is cleaner than our separate SOUL.md + heartbeat.md + periodic-tasks split
- Symphony explicitly decouples "scheduling" from "reasoning" — our orchestrator (manager) does both; separating might help

## Related

- Post by 奥森木: "如何搭建协作的AI agent团队" — hub-and-spoke architecture, coordinator + specialists, explicit context passing (no inherited history), "围栏比指令更重要" (guardrails > instructions)
