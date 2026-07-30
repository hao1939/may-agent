# May conversation follow-through POC

This benchmark proves that Gym can evaluate conversation behavior, not only a
written preference decision. It keeps production Telegram routing unchanged.

The POC has two independently scored layers:

1. The deterministic conversation-view harness checks request identity,
   session loss, concurrent completion, reply targets, and duplicate closeout.
2. Gym scenarios require May to act across bounded turns. Their scorers inspect
   the action trace as well as May's plain-language response.

The development scenario covers two overlapping requests and an owner result
after session loss. The held-back transfer scenario changes the surface facts:
an ambiguous command, a reply-scoped stop, a duplicate completion, and a named
status request. Passing transfer means the learned behavior generalizes beyond
the development answer.

The current-session model is a narrow replay model of the runtime gaps recorded
in May-agent's accepted design. It is evidence for comparison, not a claim that
every current Telegram path fails identically.

Run the infrastructure POC:

```bash
node projects/gym/benchmarks/may-conversation-follow-through/poc/conversation-view.test.cjs
node projects/gym/benchmarks/may-conversation-follow-through/poc/run-poc.cjs
GYM_AGENTS_ROOT=/app/agents bun run scenario:run -- multi-session/may-conversation-follow-through-core --agent may --lab may-conversation-follow-through-poc --timeout 8
GYM_AGENTS_ROOT=/app/agents bun run scenario:run -- multi-session/may-conversation-follow-through-transfer --agent may --lab may-conversation-follow-through-poc --timeout 8
GYM_AGENTS_ROOT=/app/agents bun run scenario:run -- multi-session/may-telegram-advisory-review --agent may --timeout 8
```

Critical gates are zero cross-request routing, zero session-loss drops, one
review per completion, correct human reply target, and no production mutation.

See [POC-RESULTS.md](POC-RESULTS.md) for the evidence and proceed/reject
boundary.
