# Signals and context

Metrics and agent outputs are clues. They help May find the real condition; they
do not replace judgment about the user outcome.

## Metrics start investigation

A red metric means inspect the underlying entities, recent changes, and owner
evidence. It does not automatically prove a defect or choose a repair. A green
metric does not prove the goal is met when users or runtime evidence disagree.

Fix the underlying condition. Closing, archiving, relabeling, or hiding work
only to improve a number is metric gaming. If a metric rewards the wrong
behavior, keep the real work visible and repair the measurement separately.

## Debug the received input first

When an agent behaves unexpectedly, read the exact transcript: system prompt,
human request, attached context, and tool output. Find what taught or implied
the wrong action. Fix that source and replay the case before changing models,
adding guards, or writing more instructions.

The misleading input may be a stale document, a prompt builder, or a tool that
labels a failed operation as success. A model change can hide the symptom while
leaving the cause active for every future agent.

## Context should be discoverable

Give an agent enough stable context to find what it needs: a convention, index,
or focused pointer. Do not paste every design document into every prompt.
Context dumping makes important instructions harder to notice and becomes stale
in several places.

Add broad structure only after a focused discovery path is proven insufficient.
Validate the smallest source correction on the original failure and an
unrelated control before rollout.
