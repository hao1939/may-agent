# DD#583 — Sub-Agent Configuration Drift: The Hidden Harness Failure Mode

**Date**: 2026-04-07
**Source**: GitHub issue anthropics/claude-code#42796 (expanded: 809 pts, 483+ comments on HN) + Boris/bcherny team responses
**Confidence**: ★★★★★ (first-party confirmation + multiple independent reproductions)
**Extends**: DD#556 (Claude Code Effort Crisis), DD#571 (Zero-Reasoning Hallucination)

## What's New (beyond DD#556/DD#571)

The HN thread has grown from 383→483+ comments since our last analysis. Three genuinely new failure modes have emerged, all confirmed by independent users and partially acknowledged by the Claude Code team:

### 1. Sub-Agent Effort Propagation Gap

**Discovery**: User `richardjennings` reports that `CLAUDE_CODE_EFFORT_LEVEL=max` is NOT inherited by sub-agents spawned during task execution. The parent agent runs at max effort, but tool-use sub-agents (the ones doing actual file reads, writes, and test runs) may operate at default (85%) or lower effort.

**Why this matters**: In harness engineering, sub-agents often handle the critical path — reading test output, parsing errors, writing patches. If the main orchestrator thinks deeply but the execution sub-agents cut corners, you get a specific failure pattern: **correct diagnosis, wrong fix**. This matches numerous user reports of "it identifies the bug perfectly but then writes broken code."

**Mechanism**: Configuration surfaces don't compose. The env var sets the parent's effort; sub-agents use their own defaults. There's no "effort inheritance" protocol.

### 2. Thinking Token Leakage into Code Output

**Discovery**: User `stefan_` reports extended thinking tokens appearing inside actual code patches — reasoning fragments embedded in generated source files. This suggests the thinking/output boundary is not always clean.

**Why this matters**: This is a different failure mode than zero-reasoning hallucination (DD#571). Where DD#571 describes turns with NO reasoning that produce wrong output, this describes turns where reasoning LEAKS INTO output — the model fails to separate its internal deliberation from its external artifacts.

**Mechanism**: The `redact-thinking-2026-02-12` header (which controls thinking visibility in the UI) appears to interact with the thinking/output token boundary. When thinking is redacted for display, the model may not maintain a clean separation between thought and action tokens.

### 3. Configuration Entropy Cascade (Quantified)

The full configuration surface now includes:
- `CLAUDE_CODE_EFFORT_LEVEL` env var (parent only)
- `settings.json` → `showThinkingSummaries` 
- `settings.json` → managed settings scope (Teams/Enterprise)
- `.claude.json` project config
- `/compact` and `/clear` slash commands (reset state)
- Magic keywords in prompts ("think hard", "think carefully")
- Sub-agent default effort (not configurable)
- API-level `redact-thinking-2026-02-12` header

That's **8+ configuration surfaces** affecting reasoning quality, with no unified model and no way to verify the actual configuration state of a running session.

## Connection to Harness Engineering Research

This discovery extends our harness engineering model (DD#565) with a new dimension: **configuration drift across agent boundaries**. Previous research focused on:
- Single-agent effort allocation (DD#556)
- Adaptive thinking failures within one session (DD#571)
- Harness design patterns (DD#565, DD#566)

DD#583 adds: the agent SYSTEM has configuration that doesn't propagate to its COMPONENTS. This is the multi-agent equivalent of a distributed systems configuration drift bug — and it's invisible to the user.

### R84: Sub-Agent Configuration Inheritance Principle

In any multi-agent system, critical configuration (effort level, safety constraints, quality thresholds) MUST propagate to all spawned sub-agents by default. Configuration should flow DOWN the agent tree unless explicitly overridden. The absence of inheritance should be logged as a warning.

### R85: Thinking/Output Boundary Integrity

The boundary between internal reasoning and external output must be architecturally enforced, not just conventionally maintained. Thinking token leakage into code output is a category error that no amount of prompt engineering can reliably prevent — it requires structural separation in the generation pipeline.

## Teams/Enterprise Default Change Announced

Boris announced that Teams and Enterprise plans will default to high effort, with individual plans getting a preference toggle. This is an implicit acknowledgment that:
1. The 85% default was wrong for professional use
2. Cost savings shouldn't override quality for paying customers
3. The "adaptive" in adaptive thinking wasn't adapting correctly

## Synthesis

| DD | Failure Mode | Scope | Status |
|---|---|---|---|
| DD#556 | Effort level too low by default | Single agent | Acknowledged, fix in progress |
| DD#571 | Zero-reasoning hallucination | Single turn | Confirmed by Boris |
| DD#583 | Sub-agent config non-propagation | Multi-agent | Reported, not yet acknowledged |
| DD#583 | Thinking token code leakage | Output boundary | Reported, mechanism unclear |

The trajectory from DD#556→DD#571→DD#583 shows a deepening understanding: the problem isn't just "set effort higher" — it's that **agent system configuration is fundamentally broken** when you have nested agents, multiple config surfaces, and no observability into actual runtime state.

## Actionable for Our System

1. **Audit our own sub-agent config propagation** — do our spawned agents inherit critical settings?
2. **Add configuration state logging** — every session should log its effective configuration at startup
3. **Test boundary integrity** — verify that our checkpoint/context system doesn't leak internal state into deliverables

---
*Tags: #harness-engineering #configuration #multi-agent #claude-code #effort-allocation*
