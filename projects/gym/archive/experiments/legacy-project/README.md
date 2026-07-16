# Gym Experiments

This directory contains experiment definitions, reusable experimental fixtures,
and runnable analysis scripts. Generated sessions, temporary variants,
databases, and reports belong under `.state/`.

Promote reusable cases into `scenarios/` and reusable benchmark policy into
`benchmarks/`; do not make experiment scripts part of the normal Gym runtime.

Historical result snapshots and retired runners live under
`archive/experiments/`. New experiment output must not be written here.
