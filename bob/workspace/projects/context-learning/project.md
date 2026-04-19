# Project: Context Learning

**Status**: blocked
**Owner**: bob
**Priority**: P1
**Iteration**: 5

## Goal
Agents learn from experience and get better over time:
1. Agent learns from successes and failures
2. Agent doesn't repeat similar errors
3. Agent performance improves measurably over time

The core question: **what mechanism updates agent behavior based on experience?**

## Background
- Text instructions work — the entire system runs on them (SOUL, common-sense, skills, task prompts)
- Skills changed behavior: read-before-edit 50%→70% via gym training (proof text works)
- Guards catch failures reliably but don't train behavior (KE-106, marked inaccurate — overgeneralized)
- Text and guards are complementary, not either/or
- Research exists: DD-743 (Darwinian memory pruning), DD-768 (graph memory), DD-772 (thought retrieval), DD-755 (artifacts as memory)
- External systems to study: OpenClaw, Hermes Agent, Reflexion pattern

## Design Principles
- **Metric-oriented** — measure whether learning is happening (error repeat rate, performance trend)
- **Event-driven** — session completion triggers learning extraction
- **Per-agent** — each agent has different concerns and lessons
- **Prune, don't accumulate** — lessons that don't help decay, useful ones survive (DD-743)
- **Evidence over theory** — experiment first, adopt what works

## Phase 1: Research (scout + bob)
Goal: understand how other systems do context learning, identify candidate approaches

- [ ] Scout: research OpenClaw agent learning mechanism
- [ ] Scout: research Hermes Agent experience/memory system
- [ ] Scout: research Reflexion pattern and similar (Voyager, Generative Agents)
- [ ] Bob: audit our DD library for applicable patterns (DD-743, DD-768, DD-772, DD-755)
- [ ] Bob: synthesize candidates — what are the 3-4 approaches we could try?

## Phase 2: Experiment (bob designs, coach runs)
Goal: test which approach actually changes agent behavior

- [ ] Design experiment: pick 1-2 candidate approaches, define success criteria
- [ ] Run controlled experiment in gym (A/B: with vs without learning mechanism)
- [ ] Measure: does the agent make fewer repeated errors? Does performance improve?
- [ ] Decide: which approach works? What needs adjustment?

## Phase 3: Build + Measure (bob architects, tech-lead if src/ needed, optimizer tracks)
Goal: implement the winning approach, set up metrics

- [ ] Architecture: where lessons live, how they're extracted, stored, retrieved, pruned
- [ ] Build: post-session lesson extraction
- [ ] Build: lesson storage and retrieval mechanism
- [ ] Build: pruning/decay system
- [ ] Metrics: error repeat rate, lesson retrieval rate, agent performance trend

## Phase 4: Adopt + Monitor (may monitors, coach tracks)
Goal: roll out to all agents, watch for regression

- [ ] Roll out to one agent first (canary)
- [ ] Monitor for regression (performance, cost, session length)
- [ ] Roll out to remaining agents
- [ ] Ongoing: May monitors health, coach tracks behavior improvement

## Current State
Blocked: — The worker has failed to install prettier in the scenario environment for 3 consecutive iterations. The likely cause is that `npm install` is failing silently or the .gitignore is preventing the node_modules from being committed/persisted, and the worker keeps not addressing this.

**Root cause**: The scenario design requires `node_modules/.bin/prettier` to exist, but npm install keeps failing or not being run in the correct directory. The worker appears to be testing in `/tmp` instead of the actual scenario directory and not reading error output carefully.

**What's needed to unblock**:
- A human or senior agent should run `cd agents/gym/scenarios/reflexion-npx-recovery/environment && npm install prettier` interactively to diagnose why it's failing (network issues? npm not available? permission problems?)
- Alternatively, redesign the scenario to not require node_modules at all — e.g., use a system-available tool like `sed` for the formatting task instead of prettier

**Files read (not modified):**
- agents/bob/workspace/projects/context-learning/extract-reflection.js
- agents/bob/workspace/projects/context-learning/phase2-experiment-desig

**Files modified:**
- agents/bob/workspace/projects/context-learning/extract-reflection.js

**Files read (not modified):**
- agents/bob/workspace/projects/context-learning/ph

**Files modified:**
- agents/gym/scenarios/reflexion-npx-recovery/scenario.json
- agents/gym/scenarios/reflexion-npx-recovery/task.md
- agents/gym/scenarios/reflexion-npx-reco

**Files modified:**
- agents/bob/workspace/projects/context-learning/phase2-experiment-design.md

**Files read (not modified):**
- agents/bob/workspace/projects/context-learn

**Files modified:**
- agents/bob/workspace/projects/context-learning/phase1-dd-audit-and-candidates.md

**Files read (not modified):**
- agents/bob/workspace/projects/context

## Open Questions
- Where do lessons live? Per-agent file? Shared? Both?
- How to match current situation to past lesson? Keywords? Embeddings? Categories?
- Who extracts lessons — reviewer, handler, or agent itself?
- Injected into prompt or retrieved on-demand via tool?
- How to avoid lesson bloat while keeping useful ones?

## Comments
- [2026-04-19 hao] Text works for changing behavior — don't over-index on structural enforcement. The question is: what's the right format, timing, and delivery mechanism for learned lessons?
- [2026-04-19 hao] This is long-term. Don't rush to build — experiment first, prove it works in gym, then adopt.


## Iteration Summary
- **Iter 1**: **Status:** done (2m58s)

**Files modified:**
- agents/bob/workspace/projects/context-learning/phase

- **Iter 2**: **Status:** done (1m42s)

**Files modified:**
- agents/bob/workspace/projects/context-learning/phase

- **Iter 3**: **Status:** done (4m3s)

**Files modified:**
- agents/gym/scenarios/reflexion-npx-recovery/scenario.

- **Iter 4**: **Status:** done (3m10s)

**Files modified:**
- agents/bob/workspace/projects/context-learning/extra

