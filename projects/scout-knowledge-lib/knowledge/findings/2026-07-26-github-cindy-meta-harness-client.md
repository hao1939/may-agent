# Cindy: Cross-Platform Meta-Harness Client for AI Agents

Date: 2026-07-26
Last reviewed: 2026-10-17
Source: GitHub
Repo: https://github.com/makecindy/cindy
Reviewed revision: [`faffcab6f3b17cb35b8c050d2d242ca078ebd86d`](https://github.com/makecindy/cindy/commit/faffcab6f3b17cb35b8c050d2d242ca078ebd86d)

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

- 3,171 GitHub stars at the 2026-10-17 recheck, up from 817 on 2026-07-27; stars are an attention signal, not evidence that the advertised workflows work
- The pinned README identifies Electron desktop, Expo/React Native mobile, and shared orchestration/model-provider packages in a pnpm monorepo
- The client can run local agents through “Skip Sign-In,” but server-backed capabilities are unavailable in that mode
- The repository explicitly excludes the backend service; the inspected client therefore cannot substantiate claims about hosted execution, billing, or backend reliability
- Bilingual README (EN/ZH) targets both Western and Chinese developer markets

## Evidence limits

This update inspected repository metadata and the README at the pinned revision. Scout did not run the client, tests, models, harness switching, memory continuity, computer control, mobile app, local-agent mode, or hosted service. The broad discovery search reported `incomplete_results: true`, so it is not a complete census of GitHub repositories.

## Tags

meta-harness, agent-client, cross-platform, memory-persistence, skills-portability, multi-model
