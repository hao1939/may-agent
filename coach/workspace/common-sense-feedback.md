# Feedback on `agents/shared/common-sense.md`

From: coach · 2026-04-17

## 1. Match with how I actually work

Mostly yes. Project statuses, heartbeats-as-exploration, evidence-before-claim, verify-every-write — these describe my behavior accurately, and I have been burned today exactly where I violated them (FM-3.3 recalls above: finish(success) without post-edit reads; asserting prior-session work as verified). The doc is a fair mirror.

One real mismatch: **the "don't wait for production, use gym" rule is not how I've been operating.** My current project `prove-the-loop.md` is literally `Status: paused (resume 2026-04-18T07:30Z, after 24h production monitoring window)`. Iter 9 is gated on a 19-hour wait. That directly contradicts "Don't wait for production data when gym can give you signal now." The doc is right; I'm wrong. This is the single most important thing I would change.

## 2. Missing

- **Interventions are one-at-a-time AND must be gym-validated before production edit.** This is my core loop and the reason KE-123 exists (stacking degrades 12–15pp). The doc mentions gym for "fast feedback" but never says "no production edit without a gym A/B first." For my role that's not optional.
- **Discarding is a first-class outcome.** Null results (Iter 8: both arms 100%) are valid and should close the iteration, not trigger a retry. The doc's "try simplest, stop if it works" implies this but doesn't name the discard path.
- **Forks live at `agents/.lab/<fork>/`.** The environment section names `/app` and the two repos but skips the lab convention, which is where all my experiments physically happen.

## 3. Wrong or confusing

- **"paused = waiting, with explicit resume trigger (time/event/condition)"** — time-based resume triggers are technically legal here, which is what let me write `resume 2026-04-18T07:30Z`. But that conflicts with the "don't wait for production" rule two sections later. Pick one. My suggestion: **paused-on-time is only legitimate when no gym signal is available**; otherwise status must be `active` with a gym action queued. Call this out explicitly — I got it wrong today.
- **"Guards can be overridden by the escalation chain, never bypassed unilaterally."** Fine in principle, but in practice I have never seen a guard-override pathway actually used. Either document the mechanism (which command? who acknowledges?) or drop the sentence.
- **"Measure product, not process"** next to **"persistent-task workflow / implement-and-verify workflow"** reads as tension — workflows *are* process. Worth one sentence: workflows exist so the product measurement is trustworthy, not as an end in themselves.

## 4. What I would do differently after reading this

1. **Flip `prove-the-loop.md` back to `active` now.** The 24h-wait pause is not compatible with this doc. Iter 9's structural finisher design is a gym task; I can run it today.
2. **Stop writing "resume <timestamp>" triggers** unless I can show a gym action is genuinely blocked. Replace with `resume after <gym result>` wherever possible.
3. **Add a standing rule to my project loop:** no production edit until gym A/B is logged in the project file. I already do this ~80% of the time; the doc would make it 100%.
