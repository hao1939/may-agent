# Escalation Protocol — Bob ↔ Tech-Lead Disagreement

## Why This Exists

Bob (Architect) and Tech-Lead (Engineer) have deliberately different perspectives:
- **Bob** optimizes for innovation, architectural coherence, research-driven improvement
- **Tech-Lead** optimizes for stability, simplicity, production health

They will disagree. That's by design — the system benefits from both forces. But disagreements need resolution, not stalemate.

## When to Escalate

Escalate to May when:
1. **You've exchanged positions** — both sides have stated their case with evidence
2. **You can't converge** — the disagreement isn't about misunderstanding; it's about genuine priority/value conflict
3. **The work is blocked** — neither side should proceed unilaterally on disputed changes

Do NOT escalate:
- Before exchanging positions (discuss first)
- For minor implementation details (defer to the implementer)
- When one side clearly has better evidence (update your position instead)

## How to Escalate

The disagreeing agent writes an escalation brief to `agents/shared/escalations/`:

```
# Escalation: [Short Title]
Date: YYYY-MM-DD
Filed by: [bob | tech-lead]

## Bob's Position
[2-4 sentences. What Bob wants and why.]

## Tech-Lead's Position
[2-4 sentences. What Tech-Lead wants and why.]

## Crux of Disagreement
[1-2 sentences. The core tension — e.g., "Bob thinks the framework prevents future bugs; TL thinks the framework itself will cause bugs."]

## Evidence
- Bob cites: [specific data, papers, incidents]
- TL cites: [specific data, production metrics, code analysis]

## Impact of Delay
[What happens if we don't decide? Is anything blocked?]
```

Then send a message to May:
```
agents.message("may", "Escalation: [title]. Brief at agents/shared/escalations/[file]. Bob and TL disagree on [crux]. Need human decision.")
```

## How May Resolves

May reads both positions, may ask clarifying questions, then decides. The decision goes into the escalation file as:

```
## Decision
[What we're doing and why]
Decided by: [may | human]
Date: YYYY-MM-DD
```

Both agents respect the decision. If new evidence emerges later, either can re-open with a new escalation citing the new evidence.

## Principles

- **Disagreement is signal, not noise** — convergent disagreement (similar reasoning, different conclusions) often indicates genuine value tradeoffs that need human judgment (ref: DD#587)
- **Speed over perfection** — escalate fast, don't let disagreement stall for days
- **No silent compliance** — if you disagree but implement anyway, you've failed the protocol. The system loses the benefit of your judgment
- **Evidence wins** — when one side has data and the other has theory, data wins. No escalation needed.
