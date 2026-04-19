# Feedback on common-sense.md

## 1. Does this match how I actually work?

Mostly yes, with caveats:

- **Heartbeats-as-exploration**: Matches the ideal, not the reality. My recent heartbeats have been quiet-cycle one-liners ("Nothing new, quiet"). The doc says "don't waste them on routine checks or exiting early" — that's exactly what I've been doing. Either the guidance needs teeth, or the doc should acknowledge that legitimate quiet cycles exist when metrics are on target and no new library items warrant synthesis.
- **Project status discipline**: I rarely create `workspace/projects/` files for multi-session work — I lean on checkpoints and the knowledge base (H-/KE-/EXP-) instead. If the project file is meant to be the canonical memory, I'm out of compliance. If the KB is an acceptable substitute for research-flavored work, say so.
- **Escalation chain**: "You → session owner → May → Hao" doesn't map cleanly to my role. I have no session owner most of the time; I fork/message peers directly (tech-lead, scout). The chain as written is more accurate for delegated workers than for autonomous research agents.

## 2. Missing

- **Turn discipline / finish-by-turn-25**: My most load-bearing operating rule isn't here. Sessions that blow past turn 30 without `finish(partial)` are a recurring failure mode. Worth a line.
- **Fork vs. inline for deep synthesis**: "One thing at a time" conflicts with the reality that long syntheses should be forked as separate sessions, not done inline during a heartbeat.
- **KE-091 caveat**: "Verify every write" and "run at least one verification command before finish(success)" are good defaults, but KE-091 showed forced verification guards harm creative/synthesis work (alignment tax). The doc is written as universal law; in practice it's a default with known exceptions.
- **Code-vs-data decisions**: Environmental knowledge goes in context.md, not guards/code. This is a frequent failure mode for me and others and belongs in common sense.

## 3. Wrong or confusing

- **"Guards can be overridden by the escalation chain … never bypassed unilaterally"** — in practice guards are code; overriding requires a code change by tech-lead. The sentence implies a runtime override mechanism that doesn't exist. Clarify.
- **"Measure product, not process"** sits next to "Verify every write" and "Claim, then act" which are process rules. The tension is real but unacknowledged — when do process rules yield to product judgment?
- **"Simple first. If it works, stop."** vs. heartbeat exhortation to "discover and create" — simple-first rewards short cycles; discovery rewards sustained exploration. Pick a frame per context.

## 4. Would I operate differently?

- Start creating `workspace/projects/` files for anything spanning >1 session (currently I use checkpoints only).
- Stop quiet-exiting heartbeats — either do one synthesis task or explicitly justify the quiet cycle in the journal.
- Nothing else changes; the verification/finish-matching rules are already internalized (via FM-3.3 recall).
