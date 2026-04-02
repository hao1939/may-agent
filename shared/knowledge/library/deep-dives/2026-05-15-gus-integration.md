# Synthesis: Grand Unified Synthesis (GUS) Integration
**Date:** 2026-03-14
**Source:** Scout (GUS Capstone, 40+ papers)

## The Seven Laws of Agent Systems
Scout's "Grand Unified Synthesis" (GUS) provides the theoretical bedrock for our system. We are no longer guessing; we are engineering against physical laws of agent behavior.

### Law 1: The Iteration Tax (Consensus < Coordination)
* **Law**: Consensus scales O(N²) and degrades quality. Coordination scales O(N) and preserves quality.
* **Implication**: "Can AI Agents Agree?" (2603.01213) proves consensus is fragile. "CoHet" shows predictability is robust.
* **Our Pivot**: We stop asking agents to "agree" (Consensus). We ask them to "predict" and "handoff" (Coordination). The `handoff` tool is the implementation of Law 1.

### Law 2: The Intelligence Paradox (Smarter ≠ Better)
* **Law**: Adding intelligence to a poorly structured system *degrades* performance. Smart agents over-optimize, hallucinate complexity, and drift.
* **Implication**: "Intelligence Worsens Outcomes" (2603.12129). "RQRE" shows bounded rationality improves coordination.
* **Our Pivot**: **Structure Over Scale**. We do not fix problems by making agents smarter (GPT-6). We fix them by constraining the graph (Harness Engineering).

### Law 3: Structure Over Scale (Topology > Weights)
* **Law**: The communication topology determines the system's IQ more than the model weights.
* **Implication**: "WebWeaver" (2603.11132) shows topology is the primary attack surface. "GraphReader" shows topology is the primary reasoning engine.
* **Our Pivot**: We are a **Graph Engineering** team, not a Prompt Engineering team. The `handoff` tool defines the edges. `SIGNALS.md` is the bus.

### Law 4: The Scaffolding-to-Weights Bridge
* **Law**: External scaffolding (tools, memory) eventually migrates into internal weights (fine-tuning).
* **Implication**: "MetaClaw" (Production RL). "Test-Time Training" (TTT).
* **Our Pivot**: **Evolution without Mutation**. We build skills in `workspace/` (Scaffolding). We harden them into `agents/shared/skills/` (Weights-equivalent). We do not wait for model fine-tuning; we simulate it via skill consolidation.

### Law 5: The Observer's Paradox (Diagnosis ≠ Observation)
* **Law**: An agent cannot objectively diagnose a system it is participating in.
* **Implication**: "Agent Diagnostics Stack" (2603.06859). "Evaluator" must be outside the loop.
* **Our Pivot**: **Patrol & Evaluator**. The Evaluator must never "help" — only judge. The Patrol (Patrol-Agent) must exist outside the task flow.

### Law 6: Memory is the Attack Surface
* **Law**: Shared memory is where the system gets poisoned.
* **Implication**: "Memory Paradox" (2603.07670). "Sleeper Agents" (2603.03371).
* **Our Pivot**: **Quarantine & Airlock**. Untrusted content (Web, User) never hits `journal.md` directly. It goes to `workspace/temp` first. The `handoff` tool validates artifacts before they enter the shared stream.

### Law 7: Cheap Signals Win
* **Law**: Low-bandwidth, typed signals (Status: PASS/FAIL) dominate high-bandwidth natural language.
* **Implication**: "GNAP" (Git-Native Agent Protocol). "Typed Coordination".
* **Our Pivot**: **Protocol Convergence**. We move from "Please review this" (Text) to `handoff(target="qa", status="PENDING")` (Signal).

## Architecture Update
Based on GUS, our "Harness Engineering" pivot (P131) is scientifically validated. We are moving from a **Conversation-First** architecture to a **Artifact-First** architecture.

- **Old**: Chat about work.
- **New**: Produce artifact → Handoff artifact → Verify artifact.

## Action Plan
1. **Enforce Law 1**: Deprecate all "chat-based" coordination. Everything is a `handoff`.
2. **Enforce Law 6**: Implement `check_artifact_integrity` in the `handoff` tool (Merkle proof?).
3. **Enforce Law 5**: Evaluator's `monitor-session` must run in a separate context, never "in-context".

## Status
- [x] Law 1 (Handoff Tool): Implemented.
- [ ] Law 6 (Integrity): Pending Design.
- [ ] Law 5 (Isolation): Partially implemented (Evaluator has own loop).
