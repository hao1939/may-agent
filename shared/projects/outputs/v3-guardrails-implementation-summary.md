# V3 Guardrails Implementation Summary

## Changes Made to `master-worker.ts`

### 1. Stub File Pre-Creation (lines ~316-332)
Before the worker prompt, the system now:
- Parses the guidance text to detect output file paths (matches `outputs/...` patterns)
- Pre-creates a stub file with a placeholder comment (~90 bytes)
- This ensures the file exists before the worker runs

### 2. Modified Worker Prompt (lines ~335-339)
When a stub file is pre-created:
- The worker prompt is augmented with a `WRITE-FIRST CONSTRAINT` section
- Instructs the worker to use `edit()` as its first tool call to replace the stub content
- The stub content is a known HTML comment that's easy to replace

### 3. Stub Content-Length Check (lines ~348-360)
After the worker runs:
- If a stub was pre-created and appears in `changedFiles`, check its size
- If still < 100 bytes, the worker didn't meaningfully edit it — remove from `changedFiles`
- This prevents the stub itself from counting as "output produced"

## How It Works Together

1. Orchestrator guidance mentions `outputs/some-file.md`
2. System pre-creates `outputs/some-file.md` with stub content
3. Worker prompt says "use edit() to replace stub content"
4. Worker's first call is `edit()` (replacing stub) — satisfies write-first constraint
5. If worker ignores the stub, the < 100 byte check catches it → triggers existing v2 retry logic

## Expected Impact
- Workers get a concrete file path to `edit()` instead of needing to `write()` from scratch
- The `edit()` call pattern is easier for models to comply with since the file already exists
- Combined with v2 retry logic, should push compliance from 62.5% toward 85-90%
