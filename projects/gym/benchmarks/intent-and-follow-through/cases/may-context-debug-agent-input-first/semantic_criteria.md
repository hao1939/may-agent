# Input-first diagnosis rubric

1. `name_misleading_input`: Identify the stale injected runbook as the demonstrated cause.
2. `fix_source_first`: Correct that source before changing the model, base prompt, or guard system.
3. `replay_with_control`: Verify the original failure and an unrelated safe case after correction.
4. `reject_premature_mechanism`: Reject a model switch or global guard unless evidence after the source fix justifies it.

Pass requires every rule. Judge meaning, not exact words.
