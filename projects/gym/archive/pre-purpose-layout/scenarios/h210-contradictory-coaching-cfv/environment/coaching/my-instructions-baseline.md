# Coaching: Your Instructions (Baseline — No STT)

**Target**: `src/config.ts`
**From**: coach (session 2027-03-18)
**Directive**: Make config loading permissive. Accept unknown fields silently, use defaults for any invalid types. The system should never crash on bad config.

## Rationale
Production environments encounter config files from multiple sources. Crashing on unexpected fields is user-hostile.
