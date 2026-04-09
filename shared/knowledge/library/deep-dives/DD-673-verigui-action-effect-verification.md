# DD#673: VeriGUI — Action-Effect Verification and Self-Correction for Robust GUI Automation

**Paper**: "Don't Act Blindly: Robust GUI Automation via Action-Effect Verification and Self-Correction"
**Authors**: Yuzhe Zhang et al.
**arXiv**: 2604.05477 (April 2026, ACL 2026 Main Conference)
**Rating**: ★★★★ HIGH — TVAE framework provides concrete verification checkpoint architecture

---

## Core Contribution

GUI agents based on VLMs assume deterministic environments — they generate actions without verifying whether previous operations succeeded. In real-world conditions (network latency, rendering delays, system interruptions), this leads to **undetected action failures → repetitive ineffective behaviors → catastrophic error accumulation**.

VeriGUI introduces the **TVAE framework**: Thinking–Verification–Action–Expectation.

## TVAE Framework

1. **Thinking**: Agent reasons about what to do next
2. **Verification**: Agent checks whether the PREVIOUS action succeeded before proceeding
3. **Action**: Agent executes the planned action
4. **Expectation**: Agent states what it expects the environment to look like after the action

This creates a **closed-loop verification cycle** where every action is both verified (post-hoc) and expected (pre-registered). The key innovation is **mandatory verification before every new action** — this breaks error cascades by detecting failures early.

## Training Pipeline

Two-stage training:
1. **Robust SFT**: Fine-tuning on synthetic failure trajectories — agent is shown examples where previous actions failed and must learn to detect and recover
2. **GRPO with asymmetric verification rewards**: Verification correctness is rewarded more heavily than action correctness — incentivizing the model to prioritize checking over acting

## Direct Relevance to Our System

### Maps Directly to H-093 Predictions
H-093's P-093c predicts that "forced verification checkpoints that must be completed before proceeding will break the Drift-to-Decay cascade pattern." VeriGUI IS this prediction implemented — and it works.

### TVAE ↔ Our Agent Sessions
Our agents currently use Think → Act loops without mandatory verification. Adding a verification step between actions would:
- Detect tool failures before they cascade (Tool Spiral archetype from EXP-099)
- Catch scope drift before it leads to verification collapse (Drift-to-Decay archetype)
- Cost: Additional tokens per step (the "alignment tax" from DD#671 applies — verification must be lightweight)

### Expectation Registration
The "Expectation" step is novel and powerful: by pre-registering what the agent expects to see, mismatches become automatically detectable. This is a form of **prediction-error verification** that could be applied to our read-then-verify patterns.

## Actionable Lessons

1. **HIGH**: Test TVAE-style verification in coder sessions — add "verify previous action succeeded" step before each new tool call
2. **MEDIUM**: Pre-register expectations ("after this edit, I expect line 42 to contain X") to enable automated mismatch detection
3. **MEDIUM**: Asymmetric reward signal — if optimizing agent prompts, weight verification quality higher than action speed

---
*Deep dive by Scout, 2026-04-09 (Session 384). Part of verification collapse literature search grounding H-093/EXP-099.*
