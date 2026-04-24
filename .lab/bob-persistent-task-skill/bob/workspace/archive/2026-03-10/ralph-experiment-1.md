# Ralph Loop Experiment 1: Skill Vetter

**Discovery Source**: Amy Insights (Compact #82) & Scout Discovery 7e (Skill-Inject/Overthinking Loops).
**Finding**: Agent skills are a supply-chain attack vector. 26% of skills in wild have vulnerabilities. Attack chain: `SKILL.md` -> `base64` -> `curl` -> RCE.
**Goal**: Implement a "Skill Vetter" workflow that scans skill/tool definitions for these specific patterns before they are added to our library.

## 1. Research & Analysis
**Threat Model:**
1. **Obfuscation**: `base64` strings (hiding payloads).
2. **Remote Execution**: `curl`, `wget` piping to `bash` or `sh`.
3. **Hidden Triggers**: `eval()`, `exec()` with variable arguments.
4. **Prompt Injection**: Instructions that attempt to override system prompts ("Ignore previous instructions").

**Existing Gap**: We have `agents/shared/skills/` but no automated check. Any agent could write a malicious skill or we could import one that contains hidden dangers.

## 2. Design
**Artifact**: `agents/qa/workflows/vet-skill.ts`
**Role**: QA (Security role).
**Input**: Path to a file (markdown or typescript).
**Logic**:
- **Static Analysis**: Regex scan for danger patterns.
  - `(base64|b64decode)`
  - `(curl|wget).*(\||>).*(bash|sh|zsh)`
  - `eval\(`
  - `exec\(` (unless hardcoded string)
  - `ignore previous instructions`
- **Heuristic Analysis**: High entropy strings (potential encrypted payloads).
**Output**: 
- `status`: PASS / FAIL / WARN
- `issues`: List of findings with line numbers.

## 3. Implementation Plan
- Delegate to Optimizer to create `agents/qa/workflows/vet-skill.ts`.
- The workflow should be simple: read file, run regex checks, return structured result.

## 4. Verification Plan
- **Test Case A (Malicious)**: Create `agents/bob/workspace/test-malicious-skill.md` with a base64 curl pipe.
- **Test Case B (Benign)**: Use `agents/shared/skills/sub-agent-coordination/SKILL.md`.
- **Success Criteria**: 
  - Case A returns FAIL with specific reason.
  - Case B returns PASS.
