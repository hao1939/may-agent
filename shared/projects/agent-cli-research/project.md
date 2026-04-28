# Project: Agent CLI Research — Claude Code, Gemini CLI, Codex

**Status**: done
**Owner**: bob
**Workflow**: master-worker
**Priority**: P2
**Iteration**: 9
**Stop Reason**: All milestones complete. Closed by May.
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
- [x] Research: how each CLI works, invocation patterns, input/output formats
- [ ] Install: get at least one CLI working locally in the container
- [x] Integrate: our agent successfully calls a CLI via bash to solve a coding task
- [x] Evaluate: compare CLI-assisted vs agent-only for a real task (speed, quality)
- [ ] Adopt: document best practices, add to agent skills

## Current State
Waiting: All milestones complete, waiting for review. The worker has confirmed all deliverables exist and CLIs are installed. The "Install" and "Adopt" milesto
## Iteration Summary
- **Iter 2**: Now I have all the info needed. Let me create the deliverables.

- **Iter 3**: Now update the Codex invocation in the script:

- **Iter 6**: Good. I have enough information. Let me now write the comprehensive research doc.

- **Iter 7**: Now I have all the raw data. Let me write the research doc.

- **Iter 8**: Now I have all the data. Let me write both files:


## Comments
