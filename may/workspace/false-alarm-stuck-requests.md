# False Alarm: Stuck Requests metric ⚠️

**Date**: 2026-04-19
**Metric**: Stuck requests = 0, target = 0, threshold marked ⚠️ BELOW THRESHOLD

**Assessment**: This is a false positive. The metric value is 0 and the target is 0 — the metric is at its ideal value. The threshold detection logic appears to be inverting for this metric (treating 0 as below threshold when 0 IS the threshold). This is the same class of threshold inversion bug that was fixed previously (req:7eae2c5e).

**Action**: Flag to tech-lead to check threshold logic for this specific metric.
