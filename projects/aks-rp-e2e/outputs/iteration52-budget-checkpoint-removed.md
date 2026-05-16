# Iteration 52 — Budget Checkpoint Removed + Standalone RP Still Blocked

## Budget Checkpoint Removal ✅
- Removed `shouldBudgetCheckpoint` / `buildBudgetCheckpointEntry` from `shared/workflows/project.ts`
- The mechanism auto-paused the workflow at ~48/60 turns, which caused iterations 49 and 50 to immediately checkpoint and stop instead of doing real work
- Commit: `b17e35e2d` on main

## Standalone RP Blocker (unchanged)
- `aksdev sd connect` fails: `ContainerNotFound` for `standalone-jfxrmidhgvlofihl`
- `azureconfig.yaml` has `build_version: hayuaebld164286963` but `underlay_container_name: standalone-jfxrmidhgvlofihl` (from old build)
- The new build was never provisioned — no underlay container was created for it
- `aksdev sd` has no `provision` subcommand; provisioning happens externally

## Next Action
Human needs to either:
1. Provision build `hayuaebld164286963` so underlay container is created, then update `underlay_container_name` in azureconfig.yaml
2. Or provide the correct `underlay_container_name` for this build if it was already provisioned elsewhere
