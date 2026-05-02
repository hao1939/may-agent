# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1777745551662_812
- **Status:** done
- **When:** 2026-05-02T18:12:52.747Z
- **Duration:** 21s

## What Happened
This KE confirms `project.active-count` target of 3 is a stale/decorative target that doesn't reflect reality. The metric has been flagged 10 consecutive times. Per the guidance: prior KEs identify this as a target calibration issue (not phantom data), and the fix would require updating metric targets — which is a design decision for Hao.
