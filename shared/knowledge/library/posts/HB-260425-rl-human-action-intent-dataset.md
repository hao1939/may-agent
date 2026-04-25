# RL: Structured Human Action & Intent Dataset for Physical AI

**Source**: Hugging Face Blog (FL-Simulators)
**Date**: April 21, 2026
**Authors**: Gowtham, Marc Hebert
**URL**: https://huggingface.co/blog/fl-simulators/structured-human-action-and-intent-dataset

---

## Core Thesis

> "The hardest unsolved problem in physical AI isn't compute or model architecture: it's data. Specifically, the kind of data that captures not just what a body did, but why, and whether it succeeded."

Web scraping produces "what". Synthetic generation approximates "why" but misses texture. Robot self-collected data captures results, not intent.

---

## Dataset Overview

VR forklift training captures **intent-action-outcome trajectories**:
- **500+ simulators** deployed across **17 countries**
- **50 Hz physics** + **~80 Hz render** + **120 Hz controls**
- **xAPI semantic annotation** for intent capture
- **~500 MB compressed** per session
- Thousands of new sessions weekly

---

## Layered Data Architecture

| Layer | Streams | Rate | Purpose |
|-------|---------|------|---------|
| Vehicle kinematics | forklift_state, forklift_actuators | 50 Hz | Physics-grounded motion |
| Scene dynamics | env_rigidbodies, env_contacts | 50 Hz/event | World interaction |
| Operator body | hmd_pose, hand_controllers, gaze_rays | ~80 Hz | Human embodiment |
| Hardware inputs | human_controls | 120 Hz | Intent signal |
| Task structure | step_ledger | event-driven | Progress tracking |
| Semantic outcomes | xapi_statements | event-driven | **Intent annotation** |
| Safety violations | rule_events | event-driven | Failure modes |

---

## Temporal Alignment: The `fixed_step_index` Pattern

Every record carries an 11-field common header with **deterministic join keys**:

```json
{
  "session_id": "uuid",
  "episode_id": "uuid", 
  "t_sim": 10.0,              // Simulation time (deterministic)
  "t_sim_delta": 0.02,        // Physics timestep
  "t_wall_utc": 1710000000,   // Wall clock (for debugging)
  "t_mono_ns": 123456789,     // Monotonic hardware counter
  "frame_index": 600,         // Render frame
  "fixed_step_index": 500     // **Physics step — canonical join key**
}
```

**Key insight**: `fixed_step_index` increments at fixed 50 Hz physics rate. Joining `forklift_state` to `hmd_pose` is a **simple integer lookup**, not fuzzy time-range merge.

---

## xAPI Intent Annotation

Uses **Experience API (xAPI)** for semantic statements:
- `"attempted"`, `"completed"`, `"failed"` with context
- Links action to learning objective
- Captures **why** not just **what**

---

## What This Means for OpenClaw

1. **Trace as trajectory**: Agent session traces should capture similar multi-layer structure — model outputs (physics), tool calls (actions), context (state), errors (violations)

2. **Deterministic join keys**: Use `fixed_step_index` equivalent for multi-agent session alignment — simple integer beats timestamp matching

3. **Intent annotation gap**: Our traces capture "what" but not "why" — consider adding intent/goal fields to session protocol

4. **Error as signal**: `rule_events` stream captures failures explicitly — our Error Log could learn from this structured failure taxonomy

5. **Skill learning from traces**: Dataset enables "policy learning, goal-conditioned agents, world model grounding" — same goals for Skill evolution from traces

---

## Cross-Reference: Save the Traces

This dataset validates the "Save the traces!" thesis — conversation/agent traces **are** the training data for next-gen systems. The difference is:
- HF Blog: **Consumer** traces (backup, recovery, skill extraction)
- FL-S Dataset: **Industrial** traces (policy learning, world models)

Both point to: **traces as infrastructure-level data asset**.

---

## Open Questions

- Can we add xAPI-style semantic annotation to agent sessions?
- What would `fixed_step_index` equivalent be for async agent workflows?
- Should Error Log evolve toward structured "violation events" taxonomy?

---

**Rating**: ★★★★★ — Demonstrates production-grade trajectory capture with deterministic alignment, validates trace-as-asset thesis, provides concrete schema for multi-stream agent telemetry.
