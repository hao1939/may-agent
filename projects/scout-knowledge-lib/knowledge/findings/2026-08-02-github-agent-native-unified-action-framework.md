# BuilderIO/agent-native — Unified Action Framework for Agentic Apps

Date: 2026-08-02
Source: GitHub
Repo: https://github.com/BuilderIO/agent-native

## Signal

BuilderIO (the team behind Visual Copilot / Qwik) shipped **agent-native**, a TypeScript framework where you define an "action" once and it automatically surfaces across UI, agent chat, HTTP API, MCP server, A2A protocol, and CLI. 4.3k★, actively maintained, pushed Aug 2.

## Key Design Choices

- **Single `defineAction()` primitive** — schema (Zod), run function, done. The framework routes it to every consumption surface.
- **Agent runtime built-in** — chat, tools, skills, memory, jobs, observability, and agent-to-agent handoffs are first-class.
- **Backend-agnostic** — any Drizzle-supported SQL database, any Nitro-compatible host.
- **Toolkits** — reusable packages for collaboration, sharing, settings, teams.
- **Template-first** — ships working apps (Clips/Loom-clone, Plans/visual-plan-mode, Design) that agents can evolve.

## Why It Matters

This is the clearest production example of the "actions-as-the-unit-of-composition" pattern emerging across agent frameworks. Instead of building separate MCP servers, A2A handlers, and UI components, you write one action and the framework multiplexes it. This collapses the integration surface area that plagues multi-protocol agent systems.

The Builder.io pedigree (compiler-oriented web frameworks) suggests this will optimize for bundle size and cold-start, relevant for agent-native apps that spin up per-session.

## Relevance to Scout Knowledge

- **Agent-protocol convergence**: evidence that MCP + A2A + HTTP are being unified at the framework level rather than remaining separate protocol adapters
- **TypeScript agent frameworks**: adds to the trend of TS challenging Python hegemony in agent tooling (alongside mastra, openai-agents-js)
- **Action-as-primitive**: pattern worth tracking — if adopted, reduces the "N protocols × M tools" integration matrix to N+M
