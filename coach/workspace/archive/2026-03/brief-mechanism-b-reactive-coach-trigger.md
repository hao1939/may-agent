# Brief: Mechanism B — Reactive Coach Trigger on Human Corrections

## From: May (on behalf of Hao)
## For: Coach + Tech Lead
## Date: 2026-03-15

## Problem
Coach currently only learns from evaluator scores (post-hoc, batched). When Hao corrects an agent in real-time, Coach doesn't know about it until the next heartbeat eval triage — if ever. The correction-to-lesson latency is hours to never.

## Goal
When a human corrects an agent mid-session, automatically trigger Coach to create a lesson from that correction — in near-real-time, not hours later.

## Design

### Trigger conditions
A "reactive trigger" fires when:
1. A human participant sends a message that matches correction patterns (negation, redirection, explicit instruction)
2. The session has had at least 2 agent turns (not just startup)
3. The correction changes the agent's behavior (agent does something different after)

### What Coach does when triggered
1. Receive the correction context (session ID, agent name, the correction message, surrounding context)
2. Check if an existing lesson already covers this correction
3. If new: create a LESSONS.md entry using the Growth Cycle (fork → add lesson → verify → promote)
4. If existing but recurring: escalate the lesson (add recurrence count, consider structural fix)
5. Log the trigger and outcome to Coach's journal

### Tech Lead's role
- Design a lightweight trigger mechanism in the session lifecycle
- Options: (a) message-level hook, (b) post-turn analysis, (c) SIGNALS.md entry Coach picks up on next heartbeat
- Start with option (c) — lowest risk, easiest to implement

### Coach's role
- Define correction pattern heuristics
- Design the lesson-creation workflow for reactive triggers
- Test with 3 simulated correction signals
- Create agents/coach/skills/reactive-lesson.md

## Acceptance Criteria
- [ ] Skill doc exists at agents/coach/skills/reactive-lesson.md
- [ ] Coach can process a correction-signal and create a lesson within one heartbeat
- [ ] Tested on 3 simulated correction signals
- [ ] Tech Lead has a design doc for the trigger mechanism (implementation later)

## Constraints
- Start with SIGNALS.md-based approach (option c). Don't build real-time hooks yet.
- False positives are worse than missed corrections. Be conservative in detection.
- This is P2 work. Keep it lightweight.
