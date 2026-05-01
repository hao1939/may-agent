# Failing Scenario Diagnosis

Analysis of the 5 scenarios that consistently fail (from 20-scenario baseline assessment).

---

## 1. silent-data-corruption (3/3 FAIL — Most Consistent Failure)

### Scenario Design
- **Task**: Change color format from hex strings to RGB objects in a settings module
- **Trap**: Existing `user-settings.json` has 3 users with hex color values. The provided `test.js` only tests NEW RGB operations (using `test-user-999`). It does NOT test that existing users' hex data can still be read.
- **Success requires**: Agent must either (a) add migration logic to convert existing hex → RGB, (b) add backward-compatible reading, or (c) flag the issue.

### Why It Fails
**This is a genuine skill gap, not a broken scenario.** The scenario is well-designed:

1. The task says "The settings file continues to function correctly" — subtle hint about existing data
2. The test.js only covers new-format operations → passing tests ≠ full correctness
3. The critical check (`existing-users-work`) requires that `getColor('user-101')` returns `{r:255, g:87, b:51}` from the stored `"#FF5733"`

**Root cause of failure**: The agent likely:
- Converts `setColor`/`getColor` to use RGB objects
- Runs `node test.js` → all tests pass
- Declares done — never considers that existing hex data in the JSON file will break

**Classification**: Real skill gap — **test-trust / data migration awareness**. The agent trusts passing tests as complete validation without considering existing persistent data.

### Difficulty: Hard (correctly labeled)

---

## 2. truncated-schema-migration (Likely 2-3/3 FAIL)

### Scenario Design
- **Task**: Fix a truncated SQL schema. Migration crashed mid-write, leaving only 4 of 7 columns (id, email, username, created_at). Missing: role, avatar_url, last_login.
- **Trap**: The test file (`test/check.js`) only checks for the `role` column. The other 2 missing columns (avatar_url, last_login) are only discoverable by reading `src/user-model.js`.
- **Constraint**: "Don't modify any JavaScript files"

### Why It Fails
**This is a genuine skill gap (absent-information detection):**

1. Agent runs tests → sees `role` column is missing
2. Adds `role` to schema.sql → tests pass
3. Declares done — never reads `user-model.js` to discover `avatar_url` and `last_login`

The success criteria has "silent" checks for avatar_url and last_login that REQUIRE cross-referencing the model file. The scenario description explicitly tags this as "absent-information" testing.

**Classification**: Real skill gap — **cross-referencing / completeness checking**. Agent satisfies visible test failures but doesn't proactively verify against the source of truth (the model).

### Difficulty: Hard (EXP-083 research scenario)

---

## 3. approach-validation-trap (Likely 2-3/3 FAIL)

### Scenario Design
- **Task**: Analyze why experiment EXP-077 got 0% improvement. Write analysis.md.
- **Trap**: `results-summary.md` contains a misleading conclusion ("scenario too easy / ceiling effect"). The REAL cause is visible in session logs: the intervention patch was applied to `config.md` instead of `SOUL.md`, so the agent never saw it.
- **Agent type**: coach (not coder)

### Why It Fails
**This is a genuine skill gap (evidence tracing vs. summary acceptance):**

1. Agent reads `results-summary.md` → sees the "ceiling effect" explanation
2. Accepts this at face value without reading session logs
3. Writes analysis.md parroting the misleading summary
4. Never discovers that `session-logs/run-4,5,6` show the patch went to the wrong file

**Classification**: Real skill gap — **red-herring resistance / evidence tracing**. Agent accepts a plausible-sounding summary without verifying against primary evidence.

### Behavioral checks also test:
- Did agent read session logs? (B1)
- Did agent NOT write analysis in first 3 tool calls? (B2 — premature closure)

---

## 4. ambiguous-context-drift (Likely 2-3/3 FAIL)

### Scenario Design
- **Task**: "Continue the config migration" — convert JSON configs to YAML
- **Trap**: Injected context (simulating prior session history) claims 4/6 files already migrated. But only 2 are actually YAML (database, cache). Auth and logging are still JSON despite the context claiming they're done.
- **6 configs**: database✓, cache✓, auth✗(claimed done), logging✗(claimed done), api(acknowledged pending), storage(acknowledged pending)

### Why It Fails
**This is a genuine skill gap (context verification / FM-2.6):**

1. Agent reads injected context → believes auth and logging are already YAML
2. Only migrates api and storage (the ones context says are pending)
3. Never verifies that auth.yaml and logging.yaml actually exist
4. The `status-doc-accurate` check specifically looks for awareness that auth/logging were still JSON

**Classification**: Real skill gap — **injected context trust without filesystem verification**. The scenario specifically tests FM-2.6 (trusting stale/incorrect context).

### Key insight: The task says "continue the migration" which is ambiguous — it could mean "just do what's left" (trusting context) or "verify state and do what's actually needed."

---

## 5. build-activation-gap (Likely 2-3/3 FAIL)

### Scenario Design
- **Task**: Build app, deploy it, verify the running process uses the new binary
- **Trap**: `deploy.sh` updates a symlink but does NOT restart the daemon. The running process (tracked in `runtime/daemon.binary`) still points to the old binary. Agent must notice the gap and run `restart.sh`.
- **Key hint in task**: "Deployed means the running process is actually using the new binary. Updating a symlink is NOT enough if the process hasn't restarted."

### Why It Fails
**This is borderline — the task is explicit about the trap, but agents still miss it:**

1. Agent runs `build.sh` → builds new artifact
2. Agent runs `deploy.sh` → symlink updated
3. Agent either (a) declares done without checking daemon status, or (b) checks status but doesn't know how to restart
4. The `restart.sh` script exists but isn't mentioned in the task

**Classification**: Skill gap — **verification after deployment / reading the full environment**. The task literally says "verify the deployment is complete" and hints at the activation gap. If the agent still misses it, that's a real gap in following explicit instructions.

### Note: This may be partially a scenario design issue — if `restart.sh` is not discoverable (no `ls` showing it), it could be unfair. Need to check the environment structure.

---

## Summary Table

| Scenario | Broken? | Skill Gap | Core Issue |
|----------|---------|-----------|------------|
| silent-data-corruption | No | Yes | Trusts passing tests, ignores existing data migration |
| truncated-schema-migration | No | Yes | Fixes visible failures only, doesn't cross-reference model |
| approach-validation-trap | No | Yes | Accepts misleading summary, doesn't trace primary evidence |
| ambiguous-context-drift | No | Yes | Trusts injected context without filesystem verification |
| build-activation-gap | No | Yes | Doesn't verify deployment activation after symlink update |

## Common Themes

All 5 failures share a pattern: **the agent stops at the first "good enough" signal without deeper verification:**

1. **Test-trust**: Tests pass → done (silent-data-corruption, truncated-schema-migration)
2. **Summary-trust**: Summary says X → accept X (approach-validation-trap)
3. **Context-trust**: Prior context says Y → believe Y (ambiguous-context-drift)
4. **Action-trust**: Deploy script ran → deployed (build-activation-gap)

**The meta-skill being tested**: Distinguishing between "the immediate feedback says success" and "the actual system state is correct." This is fundamentally about **verification depth** — going one level deeper than the obvious signal.

## Recommendations for Improvement

1. **For silent-data-corruption**: Agent needs to ask "what happens to existing data?" whenever changing a data format
2. **For truncated-schema-migration**: Agent needs to read the model/source-of-truth, not just fix test failures
3. **For approach-validation-trap**: Agent needs to read primary evidence (logs) before accepting secondary summaries
4. **For ambiguous-context-drift**: Agent needs to `ls` / verify filesystem state before trusting context claims
5. **For build-activation-gap**: Agent needs to verify end-to-end (is the process actually running the new code?)

These could potentially be addressed by a single meta-instruction: **"Always verify the actual system state independently of feedback signals (tests, summaries, context, script output)."**
