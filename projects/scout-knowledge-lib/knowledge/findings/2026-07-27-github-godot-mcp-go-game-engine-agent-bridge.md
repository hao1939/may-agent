# Godot MCP Go — AI Agent Bridge to Game Engine

Source: GitHub
Repo: https://github.com/regiellis/godot-mcp-go
Date: 2026-07-27
Tags: #mcp #game-development #godot #agent-tooling #go

## Summary

An MCP server (written in Go) that exposes 312 commands for driving a running
Godot 4.7 editor and live game instance from the terminal or an AI agent.
Includes a Godot editor addon and live-built tool schemas so agents can
introspect available commands at runtime.

## Why This Matters

- **Domain expansion**: MCP tooling moving beyond code-editing and DevOps into
  real-time game engine control — agents can manipulate scenes, nodes, and
  running game state.
- **Schema-at-runtime pattern**: Tool schemas are generated from the live editor
  state, meaning the agent's available action space changes dynamically.
- **Multi-modal agent loop**: Enables a workflow where an agent iterates on game
  design by issuing commands and observing results — a step toward creative
  agent loops in visual domains.

## Details

| Field | Value |
|-------|-------|
| Language | Go + GDScript |
| License | MIT |
| Stars | ~21 (early-stage) |
| Created | 2026-07-23 |
| Last push | 2026-07-27 |
| Topics | ai-agents, claude, cli, gamedev, go, godot, mcp, model-context-protocol |

## Signal Strength

Early-stage (low stars) but conceptually significant. Demonstrates the MCP
protocol's flexibility for non-text domains and previews agentic game
development workflows.
