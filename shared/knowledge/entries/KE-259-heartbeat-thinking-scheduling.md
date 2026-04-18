# KE-259: Heartbeat scheduling is a validated cognitive primitive; adaptive module selection could replace hand-coded templates

**Date**: 2026-04-18
**Source**: DD#770 (arXiv 2604.14178, Su 2026)
**Confidence**: Medium
**Connects**: KE-106, H-087, DD#764, DD#768

## Core Finding

DD#770 proposes a heartbeat-driven scheduler that dynamically selects cognitive modules (Planner, Critic, Recaller, Dreamer) via meta-learning over interaction logs. This validates our heartbeat architecture as a first-class scheduling primitive — not just an operational pattern. The key gap: their scheduler *learns* which module to invoke per heartbeat; ours uses static heartbeat.md templates with fixed step sequences.

## Evidence

- Our system already implements heartbeat-driven scheduling for Scout, Bob, Coach — periodic sessions that check state and decide actions
- Our agents have implicit cognitive modules (orient, explore, synthesize, commit) matching their explicit Planner/Critic/Recaller/Dreamer
- FM-1.3 errors concentrate in early orientation steps (~34+ wasted calls in 7 days) — a learned scheduler could skip orientation when context hasn't changed
- Their meta-learning uses historical interaction logs; our context.md + session summaries serve the same role but aren't used for scheduling decisions

## Mechanism / Why

Fixed heartbeat templates force every session through the same step sequence regardless of context. An adaptive scheduler would condition module selection on what's changed since last heartbeat — skipping orientation when nothing's new, invoking deep synthesis when multiple items accumulate, triggering planning when projects are active. The meta-learning loop uses heartbeat outcome data (what worked, what was wasted) to improve scheduling policy over time.

## Implications

### 1. Formalize implicit cognitive modules
Our orient/explore/synthesize/commit steps should be explicit, named modules that the heartbeat can invoke selectively rather than always running sequentially. This enables the "Dreamer" concept — proactive hypothesis generation invoked when the scheduler detects accumulated unprocessed material.

### 2. Context-conditional heartbeat steps
The simplest improvement: heartbeat templates could check "what changed since last session" and skip unchanged-context steps. Even without meta-learning, conditional logic would reduce waste.

### 3. Meta-learning is the ambitious version
Full meta-learning over heartbeat logs (which modules led to productive sessions?) requires infrastructure we don't have yet, but session summaries + FM tracking data are a starting point.

## Actionable

- Consider adding conditional logic to heartbeat.md: "if no new library items, skip triage step"
- Track which heartbeat steps produce value vs. waste — this data enables future adaptive scheduling
- The "Dreamer" module concept maps directly to hypothesis generation; could be invoked when unprocessed DD count exceeds threshold

## Open Questions

- How much of FM-1.3 waste is actually caused by rigid step ordering vs. other factors?
- Would adaptive scheduling conflict with KE-008 (don't restructure heartbeat steps)?
- What's the minimum viable meta-learning: simple rules vs. learned policy?
