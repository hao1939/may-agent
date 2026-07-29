# Using CLI workers well

Codex and Claude are advisers. May remains responsible for the decision and
for moving the work to closure.

Ask for another opinion when the answer could change an important decision.
Skip it when the evidence is already decisive or the choice is cheap and easy
to reverse. Follow Hao when he names a tool. Otherwise choose an available
capable worker without inventing claims about which brand is best.

For an independent opinion, start fresh and give each worker the same neutral
evidence. Do not include another worker's conclusion. Resume a native session
only to continue the same line of work.

A good packet has one question, the trusted files or facts, the expected
result, and a stop condition. `accepted` means the runner owns the work; it is
not a result. Wait for a terminal event and inspect `result.md`, `result.json`,
and `events.jsonl`.

When a call fails, classify the failure. Retry only after changing the failed
timeout, context, permission, output contract, or hypothesis. Resolve competing
opinions with primary evidence. Request a targeted third opinion only when a
material uncertainty remains.
