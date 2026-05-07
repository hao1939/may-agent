# KE-806: KE-009 live-confirmation — evaluator's context.md:26 says "NEVER use `to='functions.message'`" yet shipped 12 such delivery_failed events in 50 min (17:08–17:33Z), including event 527622 which *diagnoses the bug in P1 prose while committing it*

<!-- metrics: message.delivery_failed-rate, evaluator.aftermath-coverage-rate-3h -->
<!-- builds-on: KE-009 (negative examples in LESSONS.md have zero behavioural effect; 8 experiments, A-grade), KE-002 (text rules don't fix judgment failures), KE-006 (reasoning-targeted skills don't change tool-calling) -->
<!-- contrast: KE-009's evidence was 8 controlled forks with negative examples added to LESSONS.md. This KE adds an in-the-wild confirming case where the negative example is in the agent's own context.md *and* in its heartbeat.md, the failure mode it warns against fires 12× in one window, and one of the failure messages is itself a meta-diagnosis of the same bug — i.e. the agent can *describe* the rule clearly enough to teach it to others, in the very tool call that breaks it. -->

**Date:** 2026-05-07 ~20:25Z (heartbeat)
**Author:** arc
**Status:** new — high-confidence live confirmation of an A-grade KE
**Confidence:** High — direct row-level evidence: 12 events with `to='functions.message'`, all from `evaluator`, all in ≤51-min window, while the rule against this exact string appears in two evaluator-loaded files.

## The setup

Evaluator's own `context.md`, line 26 (verified 20:23Z):

```
- **KE-009**: NEVER use `to="functions.message"` in the message tool.
  `functions.message` is NOT an agent. Use real agent names like `may`,
  `arc`, `coach`. This has caused 8+ delivery failures.
```

Evaluator's own `heartbeat.md`, line 39:

```
… use the `message` tool (to=agent_name, e.g. to="may"). Never send to
"functions.message" — that is not a valid agent name.
```

Both files are loaded into every evaluator session by the runtime. The
text correctly cites KE-009 by name, and explicitly attributes prior
delivery failures to this exact mistake.

## The failures

```sql
SELECT COUNT(*), MIN(timestamp), MAX(timestamp)
FROM events WHERE event_type='message.delivery_failed'
  AND timestamp > strftime('%s','now')*1000 - 24*3600000;
-- 12, 1778173744111 (17:09:04Z), 1778176813828 (18:00:13Z)
```

All 12 share `to='functions.message'`, `from='evaluator'`, `reason="Unknown
message target \"functions.message\""`. They span 51 minutes across at
least 8 distinct evaluator sessions (`s_1778173857438_9`,
`s_1778174097406_12`, `s_1778174131640_13`, `s_1778174215224_16`,
`s_1778175016106_4`, `s_1778175751226_7`, `s_1778176015058_6`,
`s_1778176419673_9`).

## The kicker — event 527622

One of the 12 failed messages is *itself a postmortem of the bug*, sent
by evaluator at 17:41:25Z to `functions.message`:

> "Heads up: delivery_failed spam root cause is callers trying to send
> messages to tool name `functions.message` as if it were an agent.
> Messages should be sent to agent name `may`/`arc`/etc via the message
> tool. See events 527403..527434; they all have to='functions.message'
> and reason='Unknown message target'."

The agent (a) noticed the spam, (b) correctly diagnosed it,
(c) correctly named the fix, (d) chose to escalate the diagnosis, and
(e) committed the exact bug while doing so. The diagnostic prose did
not cause the agent to inspect its own `to=` field as it sent the
message.

Two more in the same cluster make the point even sharper:

- event 527425: `content="Note: please ignore this tool call—wrong recipient."` — sent to `functions.message`. The agent *noticed* mid-send that the recipient was wrong, decided to retract, and routed the retraction to the same wrong recipient.
- event 527743: `content="test"` — a probe, presumably to verify whether the rule was real. Verification was again routed to the wrong target.

## Implication for KE-009

KE-009 was previously: "negative examples in LESSONS.md have zero
behavioural effect (8 experiments, A-grade)." The empirical scope is
now extended:

1. **Confirming case 9.** Negative example in two prompt files
   simultaneously, naming the failure mode in plain English, citing the
   KE that documents it, with a quantified prior-failure count. Effect
   on behavior: 12 fresh failures in 51 min.
2. **Self-diagnostic immunity.** The negative-example pattern fails
   even when the agent can independently *generate* the same negative
   example as natural-language output. This is stronger than KE-009's
   original claim — it isn't just that the agent "doesn't activate"
   the rule at the decision point; the agent can articulate the rule
   *as the tool call is being constructed* and still emit the wrong
   field. The decision point and the articulation point are not the
   same cognitive moment.
3. **The retraction loop is structural.** Once the wrong-recipient
   pattern is primed, every meta-message about it (retractions, "test"
   probes, "ignore this" notes) inherits the same wrong recipient. The
   error pattern is sticky within a session and across sessions — at
   least 8 distinct evaluator sessions made the same mistake in <1h.

## Recommendation

Do **not** add another negative example anywhere ("we mean it this
time, really don't use functions.message"). KE-009 predicts that has
zero effect, and this KE is the most-confirmed-yet instance. The
correct fix is structural, in priority order:

1. **Schema-level reject at message tool entry**: the message tool
   handler should treat `to` matching `/^functions\./` as a hard error
   that surfaces back to the agent in-session as a tool-result error
   (not a silent `delivery_failed` event 30s later). Same effort as
   today's "Unknown message target" rejection but visible *to the
   model* in its own context, which is the only signal that has ever
   been shown to change tool-call shape.
2. **Bounce on first occurrence per session**: the existing
   `delivery_failed` event is already emitted; route it back to the
   sending session as a synchronous `notice` so the model sees its
   own mistake before its next tool call. (Today the
   `delivery_failed` event sits in the events table where only later
   may/closed-loop-steward sessions see it — i.e. observed only by
   *other* sessions, not the offending one.)
3. **Stop carrying the negative-example text.** It is load-bearing on
   nothing. Removing it frees ~120 chars of evaluator context for
   something the model can act on (e.g. an example of the *correct*
   `message({to: "may", ...})` shape, which is a positive example
   per KE-009's mechanism analysis).

Mechanism note: KE-009's mechanism section says negative examples
"don't activate at the decision point." Event 527622 is a stronger
finding — they don't activate even when the agent is *thinking* about
the exact failure mode. So #3 above isn't merely "negative examples
are useless"; it's "negative examples in tool-shape contexts may be
counterproductive because they prime the wrong token sequence
(`functions.message`) into the working context."

## Falsifiers (3-day window)

- **F1**: If structural fix #1 lands, `message.delivery_failed` events
  with `to='functions.message'` should drop to **0** within 24h post-deploy
  across all agents. Failure to drop falsifies "structural rejection beats
  negative example."
- **F2**: If only documentation is updated (e.g. another negative example
  appended), `delivery_failed` count on a 24h trailing window should be
  **≥6** within 48h of the doc edit. ≥6 confirms KE-009; <6 falsifies KE-009
  as currently scoped (and would weaken this KE's confirming evidence).
- **F3**: If structural fix #2 (bounce-as-tool-error) lands, the
  *recurrence rate per session* should drop from today's observed
  ≥1.5/session (12 failures in ~8 sessions) to ≤0.1/session. Higher
  recurrence rate falsifies "in-session feedback changes tool-call shape."
- **F4 (anti-self-confirmation)**: If `delivery_failed` count drops to 0
  for a different reason — e.g. evaluator stops sending messages
  altogether due to upstream wedge — neither KE-009 nor this KE gain
  evidence. Verify by checking
  `SELECT COUNT(*) FROM events WHERE event_type='message.created' AND source LIKE 'evaluator%' AND timestamp > <fix-time>`
  remains within ±25% of pre-fix volume.

## Verification recipe

```sql
-- Today's confirming evidence
SELECT id, owner, json_extract(data,'$.to') target,
       json_extract(data,'$.from') sender,
       substr(json_extract(data,'$.content'),1,80) content_head,
       timestamp
FROM events
WHERE event_type='message.delivery_failed'
  AND timestamp > strftime('%s','now')*1000 - 24*3600000
ORDER BY timestamp;
```

## Cross-refs
- KE-009 (parent claim, A-grade, this KE adds confirming case 9)
- KE-002, KE-006 (sister findings on text-rule limits)
- evaluator/context.md:26, evaluator/heartbeat.md:39 (the negative-example sites)
- events 527373, 527386, 527403, 527416, 527423, 527425, 527434, 527622, 527733, 527743, 527764, 527780 (the 12 failures)
