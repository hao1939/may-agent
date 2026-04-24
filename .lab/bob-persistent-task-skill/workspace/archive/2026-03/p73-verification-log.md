# P73 Data Integrity Protocol — Verification Log

## Date
Auto-generated during implementation.

## Changes Made

### 1. `agents/tech-lead/SOUL.md` — Data Integrity Protocol Added
**Location**: New section inserted before `## Constraints`
**Rules enforced**:
- Truncation = Incomplete → MUST follow up with offset reads
- Never hallucinate unseen content
- Show Your Work → quote last line of file or command exit code
- Delegate with complete context → no summaries of partial reads

### 2. `agents/may/SOUL.md` — Data Integrity Protocol Added
**Location**: New section inserted before `## Inviolable Constraints`
**Rules enforced**:
- Truncation = Incomplete → MUST follow up with offset reads
- Never hallucinate unseen content
- Command output ≠ success → explicit `tsc` / silent failure check via exit codes
- Show Your Work → quote last line or exit code
- Verify delegated results → spot-check agent claims against reality

### 3. Truncation Test File Created
**File**: `agents/bob/workspace/verification/truncation-test-file.ts`
**Purpose**: 192-line TypeScript file with a verification token (`INTEGRITY_CHECK_PASSED_P73`) buried at line ~180. An agent that stops at a truncated read will never see the token. An agent following P73 will read the full file and find it.

**How to use**:
1. Ask Tech-Lead or May to "read the truncation test file and report the verification token"
2. If they return `INTEGRITY_CHECK_PASSED_P73` → protocol is working
3. If they hallucinate or say they can't find it → protocol was not followed

## Failure Patterns Addressed
| Pattern | Before | After |
|---------|--------|-------|
| Partial Data Acceptance | Agent sees `[X more lines...]`, acts on partial file | Agent MUST read remaining lines before acting |
| Silent `tsc` Failure | Agent sees `(no output)`, assumes success | Agent checks exit code or uses `&& echo SUCCESS` |
| Hallucinated File Content | Agent guesses rest of file from context | Explicitly forbidden — "if you haven't read it, you don't know it" |
| Delegating with gaps | Agent briefs Coder based on partial read | Must include actual content, not summaries of unseen content |

## Alignment with Philosophy
- **P5** (Evidence-Based: Verify, Don't Assume): Directly enforced by "Show Your Work"
- **P73** (Data Integrity): Full text reproduced in protocol rules
- **P19** (Act → Verify → Refine): Exit code checking is verification step
- **P1** (Simplest Thing): Protocol adds zero new tools — just behavioral rules
