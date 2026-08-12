# Cindy: Cross-Platform Meta-Harness Client for AI Agents

Date: 2026-07-26
Source: GitHub
Repo: https://github.com/makecindy/cindy

## Summary

Cindy is an open-source (Apache-2.0, TypeScript/React Native) desktop and mobile client that unifies multiple AI agent harnesses (Claude Code, Codex, with more planned) into a single GUI. The key architectural insight: memory, skills, and workspace state persist continuously across harness and model switches — even mid-task. One task can be planned on one model, executed in parallel on another, and reviewed by a third.

## Key Design Choices

- **Harness-agnostic client**: Wraps Claude Code, Codex, and future harnesses; a native harness is in development
- **Continuous memory across harnesses**: Correct the agent once and the correction persists regardless of which backend executes next
- **Cross-platform**: Electron (desktop) + React Native (iOS/Android) in a pnpm monorepo
- **Bring-your-own-model**: Official service, existing Claude/Codex subscriptions (no double-billing), API keys, or local models
- **Skills portability**: Teach a workflow pattern once; reuse everywhere, share with team (planned)
- **Computer/browser/phone control**: Agent can drive real applications
- **MCP integration**: Wire internal tools into agent reach
- **Plugin marketplace** (planned): Reshape UI, features, interactions

## Relevance to AI-Agent Architecture

Cindy represents the maturation of the "meta-harness" pattern into a consumer product. Rather than choosing one agent backend, users get a unified client where different backends compete on execution quality while sharing a single memory/skills layer. This decouples the agent identity from the underlying model — a significant architectural shift that could commoditize individual agent harnesses.

The pattern validates that:
1. Agent memory and skills are the durable value layer, not the LLM backend
2. Users want GUI orchestration over CLI-only agents
3. Multi-harness switching mid-task is a real workflow need

## Signals

- 817★ in 5 days (created 2026-07-22; 126★ at first observation on 2026-07-26, 817★ by 2026-07-27) — 6.5× growth in one day signals strong adoption
- CI pipeline active; monorepo structure (desktop + mobile + shared packages)
- Bilingual README (EN/ZH) — targeting both Western and Chinese developer markets
- Commercial service layer with transparent usage billing

## Tags

meta-harness, agent-client, cross-platform, memory-persistence, skills-portability, multi-model
