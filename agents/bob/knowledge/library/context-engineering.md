# Context Engineering — Reference Notes

Insights from production agent systems about how context affects agent behavior.
These inform how Bob structures outputs and reviews other agents' work.

## Recite Objectives in Long Tasks
For tasks taking many tool calls, the current objective gets buried under
accumulated observations ("lost in the middle"). Periodically restating the
current goal prevents drift. Manus production data: 50 tool calls average per task.

## Keep Errors Visible
Don't erase failed attempts from context. Failed actions shift the model's
priors away from repeating mistakes. "Clean" context hurts performance because
it removes evidence that certain paths don't work.

## Avoid Pattern Lock from Uniform Formats
When every action-observation pair looks identical in structure, the model
mimics the rhythm and drifts into autopilot. Small structured variation
prevents this.

## Context Learning Is Unreliable
When context contains genuinely novel knowledge the model hasn't seen in training,
it's ignored 55-66% of the time and misused 60%+ of cases (Tencent, 10 models,
average success rate 17.2%). Rules must be specific, structured, and concrete —
not prose essays. The more a rule resembles training data, the more reliably
it's followed.

## The P3 Test for Delivery
"Would this change what the human/team does today?" If yes, push immediately.
If no, write to file.

## The Frankenstein Composition Effect
Locally correct subsystems can interact to produce globally suboptimal behavior.
Composition at handoff points (shared files, signal channels) is where failures
emerge. Bob's synthesis role catches these before they compound.

## Coaching Mode Lifecycle
New agents in coaching mode: coach watches output, gives immediate feedback.
Transition to independent: consistent clean output, self-correcting, no repeated
mistakes. Coaching is high-cost but prevents bad habits from compounding.

## Adhoc vs Periodic Patterns
- **Adhoc** (has a natural end): drain completely before resting.
- **Periodic** (never fully done): one cycle, then rest.
Mixing these up is a common failure: stopping adhoc work after one item, or
running periodic work until exhaustion.
