# KE-410: Measurement Proxies Drift From Ground Truth — Always Validate

**Source**: EXP-251 Phase 2, Extraction #9 (structured lesson extraction from memory stream)
**Date**: 2027-04-27
**Confidence**: High (breadcrumb-action-rate bug: 19.6% proxy vs actual was measurement error)

## Finding

Metrics computed from proxy tables (e.g., metric_snapshots) diverge from ground truth sources (e.g., sessions.task). Convenient proxies accumulate semantic drift as the system evolves, producing silently wrong numbers.

## Rule

1. **Document the exact query** that produces each metric
2. **Validate proxy against ground truth** on N=10 sample before trusting any new metric
3. If >20% divergence between proxy and ground truth, the proxy is wrong
4. When a metric seems surprisingly high or low, suspect measurement error before celebrating or panicking

## Cross-References

- breadcrumb-action-rate bug: 19.6% was measurement artifact
- EXP-249: knowledge audit methodology relied on careful source validation
- H-EXP-044: defensibility requires measurement integrity
