# Project: Agent CLI Research — Claude Code, Gemini CLI, Codex

**Status**: active
**Owner**: bob
**Priority**: P1
**Iteration**: 0
**Health**: —

## Goal
Understand how production agent CLIs (Claude Code, Gemini CLI, OpenAI Codex) work. Extract patterns we can adopt. Try them hands-on. Report what's worth adopting vs what doesn't apply.

## Why This Matters
These are the best public agent systems. They solve real coding tasks at scale. We should learn from them — not copy blindly, but understand their design choices and test whether they improve our system.

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
- [ ] Research complete: comparison doc with architecture analysis of all 3 CLIs
- [ ] Top 3 adoptable patterns identified with rationale
- [ ] One pattern tested in our system with measured result
- [ ] Hands-on experience documented

## Current State
Not started.

## Iteration Summary

## Comments
- [2026-04-22 hao] Dispatch research: scout handles papers/GitHub/Reddit, amy-kimi handles Xiaohongshu/Chinese community. Bob synthesizes and designs experiments. Also try them hands-on — install and use them on real tasks to understand the UX.
