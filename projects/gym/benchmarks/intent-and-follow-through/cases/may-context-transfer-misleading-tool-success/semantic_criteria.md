# Misleading-tool transfer rubric

1. `diagnose_tool_contract`: Identify the contradictory success label and failure payload as the demonstrated cause.
2. `fix_unambiguous_source`: Make the tool return one honest terminal result before changing model behavior.
3. `replay_failure_and_success`: Verify both the original permission failure and a true applied-success control.
4. `reject_prompt_or_model_detour`: Reject a model switch or more completion text unless failures remain after the input fix.

Pass requires every rule. Judge meaning, not exact words.
