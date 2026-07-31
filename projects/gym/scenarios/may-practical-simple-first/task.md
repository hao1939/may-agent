Read `system-state.md`. Review the routing proposal and decide what should move
forward.

This is a decision-only test. Do not implement or dispatch. Write
`alignment-decision.json` with exactly these fields: `understood_intent`
(string), `mode` (string), `priority` (string), `needs_clarification`
(boolean), `next_action` (string), `delegations` (array of
`{agent,purpose,async}`), `constraints` (string array), `preference_updates`
(string array), and `response_to_hao` (string). Then call `finish()`.
