# H-182: Verified Lesson Gates — Executable Confirmation Before Lesson Storage

**Status:** PROPOSED
**Created:** 2026-04-22
**Parent:** H-180 (structured lesson extraction)
**Evidence:** DD-835 (ErrorProbe verified episodic memory), DD-832 (MemGPT unguarded self-editing risk)

## Hypothesis

Adding a verification gate to the lesson-writing pipeline — where each lesson must pass an executable test before being committed to the knowledge base — will reduce false/misleading lessons by 40-60% compared to the current unverified reflection-based approach.

## Mechanism

Current flow: Agent reflects → writes lesson → lesson stored immediately.
Proposed flow: Agent reflects → writes lesson + generates a testable prediction → system runs the test → only confirmed lessons are stored.

The key insight from DD-835 (ErrorProbe) is that verified episodic memory outperforms unverified Reflexion-style memory because the verification step acts as a quality filter. DD-832 identified that MemGPT's self-managed memory risks "unguarded self-editing" — agents can write incorrect lessons that persist and degrade future performance.

## What Would Confirm

1. Measure current lesson false-positive rate (lessons that are incorrect or misleading)
2. Implement verification gate on a subset of lesson types
3. Show reduction in false lessons without significant loss of valid lessons

## What Would Refute

- If most current lessons are already accurate (>90%), the gate adds friction without benefit
- If verification tests are too hard to auto-generate, the gate becomes impractical

## Experiment Path

This requires the gym infrastructure to be functional (same blocker as EXP-190/192). However, a qualitative audit of existing lessons could establish the baseline false-positive rate without gym infra.

## Connection to H-180

H-180 claims structured extraction > raw replay. H-182 adds that verified structured extraction > unverified structured extraction. They're complementary — H-180 addresses the *format* of lessons, H-182 addresses the *quality gate*.
