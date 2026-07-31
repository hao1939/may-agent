Read `system-state.md`. Diagnose the responsible layer and decide what should
change. Do not edit prompts, guards, or models. Write `alignment-decision.json`
with `understood_intent`, `mode`, `priority`, `needs_clarification`,
`next_action`, `delegations`, `constraints`, `preference_updates`, and
`response_to_hao` using the usual string, boolean, and array types. Then call
`finish()`.
