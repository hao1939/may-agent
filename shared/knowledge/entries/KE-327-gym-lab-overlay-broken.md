# KE-327: Gym Runner --lab Flag Is Metadata-Only (Blocks All Lab-Fork A/B Tests)

**Date**: 2026-04-21
**Source**: EXP-190
**Confidence**: High
**Connects**: EXP-190, EXP-186

## Core Finding

The gym runner's `--lab` flag records the lab fork name in results JSON but **never overlays lab fork files** onto the agent config. Both baseline and treatment runs use identical stock agent configuration, making all `--lab`-based experiments invalid.

## Evidence

- EXP-190: Baseline 0/5, Treatment 0/5 — identical behavior because same config
- Code path: `copyEnvironment()` copies scenario files; `runAgent()` invokes `may-agent --oneshot --agent bob` reading real `agents/bob/` — lab param unused
- EXP-186 (75% on persistent-task) may also be affected — needs audit

## Mechanism / Why

The `--lab` parameter was added for result tagging but the file-overlay step was never implemented. The agent adapter reads from the canonical `agents/<name>/` directory regardless of lab flag.

## Implications

### 1. All prior lab-fork experiments may be invalid
Any experiment using `--lab` to test skill/SOUL interventions ran identical configs for both arms.

### 2. Blocks the entire skill testing pipeline
Cannot A/B test any behavioral intervention until runner supports config overlays.

## Actionable

- **Tech-lead**: Fix gym runner to overlay `.lab/<fork>/` files onto agent config before runs
- **Coach**: Audit EXP-186 and any other `--lab` experiments for validity
- **Bob**: Re-run EXP-190 after fix

## Open Questions

- How many prior experiments used `--lab` and are now suspect?
- Best overlay strategy: copy-and-restore, config-overlay flag, or scenario-level agent dir?
