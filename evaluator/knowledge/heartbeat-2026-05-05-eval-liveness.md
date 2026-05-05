# Evaluator heartbeat — 2026-05-05

## Eval pipeline liveness

DB is live; `evaluations.max(createdAt)` is recent.

Evidence:
- `evaluations.maxCreated = 1777979556839` (from DB query).
- Current time lag vs `maxCreated` is ~2,300,259 ms (~38 min) (computed in-node).

## Coverage snapshot (last 24h)

Naive coverage (all sessions):
- sessions24 = 1137
- eval24 = 34
- coverage = 34/1137 = **0.0299**

But evaluator is producing most sessions; excluding evaluator gives a more honest “human-facing coverage”:
- sessions24 excluding evaluator = 194
- eval24 (all agents) = 34
- coverage excl evaluator = 34/194 = **0.1753**

Agent distribution (24h):
- sessions24 top: evaluator 943; then tech-lead 50; bob 48; may 48; optimizer 48
- evals24: bob 14; may 11; tech-lead 5; optimizer 4

Short window (6h) excl evaluator:
- sessions6h excl evaluator: bob/may/optimizer/tech-lead each 12
- evals6h: bob 3; may 3; optimizer 1; tech-lead 1

Interpretation:
- The pipeline is **alive** (fresh eval timestamps) but **coverage is partial**.
- The low naive coverage number is heavily biased by evaluator-generated sessions; for an operational metric we should track coverage excluding evaluator (and possibly other intentionally-skipped classes).

## Legacy file artifacts

`.state/evaluations/` files are stale-ish vs DB (many mtimes from Mar/Apr), so treat it as a legacy output path. DB is canonical.

## Recommendation

If/when a coverage metric is configured, define it as:
- numerator: evaluations created in window
- denominator: sessions started/ended in window **excluding** evaluator (and any other agents intentionally skipped by eval-poller)

And add a guard alert if coverage excl-skips drops below a tunable threshold (e.g., <10% in 6h) to detect partial outages.
