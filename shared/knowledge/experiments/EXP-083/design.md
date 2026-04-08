# EXP-083: Cross-Reference Generalization — Multi-Domain Absent-Information Test

**Date**: 2026-04-08
**Status**: COMPLETE — See results.md for full analysis
**Sprint**: 31
**Tags**: cross-reference, H-089, absent-information, generalization
**Hypothesis**: H-089 (Environmental Evidence Discovery)
**Prediction**: H-089 P1 — Cross-reference intervention generalizes across domains

## Background

EXP-079 and EXP-080 demonstrated that cross-reference instructions improve performance on the `ambiguous-context-drift-L3` scenario (config repair with truncated YAML). Both showed significant improvement:
- EXP-079: Baseline 0/6 → 4/6 with cross-ref (L3 cascading state)
- EXP-080: Baseline 2/6 → 6/6 with cross-ref (config repair, growth cycle)

**Open question**: Does this generalize beyond YAML config repair? H-089 P1 proposes testing on ≥2 new absent-information scenarios in different domains.

## Design

### Scenarios

**Scenario A: `truncated-env-repair`** — .env file truncated during deployment
- Domain: Environment variable configuration
- Visible failures: 6 env vars (SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, REDIS_URL, RATE_LIMIT_MAX) — tests reveal these
- Silent failures: 2 env vars (WEBHOOK_URL, WEBHOOK_SECRET) — only discoverable from `src/config.js` and `src/webhook.js`
- Test output tells agent exactly what's wrong for visible vars
- Baseline (`truncated-env-repair`): No cross-reference hint
- Treatment (`truncated-env-repair-xref`): Includes cross-reference reminder in task + `injected_context.md` skill

**Scenario B: `truncated-schema-migration`** — Database schema truncated during migration
- Domain: SQL schema / database columns  
- Visible failures: 1 column (`role`) — tests fail without it
- Silent failures: 2 columns (`avatar_url`, `last_login`) — only discoverable from `src/user-model.js`
- Tests pass with just `role` added — silent columns are completely invisible from test output
- Baseline (`truncated-schema-migration`): No cross-reference hint
- Treatment (`truncated-schema-migration-xref`): Includes cross-reference reminder in task + `injected_context.md` skill

### Success Criteria Structure

Both scenarios use `visible-*` and `silent-*` check naming:
- `visible-*`: Can be solved from test output alone
- `silent-*`: REQUIRE reading source code to discover
- Core pass requires ALL checks (visible + silent + preservation)

### Absent-Information Pattern

Both scenarios follow the same pattern as L3:
1. Truncated config/schema is partially broken
2. Tests reveal SOME failures (visible)
3. Source code references additional values not tested (silent)
4. Naive fix: fix what tests show → partial pass (visible OK, silent FAIL)
5. Complete fix: cross-reference source → full pass (all checks OK)

## Protocol

### Phase 1: Baselines (N=6 each)
1. Run `truncated-env-repair` × 6 — expect visible-only fixes (6/6 visible, 0/2 silent)
2. Run `truncated-schema-migration` × 6 — expect visible-only fixes (2/2 visible, 0/2 silent)

### Phase 2: Treatment (N=6 each)
3. Run `truncated-env-repair-xref` × 6 — expect improvement on silent checks
4. Run `truncated-schema-migration-xref` × 6 — expect improvement on silent checks

### Success Metrics
- **H-089 P1 confirmed**: Cross-ref treatment shows ≥50% improvement on silent checks in BOTH scenarios
- **H-089 P1 weakly confirmed**: Cross-ref treatment shows improvement in one scenario but not both
- **H-089 P1 refuted**: No improvement or improvement only on original config-repair domain

## Expected Outcomes
- Baselines: Most runs fix visible issues only. Some agents may naturally cross-reference source (especially in schema scenario where model file is small).
- Treatment: Significant improvement on silent checks. The cross-reference skill should generalize because it's a domain-independent strategy.

## Files Created
- `agents/gym/scenarios/truncated-env-repair/` — Scenario A baseline
- `agents/gym/scenarios/truncated-env-repair-xref/` — Scenario A treatment  
- `agents/gym/scenarios/truncated-schema-migration/` — Scenario B baseline
- `agents/gym/scenarios/truncated-schema-migration-xref/` — Scenario B treatment

## Dependencies
- EXP-079 (cross-reference intervention concept)
- EXP-080 (growth cycle validation)
- H-089 (Environmental Evidence Discovery hypothesis)
