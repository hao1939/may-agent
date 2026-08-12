# Deer-Workflow: Deterministic TypeScript Orchestration with Replaceable Agent Runtimes

Date: 2026-07-26
Source: GitHub
Repo: https://github.com/deerwork-ai/deer-workflow

## Summary

Deer-workflow is the open-source pilot for **DeerFlow 3.0** (ByteDance's multi-agent workflow framework). It cleanly separates deterministic orchestration logic (written in TypeScript, run on Bun) from semantic agent work (delegated to replaceable runtimes like Codex CLI, with more planned). Published as `@deerwork-ai/deer-workflow` on npm.

## Key Design Choices

- **Deterministic orchestration layer**: Workflow structure, branching, and sequencing are pure TypeScript — predictable and testable without LLM calls
- **Replaceable agent runtimes**: Semantic steps delegate to pluggable agent backends (Codex CLI default); new integrations are contributor-friendly
- **Bun-native**: Uses Bun as runtime for speed; globally installable CLI
- **Workflow-as-code**: Users define workflows in TypeScript files, run them via `deer-workflow run`
- **Single-agent and multi-step**: Supports both ad-hoc agent invocations (`deer-workflow agent "..."`) and structured multi-step workflows

## Relevance to AI-Agent Architecture

This represents a maturing pattern in agent orchestration: **separating the control plane (deterministic, typed, testable) from the execution plane (LLM-powered, non-deterministic)**. By making agent runtimes pluggable, teams can swap models/harnesses without rewriting workflow logic. The DeerFlow lineage (ByteDance) gives it ecosystem momentum.

## Metadata

- Stars: ~51 (day of creation)
- Language: TypeScript
- License: MIT
- Created: 2026-07-26
- Related: bytedance/deer-flow (predecessor)
