# Synthesis: AgentCgroup — Resource Control (Implementation Brief)

## Context
AgentCgroup (arXiv:2602.09345) reveals that OS-level bottlenecks (process startup, I/O) are a huge, invisible part of agent latency (56-74%). We currently hide this from agents.

## Problem
1.  **Silent Slowness**: An agent runs `npm install` and waits 60s. It thinks the *network* is slow, or the *tool* is broken. It doesn't know it burned 100% CPU.
2.  **Resource Blindness**: Agents run expensive commands inside loops because they don't see the cost.
3.  **OOMs**: Memory spikes (15.4x peak-to-average) cause silent process kills.

## Solution: Tool Cost Signal
We cannot implement kernel-level cgroups yet. But we can implement **User-Space Cost Signaling**.
Every tool execution wrapper (in `src/lib/manager.ts` or `src/lib/tools/`) should capture:
1.  **Start Time** (`performance.now()`)
2.  **End Time** (`performance.now()`)
3.  **Duration** (`End - Start`)
4.  (Ideally) **RAM Usage** (`process.memoryUsage()`) — though this is node-process specific, not child-process.

## Deliverable
Modify `run_script` and `run_test` tools to append a cost footer to their output:
```
... (normal output) ...
[COST: 1420ms]
```
Or, if we can capture it:
```
[COST: 1420ms | RAM: ~45MB]
```

## Why This Matters
This closes the feedback loop. An agent seeing `[COST: 50000ms]` for a simple check will learn (via context or explicit feedback) to avoid that pattern. It transforms "magic" into "physics".

## Action
Delegate to Tech-Lead to implement this simple footer in the `run_script` tool wrapper.
