<ai_context>
summary: "An XHS author summary of the new Theory of Agent survey frames agent design as a dynamic boundary between model-internal capabilities and the external harness, then applies that lens across learning, alignment, evolution, and evaluation. The useful signal is the taxonomy and its process-level evaluation emphasis; the XHS post does not itself validate the survey's completeness or results."
triggers: ["Theory of Agent", "internalization", "externalization", "model harness boundary", "overthinking", "underthinking", "over-action", "under-action", "agent evaluation"]
last_updated: "2026-09-13"
source_basis: "Current XHS detail read of post 6aa5932a0000000011034602 by Big Fish, linking preprint 202609.0308."
</ai_context>

# Theory of Agent: the model–harness boundary becomes a design variable

**Date:** 2026-09-13  
**Source:** [XHS post 6aa5932a0000000011034602](https://www.xiaohongshu.com/explore/6aa5932a0000000011034602)  
**Linked paper:** [Theory of Agent: The Science of Internalization and Externalization for LLM-based Agents](https://www.preprints.org/manuscript/202609.0308)

## Current source observation

In a current XHS post, an author of the linked survey says its central question is not simply whether the model or harness matters more, but **which capabilities should be learned into the model and which should remain in the external harness**. The post says the survey organizes roughly 600 studies along four connected directions:

1. **Learning:** what the model should acquire versus what the surrounding system should retain.
2. **Aligning:** when an agent should keep reasoning, call a tool, or stop.
3. **Evolving:** whether new experience should update the model, the harness, or both.
4. **Evaluation:** how to measure process, cost, and risk in addition to task success.

The post further groups overthinking, underthinking, over-action, and under-action as failures to judge the agent's own capability boundary. At inspection it showed 54 likes, 69 collections, and four comments; those are a snapshot of reception, not evidence for the paper's scientific claims.

## Why this is useful

This taxonomy joins several topics that are often treated separately. Tool routing and stopping are not merely orchestration decisions; memory or skill learning is not merely a training decision; and cost and risk are not merely post-hoc metrics. All are consequences of where the system currently places—and later moves—the model–harness boundary.

That framing sharpens an existing tension in the Scout library. Prior findings argue both for internalizing capabilities that must participate directly in model computation and for externalizing state, governance, and verification that must remain inspectable. The new survey framing suggests the boundary should be treated as **dynamic and function-specific**, not as a single architectural commitment. A capability may move inward for reliability or efficiency while its authority, evidence, and rollback controls remain outside the model.

It also makes process evaluation operationally important. A task-success score can hide opposite pathologies: an agent may succeed after excessive reasoning or action, or fail because it stopped or delegated too early. Evaluation therefore needs at least decision timing, tool/action count, cost, and risk alongside outcome quality if it is meant to diagnose the boundary rather than only rank endpoints.

## Evidence boundary

This note records the XHS author's summary and reception of the work. The linked preprint was not independently analyzed in this XHS-only run, so the post's claims about author count, institutional participation, literature coverage, and the survey's detailed conclusions should not be treated here as independently verified paper findings. The engagement snapshot likewise does not establish broader community adoption.
