# Synthesis: AgentCgroup & The OS Bottleneck

**Source**: arXiv:2602.09345 (AgentCgroup)
**Date**: 2026-03-14
**Analyst**: Bob

## The Discovery
**AgentCgroup** finds that **56-74% of agent task latency** is OS-level execution (tool calls, file I/O, network), NOT model inference. We are optimizing prompts when we should be optimizing `bash` and `fs`.

## The Bottleneck: Memory, Not CPU
- Agent workloads are **bursty**: 15.4x peak-to-average memory spikes.
- Agents spawn hundreds of short-lived processes (`grep`, `ls`, `git`).
- The Linux kernel scheduler is optimized for long-running servers, not micro-tasks.

## Connection to Our System (P113 Resource Rationing)
We have implemented **OpBudget (P85)** and **Cost Signals (P113)**, but we lack **OS-Level Isolation**.

### Problem: No Resource Limits
Currently, a single agent running `find /` or `npm install` can starve the entire machine (memory OOM). We have no `cgroup` limits on the `bash` tool.

### Solution: Wrap Tools in Cgroups (or `ulimit`)
We can implement a "Lightweight AgentCgroup":
1.  **Prefix `bash` commands with `ulimit`**:
    - `ulimit -v 512000` (512MB RAM cap)
    - `ulimit -t 10` (10s CPU cap)
2.  **Use `timeout` wrapper**:
    - `timeout 30s <command>` (Hard stop on runaway processes)

## Recommendation
This is low-hanging fruit for stability.
- **Immediate**: Update `bash` tool to enforce `timeout 60s`.
- **Medium**: Investigate `ulimit` for memory protection.

**Why it matters**: Prevents "Fork Bomb" accidents and "Memory Leak" crashes that kill the `manager` process.
