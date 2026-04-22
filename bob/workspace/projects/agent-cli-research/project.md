# Project: Agent CLI Research — Claude Code, Gemini CLI, Codex

**Status**: active
**Owner**: bob
**Priority**: P1
**Iteration**: 0
**Health**: —

## Goal
Use production agent CLIs (Claude Code, Gemini CLI, OpenAI Codex) as tools our agents can invoke. Research how they work, install them, and integrate them as callable tools from our agent system.

Two outcomes:
1. **Use them directly** — our agents call `claude-code` or `gemini-cli` via bash for complex coding tasks
2. **Learn from them** — extract patterns worth adopting into our own system

## Why This Matters
Our agents orchestrate work but struggle with complex code changes (can't access src/, limited context). These CLIs are purpose-built for coding. Let our agents drive them — agents decide WHAT to fix, CLI does the fixing.

## Metrics
- bob.designs-implemented: target > 2 adopted patterns

## Research Tracks

### Track 1: Scout — Papers, GitHub, Reddit
- [ ] Research Claude Code architecture (Anthropic blog posts, GitHub discussions, user reports)
- [ ] Research Gemini CLI architecture (Google blog posts, GitHub repo, community analysis)
- [ ] Research OpenAI Codex CLI architecture (OpenAI docs, GitHub, community)
- [ ] Cross-reference: what patterns do all three share? What's unique to each?

### Track 2: Amy-Kimi — Xiaohongshu, Chinese tech community
- [ ] Collect user experiences and tips from Xiaohongshu (小红书) for Claude Code usage
- [ ] Collect Gemini CLI user feedback from Chinese developer communities
- [ ] Find practical usage patterns, workarounds, and power-user techniques

### Track 3: Bob — Synthesis & Experiment
- [ ] Synthesize findings from Track 1 + Track 2 into a comparison doc
- [ ] Identify top 3 patterns worth adopting (tool design, context management, error recovery, etc.)
- [ ] Design experiment: test one pattern in our system (gym or production)
- [ ] Run experiment, measure impact

### Track 4: Hands-on — Install and try
- [ ] Install Claude Code CLI locally, try it on a real task
- [ ] Install Gemini CLI locally, try it on a real task
- [ ] Compare: what feels better? What's missing? What surprised you?
- [ ] Document the UX and architecture differences

## Milestones
- [ ] Research: how each CLI works, invocation patterns, input/output formats
- [ ] Install: get at least one CLI working locally in the container
- [ ] Integrate: our agent successfully calls a CLI via bash to solve a coding task
- [ ] Evaluate: compare CLI-assisted vs agent-only for a real task (speed, quality)
- [ ] Adopt: document best practices, add to agent skills

## Current State
Not started.

## Iteration Summary

## Comments
- [2026-04-22 hao] The PRIMARY goal is to USE these CLIs as tools, not just study them. Our agents can call them via bash. Agent decides what to fix, CLI does the coding. This solves the src/ access problem — the CLI runs in the repo with full access. Research HOW to invoke them (flags, input format, output parsing), then integrate.
