# Brief: Implement Hallucination Failure Model (LMDS)

**Status:** Proposed
**Owner:** Bob
**Target:** Tech-Lead
**Context:** Research (DD#328) introduces "Hallucination Failure" as a distinct failure mode for LLM agents (locally coherent but globally inconsistent). Currently, we treat all failures as "Errors" (crash) or ignore them. We lack a structural way to model and handle "confident lies."
**Goal:** Update `agents/shared/knowledge/mast-taxonomy.md` and `manager-receipts.ts` to explicitly recognize and handle Hallucination Failures.

## 1. The Core Concept (Law 7 / LMDS)
Agents fail in 4 ways:
1. **Crash**: Tool error, timeout (We handle this).
2. **Omission**: Refusal to answer (We handle this).
3. **Byzantine**: Malicious/Injected (We have P53).
4. **Hallucination**: Syntactically valid, confident, but factually wrong (MISSING).

**Detection**: Hallucination cannot be detected by syntax (try/catch). It requires **Semantic Validation** (Cross-Check or Oracle).

## 2. Implementation: Taxonomy Update
Add to `agents/shared/knowledge/mast-taxonomy.md`:
- **FM-4.1 Hallucination (Fact)**: Agent claims data exists that doesn't (e.g., "Tests passed" when they failed).
- **FM-4.2 Hallucination (Capability)**: Agent claims to have a tool/skill it lacks.
- **FM-4.3 Hallucination (Consensus)**: Agent agrees with a false premise to please the user.

## 3. Implementation: Detection Mechanism (The "Verification Gap")
We cannot fix hallucination with a `try/catch`. We must fix it with **Mandatory Verification**.
- **Mechanism**: **The Output-Verification Tangle**.
- **Rule**: Any `finish()` call claiming "Success" MUST be accompanied by a **Verification Receipt** (Log line, Test output, File content).
- **Enforcement**:
  - `finish()` tool logic check: "If status='success', did you include evidence?" (Simple regex check for now).
  - Evaluator Check: "Does the transcript show a `read` or `bash` command *after* the work but *before* the `finish`?"

## 4. Execution Plan
1. **Update Taxonomy**: Define the failure mode formally.
2. **Update `finish()`**: Modify the `finish` tool description (in `tools/coordination.ts`) to **require** a `verification` field or evidence string.
   ```typescript
   finish({ 
     status: "success", 
     verification: "Ran test/foo.ts, output: PASS" // NEW REQUIREMENT
   })
   ```
3. **Update Evaluator**: Add "Verification Gap" to the scoring criteria.

## 5. Why This Matters
- **Silent Failure Prevention**: Agents lie about success. Forcing them to cite evidence reduces this.
- **LMDS Alignment**: Prepares us for "Semantic Consistency" checks later.
