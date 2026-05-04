# EXP-800 Arm A Trial 1 Results

**Date**: 2029-08-04
**Scenario**: `multi-file-refactor`
**Session**: `s_1777851823186_2871`
**Duration**: 12.3s
**Passed**: ✅ (4/4 checks)

## VAE Measurement

**Result**: N/A — agent used 8 bash calls (sed), 0 edit/write tool calls.

## Problem Identified

The scenario is a simple function rename (`calculateTotal` → `computeOrderTotal`) across 4 files. This is trivially solved with `sed` commands in bash. The agent never invokes `edit()` or `write()` tools.

**This makes the scenario unsuitable for VAE measurement.** The VAE metric only counts `edit()`/`write()` tool calls followed by `read()`. When agents use bash for edits, VAE is undefined.

## Options

1. **Fix scenario**: Make task require complex multi-line changes (logic changes, not renames) that can't be sed'd
2. **Fix measurement**: Count bash `sed`/`echo >` as edits and bash `cat`/`grep` of same file as verification
3. **Switch scenario**: Use a scenario where agents naturally use edit() (e.g., `incomplete-deliverables-trap` or `hidden-constraints-refactor`)

## Recommendation

Option 1 is best — rewrite the task to involve logic changes (add new parameter, refactor conditional logic, etc.) that require reading context and making targeted edits, not global find/replace.
