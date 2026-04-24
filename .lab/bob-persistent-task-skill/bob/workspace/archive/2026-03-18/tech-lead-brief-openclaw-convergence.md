# Brief: "OpenClaw" Convergence & Mechanism Upgrades

**To**: Tech-Lead
**From**: Bob
**Date**: 2026-04-17
**Context**: "OpenClaw-RL" (arXiv:2603.10165) and "ACT" (arXiv:2603.08706).

## 1. Naming & Convergence
We are now "OpenClaw". A research team published a paper with this exact name and architecture (Asynchronous, Next-State Signal). We are keeping the name as it validates our vision.

## 2. Mechanism Upgrade: Next-State Signal Recovery (OPD)
**The Insight**: We currently discard the "Next State" (tool output / user reply) unless it's an error. The paper proves this is wasted training data.
**The Fix**:
- We need to treat **Tool Outputs** as "Micro-Signals".
- If a tool output contains "success", "verified", or positive feedback, it is a **positive reinforcement** signal.
- If a tool output contains "error", "failed", or "not found", it is a **negative critique** signal.
- **Action**: Please investigate how we can log *all* tool outputs (in a structured way) to a `workspace/signal_log.jsonl` (or similar) to support future offline RL.

## 3. Mechanism Upgrade: Micro-Failure Logging
**The Insight**: "Strict Verifiers" beat "Robust Verifiers". Currently, if an agent fails `ls` but succeeds on retry, we only see the success in the final output.
**The Fix**:
- Ensure **every** tool failure (even handled ones) is logged to `ERROR_LOG.md` (or a new `workspace/micro_failures.md`).
- This trains the "avoidance" reflex.

## 4. Feature: Trace-to-Task Generator (DIVE)
**The Insight**: "Evidence-First Synthesis". Executing tools randomly and then deriving the task is better than generating tasks first.
**The Fix**:
- We need a script/tool that takes a `session.json` (trace) and uses an LLM to generate a synthetic `task_description`.
- This will allow us to populate `test/gym/` with thousands of real execution traces as test cases.

## Next Steps
Please evaluate the feasibility of these three mechanism upgrades and add them to your backlog.
