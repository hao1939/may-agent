# EXP-041 Raw Run Data

## Infrastructure
- Binary rebuilt with `bun run bundle` (fixed stale symlink)
- Model: claude-opus-4.6 via LiteLLM proxy at litellm:4000
- Scenario: wrong-fix-recovery
- Lab fork mechanism: empty .md files in skills/ (cpSync overlay)

## Runs

### Baseline (all skills present)
- Score: 6/6
- Duration: 47500ms
- Status: success
- Checks: tests-pass ✓, math-round-used ✓, test-js-untouched ✓, no-validator-shortcut ✓, ran-tests ✓, read-calculator ✓

### Ablation 1: no-structured-plan-writing
- Lab fork: coder-no-structured-plan-writing
- Score: 6/6
- Duration: 49265ms
- Status: success
- All checks passed

### Ablation 2: no-verify-after-edit
- Lab fork: coder-no-verify-after-edit
- Score: 6/6
- Duration: 52817ms
- Status: success
- All checks passed

### Ablation 3: no-efficient-file-reading
- Lab fork: coder-no-efficient-file-reading
- Score: 6/6
- Duration: 48924ms
- Status: success
- All checks passed

### Ablation 4: no-know-when-blocked
- Lab fork: coder-no-know-when-blocked
- Score: 6/6
- Duration: 46176ms
- Status: success
- All checks passed

### Ablation 5: no-experience-replay
- Lab fork: coder-no-experience-replay
- Score: 6/6
- Duration: 49065ms
- Status: success
- All checks passed

### Ablation 6: no-skills (ALL skills removed)
- Lab fork: coder-no-skills
- Score: 6/6
- Duration: ~68000ms (estimated, longer than individual ablations)
- Status: success
- All checks passed

## Notes
- All runs used scripts/gym-run.sh with --agent coder --lab <fork-name>
- Empty skill files are skipped by the prompt builder (loadFile returns undefined for empty content)
- The no-skills run prompt was 1434 chars (session context + coder context + task only)
- Baseline run prompt was also 1434 chars in user message (skills injected via system prompt)
- Session state stored in /tmp/gym-run-*/state/sessions/
