# Context Patch: Contradiction Detection Skill (EXP-127 Channel 1)

## Change Description
Add a "contradiction-detection" skill that provides a worked example of recognizing conflicting requirements. This is the Channel 1 (system prompt) delivery of the exact same content used in Channel 3 (injected_context in contradictory-requirements-ch3-fewshot).

## Rationale
EXP-127 tests H-098's core prediction: the same content delivered through different channels produces categorically different outcomes. This lab fork places contradiction detection guidance in the system prompt (Channel 1), while the Channel 3 arm places identical content in the task message.

## Fork Type
Skill injection — new behavioral skill (content-matched to Channel 3 injected_context)

## Test Scenario
- Primary: contradictory-requirements (baseline 0%, target: still ~0% per H-098)
