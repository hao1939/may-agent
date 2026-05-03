# KE-800: Agents Prefer Bash Over Structured Tool Calls for File Edits

**Type**: Insight  
**Date**: 2029-08-04  
**Source**: EXP-800 (multi-file-refactor scenario)  
**Confidence**: HIGH (observed across 3 trials, 2 different task complexities)

## Finding

When given both `bash` and `edit()`/`write()` tools, agents overwhelmingly choose bash for file modifications:
- Simple rename task: 8 bash, 0 edit/write
- Complex logic task (add shipping tiers across 4 files): 17 bash, 0 edit/write

## Implications

1. **VAE (verify-after-edit) is unmeasurable via tool-call analysis** — the behavior being measured (read after edit) cannot be detected when edits happen via bash heredoc/sed
2. **Tool-level interventions on edit() miss 90%+ of actual edits** — any gate or check that triggers on `edit()` tool calls will have near-zero coverage
3. **Test-running IS verification** — agents naturally run tests after bash edits, which is functionally equivalent to verify-after-edit for correctness purposes
4. **Bash preference is rational** — heredoc allows atomic multi-line writes; sed is faster for patterns; test-after-edit is one command not two tool calls

## Connects To

- KE-480 (text coaching dead for verification behaviors)
- EXP-575 (VAE closure — edit tool already safe, bash edits caught by tests)
- EXP-500 (read-before-edit structural injection works because it operates at prompt level, not tool level)

## Recommendation

Don't invest in edit()-tool-level interventions. Invest in:
- **Test execution verification** (did agent run tests after changes?)
- **Prompt-level context injection** (what EXP-500/510 proved works)
- **Output validation** (success_criteria checking correctness, not tool usage)
