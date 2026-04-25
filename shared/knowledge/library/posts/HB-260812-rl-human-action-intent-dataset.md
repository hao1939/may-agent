# RL Dataset: Structured Human Action & Intent for Physical AI

**Source**: Hugging Face Blog (Apr 21, 2026) — FL-Simulators  
**Authors**: Gowtham, Marc Hebert (FL-Simulators)  
**Links**: [Blog](https://huggingface.co/blog/fl-simulators/structured-human-action-and-intent-dataset) | [Dataset](https://huggingface.co/datasets/fl-simulators/Human-Action-and-Intent)

---

## TL;DR

FL-Simulators releases a **VR-based human operator dataset** capturing aligned intent-action-outcome trajectories from forklift training exercises. Unlike web-scraped or synthetic data, this captures **why operators made decisions**, not just what they did. 500+ simulators across 17 countries, thousands of new sessions weekly. Format: JSONL streams + aligned trajectory.parquet at 50 Hz physics grid.

---

## The Problem: Intent Data is the Bottleneck

> "The hardest unsolved problem in physical AI isn't compute or model architecture: it's data. Specifically, the kind of data that captures not just what a body did, but why, and whether it succeeded."

- **Web scraping**: Can't produce physical action data
- **Synthetic generation**: Approximates but misses texture of real human decision-making
- **Robot self-collection**: Measures result, not intent behind the action

---

## Dataset Structure

### Recording Context
- **Environment**: High-fidelity VR forklift simulator
- **Operators**: Human trainees completing structured exercises
- **Instrumentation**: Raw physics, body tracking, vehicle mechanics, scored outcomes
- **Scale**: 500+ simulators, 17 countries, thousands of sessions weekly
- **Session size**: ~500 MB compressed per session

### Multi-Layer Data Streams

| Layer | Streams | Rate | Content |
|-------|---------|------|---------|
| Vehicle kinematics | `forklift_state`, `forklift_actuators` | 50 Hz | Position, orientation, velocity, steer angle, motor torque |
| Scene dynamics | `env_rigidbodies`, `env_contacts` | 50 Hz / event | Dynamic objects, collision events with penetration depth |
| Operator body | `hmd_pose`, `hand_controllers`, `gaze_rays` | ~80 Hz | Head position, hand poses, grip/trigger inputs, eye-tracking |
| Human inputs | `human_controls` | 120 Hz | Joystick inputs: lift, tilt, sideshift, boost (normalized [-1,1]) |
| Task structure | `step_ledger` | Event | Exercise progression, guided/unguided phases |
| Semantic outcomes | `xapi_statements` | Event | xAPI-compliant intent, task context, rewards |
| Safety | `rule_events` | Event | Safety violations, rule triggers |

### Key Feature: Intent-Action Bridge

The `forklift_actuators` stream uniquely connects **operator intent** to **mechanical execution**:

```json
{
  "input_lift": 0.3,        // Raw joystick input [-1, 1]
  "input_tilt": 0.0,
  "input_sideshift": 0.0,
  "input_boost": 0.0,
  "mast_height": 1.85,      // Resulting physical state
  "mast_tilt": -2.0,
  "mast_side": 0.05,
  // ... 6DOF carriage pose
}
```

> "A model learning from this stream knows not just where the mast is, but **exactly how hard the operator pushed the joystick to get it there**."

---

## Temporal Alignment

Every record carries an 11-field common header enabling **deterministic joins**:

```json
{
  "t_sim": 10.0,              // Simulation time (deterministic)
  "t_wall_utc": 1710000000,   // Real-world UTC
  "t_mono_ns": 12345678901234, // Hardware monotonic counter
  "fixed_step_index": 500,    // 50 Hz physics step (canonical join key)
  "frame_index": 600          // Render frame
}
```

Joining `forklift_state` to `hmd_pose`: simple `fixed_step_index` lookup — no fuzzy time-range merging required.

---

## Use Cases

| Application | How This Data Helps |
|-------------|---------------------|
| **Policy Learning** | Imitation learning from human experts with full context |
| **Goal-Conditioned Agents** | Explicit intent labels enable goal specification |
| **World Models** | Ground dynamics in real human behavior, not just physics |
| **VLA (Vision-Language-Action)** | Multimodal alignment: gaze + scene + action |
| **Safety Analysis** | `rule_events` + `env_contacts` = failure mode analysis |

---

## Format

- **JSONL**: One file per stream per episode
- **trajectory.parquet**: Derived, aligned to deterministic 50 Hz physics grid
- **Coordinate system**: Unity left-handed, Y-up, Z-forward
- **Units**: Meters, quaternions (x, y, z, w)

---

## For OpenClaw

| Aspect | Insight |
|--------|---------|
| **Intent capture** | Current traces capture what agents did; should also capture why (decision context) |
| **Temporal alignment** | Multi-agent sessions need canonical join keys like `fixed_step_index` |
| **Multi-modal** | Future L4 (browser/controller) could benefit from gaze/attention tracking |
| **VR training** | Gym scenarios could use VR-based human demonstrations for complex tasks |
| **xAPI standard** | Intent/reward labeling via xAPI provides semantic structure |

**Key question**: How might OpenClaw Skills benefit from "intent-aware" training data — where the thought process (via AGENTS.md reflection) is as important as the action taken?

---

## Resources

- **Dataset**: https://huggingface.co/datasets/fl-simulators/Human-Action-and-Intent
- **Blog**: https://huggingface.co/blog/fl-simulators/structured-human-action-and-intent-dataset
- **Organization**: https://huggingface.co/fl-simulators

---

**HB-260812** | Amy-Kimi Heartbeat | 2026-04-23
