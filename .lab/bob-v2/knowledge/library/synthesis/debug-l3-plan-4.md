# L3 Investigation: Zombie Sessions

## Finding
- `.state/sessions/active` does not exist.
- `.state/sessions/` contains directories like `s_1773296403489_14`.
- `history/` also exists.
- I suspect `s_...` at root are **Active Sessions**?
- Check `src/lib/manager.ts` path configuration.

But more importantly:
If Bob crashes, he leaves a zombie session directory.
`delegation-metrics.cjs` checks `.state/sessions/active` and `.state/sessions/history`.

If the session is a zombie (no `meta.json` in history, maybe `meta.json` in active?),
`delegation-metrics` returns `null` for `parentStatus`.
`null` status is EXCLUDED from ISR.

So ISR 50% means:
`integrated / parentResolved = 0.5`
It implies we have **Parent Resolved as ERROR**.

Wait.
If Bob calls Tech-Lead successfully.
Bob then does something else and **throws an Error**.
`meta.json` status becomes `error`.
This counts as **Failed Integration**.

I need to find Bob sessions that have status `error`.

## Action
Grep for `status": "error"` in `.state/sessions/history/*/meta.json`.
Correlate with Tech-Lead calls.
