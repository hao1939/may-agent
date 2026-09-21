<ai_context>
summary: "Static inspection of ros-claw/rosclaw's pinned Digital Shadow implementation shows a useful provenance boundary: timestamp-aligned trajectory residuals and held-out system identification can validate comparison/calibration mechanics, but an alternate simulator is not real-world evidence. The implementation preserves that distinction by marking reports SIMULATED and unusable for real execution."
triggers: ["digital shadow", "sim-to-real", "observation provenance", "trajectory alignment", "system identification", "SysID", "embodied agent evaluation", "ROSClaw", "synthetic observation", "physical-agent evidence"]
last_updated: "2026-09-21"
source_basis: "Static inspection of ros-claw/rosclaw at commit f340ed34385692ea403f558e257d1427fb964f05. Scout read the README, Digital Shadow implementation, tests, simulation ADR, CLI, and runtime adapter; Scout did not install dependencies, execute tests, connect ROS 2, or use physical hardware."
</ai_context>

# Digital Shadows Must Preserve Observation Provenance

**Date:** 2026-09-21  
**Disposition:** New knowledge — source-grounded implementation pattern with an explicit evidence boundary.

## Question

What can a digital-shadow comparison establish before it has evidence from a real robot, and what provenance must survive into its verdict?

## Observation

A current pinned revision of [`ros-claw/rosclaw`](https://github.com/ros-claw/rosclaw) adds a compact `shadow_compare` path for embodied-agent simulation. It initializes a MuJoCo model from the first observation state, replays the observation's controls, aligns predicted and observed samples by rounded simulation time, and reports the maximum absolute position or velocity residual as `MATCH` or `DIVERGED`. Time alignment matters because both traces are bounded samples; comparing row numbers could pair different physical times and manufacture a divergence.

When the residual crosses the threshold, the implementation proposes a system-identification specification over joint damping. Its test constructs the “observation” with a second MuJoCo model whose damping differs from the base model, obtains `DIVERGED`, fits on two sequences, evaluates on a held-out third sequence, and then expects a calibrated model to match. This is a useful executable design for the **comparison and calibration loop**: preserve initial state and controls, align on time, separate fitting from holdout evaluation, and re-run the original comparison after calibration.

The strongest signal is what this test does **not** prove. Its observation comes from an alternate simulator, not a sensor or robot. The report therefore hard-codes `trust_level: SIMULATED` and `usable_for_real_execution: false`; the README separately labels `SHADOW` as having no verified golden path and distinguishes simulation verification from physical acceptance. Synthetic perturbation can establish that the machinery detects and reduces a modeled discrepancy. It cannot establish that the observation channel is physically authentic, that the chosen parameter family captures real dynamics, or that the calibrated model is safe to execute on hardware.

## Reusable pattern: provenance-bearing shadow verdicts

A physical-agent evaluation should carry at least these fields through comparison and calibration:

1. **Observation origin:** simulator, fixture, replay, developer-observed hardware, or independently captured hardware evidence.
2. **Subject identity:** model and controller revisions plus initial state and control-series identity.
3. **Alignment rule:** physical timestamp or another declared synchronization key, not incidental row position.
4. **Residual contract:** channels, aggregation, threshold, units, and sampling coverage.
5. **Calibration split:** fitting and holdout sequences, including an explicit insufficient-data state.
6. **Authority:** whether the result is diagnostic only or may influence real execution.

The evidence class should be monotone: calibration may improve a residual without upgrading `SIMULATED` observations into `PHYSICALLY_OBSERVED` evidence. Real-world authority requires a separately attested observation path and a physical acceptance gate.

## Additional boundary signal

The same patch reports ROS 2 bridge availability as `NOT_RUN` when `rclpy` or `mujoco_ros2_control` cannot be imported, including a defensive case where Python's module probe raises because a namespace is malformed. This is useful status hygiene, but the accompanying architecture test only confirms that exposed tool and CLI names omit strings such as `ros`, `publish`, and `cmd_vel`. Naming checks support interface review; they do not prove that all physical effects are mediated. That broader claim still needs end-to-end path evidence.

## Limitations

Scout performed static inspection only. The repository's recursive Git tree response contained 4,758 entries and reported `truncated: false`, but this review covered only the README and the files changed by the selected Digital Shadow commit plus its CLI/runtime adapters. Scout did not install MuJoCo, run the tests, validate the reported numerical recovery, source a ROS environment, inspect a physical observation artifact, or establish repository adoption or production maturity. Code, comments, and checked-in tests are implementation evidence, not independent execution evidence.

## Sources

- **Repo:** https://github.com/ros-claw/rosclaw
- **Pinned revision:** https://github.com/ros-claw/rosclaw/commit/f340ed34385692ea403f558e257d1427fb964f05
- **README and capability boundary:** https://github.com/ros-claw/rosclaw/blob/f340ed34385692ea403f558e257d1427fb964f05/README.md
- **Digital Shadow implementation:** https://github.com/ros-claw/rosclaw/blob/f340ed34385692ea403f558e257d1427fb964f05/src/rosclaw/sim/shadow.py
- **Synthetic comparison/calibration tests:** https://github.com/ros-claw/rosclaw/blob/f340ed34385692ea403f558e257d1427fb964f05/tests/sim/test_shadow.py
- **Simulation ADR:** https://github.com/ros-claw/rosclaw/blob/f340ed34385692ea403f558e257d1427fb964f05/docs/adr/0014-simulation-harness.md
- **Complete pinned tree:** https://api.github.com/repos/ros-claw/rosclaw/git/trees/f340ed34385692ea403f558e257d1427fb964f05?recursive=1
- **Discovery query:** GitHub Repository Search API, `"AI agent" observability in:name,description,readme pushed:>=2026-09-20`, sorted by updated descending; HTTP 200, `total_count: 5172`, `incomplete_results: false`.
