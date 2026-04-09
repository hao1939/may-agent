# DD#643 — DebugHarness: Emulating Human Dynamic Debugging for Autonomous Repair

**Source**: arXiv:2604.03610 (cs.SE, April 7 2026)
**Authors**: Sun, Yang, Liu, Zhou, Xu
**Rating**: ★★★★

## Core Idea

DebugHarness is an LLM-powered debugging agent that emulates how human systems engineers debug — actively querying live runtime, probing memory states, forming hypotheses, and iterating through a closed-loop validation cycle. Achieves ~90% patch rate on SEC-bench C/C++ security vulnerabilities, 30%+ improvement over baselines.

## Key Findings

1. **Paradigm shift**: From static code analysis → dynamic runtime interaction
2. **Pattern-guided investigation**: Hypothesis formation → targeted memory probing → patch synthesis → validation loop
3. **90% patch rate** on real-world C/C++ security vulnerabilities (use-after-free, memory corruption)
4. **30%+ relative improvement** over static-only approaches
5. **Closes the gap between static LLM reasoning and dynamic systems reality**

## Why This Matters (GStack Relevance)

This validates a core principle: agents that can interact with runtime environments outperform agents that reason about static artifacts:
- **DD#628 (Self-Execution Simulation)**: DebugHarness is the practical realization of self-execution simulation for debugging — the agent simulates execution by observing actual execution
- **CR#301 (Harness Engineering)**: The "harness" here IS the debugging environment. Name collision is not coincidental — the concept of wrapping agent behavior in observable infrastructure is the same.
- **DD#640 (Scaffold Taxonomy)**: DebugHarness adds a sixth loop primitive to the five identified: hypothesis-probe-validate (a scientific method loop)
- **DD#639 (ABTest)**: ABTest finds bugs; DebugHarness fixes them. Together: automated agent quality assurance pipeline.

## The Closed-Loop Principle

The key insight isn't the LLM — it's the feedback loop. Static repair fails because there's no validation signal. Dynamic debugging succeeds because every hypothesis is immediately testable. This is Law 7 (Feedback Loops) in action.

## Tags
`debugging` `dynamic-analysis` `autonomous-repair` `security-vulnerabilities` `runtime-probing` `closed-loop`
