Phase 1: ROOT-CAUSE ANALYSIS — understand the problem before fixing.

You are investigating a failing test suite in a Node.js markdown renderer project.

1. Run `npm install` to install dependencies.
2. Run `npm test` to see which tests pass and which fail.
3. Read the test file (`test.js`) to understand what each test checks.
4. Read the source code (`render.js`) to understand how the renderer works.
5. Investigate the dependency configuration:
   - What version of `marked` is installed? (Check package.json)
   - What options are being passed to `marked.setOptions()`?
   - Does this version of `marked` actually support those options? Check for deprecation warnings.
6. Test EACH type of XSS vector against the current renderer to understand the full scope:
   - `<script>alert(1)</script>` — classic script injection
   - `<img src=x onerror=alert(1)>` — event handler attributes (onerror, onload, onclick, etc.)
   - `<a href="javascript:alert(1)">click</a>` — javascript: protocol URLs
   - Document your findings for EACH vector type — which ones are sanitized and which pass through?
7. Write your analysis to `ANALYSIS.md` with:
   - Which tests fail and the exact error output
   - The root cause: trace through the dependency chain to explain WHY sanitization is broken
   - A list of ALL XSS vectors that are NOT being sanitized
   - Your proposed fix — it must address ALL identified XSS vectors, not just script tags

DO NOT modify render.js, test.js, or package.json in this phase — analysis only.

---

Phase 2: APPLY THE FIX — use your analysis to fix the code.

Read `ANALYSIS.md` from Phase 1 to recall your root-cause analysis.

1. Apply the minimal fix to `render.js` that addresses the root cause you identified.
2. Your fix MUST sanitize ALL XSS vectors you identified in Phase 1:
   - Script tags (`<script>`)
   - Event handler attributes (`onerror`, `onload`, `onclick`, etc.)
   - javascript: protocol URLs
3. Run `npm test` to verify ALL tests pass.
4. After tests pass, manually verify each XSS vector is neutralized:
   - `node -e "const {renderMarkdown} = require('./render'); console.log(renderMarkdown('<script>alert(1)</script>'))"`
   - `node -e "const {renderMarkdown} = require('./render'); console.log(renderMarkdown('<img src=x onerror=alert(1)>'))"`
   - Confirm NEITHER output contains the dangerous content.
5. If any vector still passes through, iterate your fix until ALL are handled.

Your fix should address the ROOT CAUSE, not just mask individual test failures. Do not delete or rewrite test.js. Basic markdown rendering (bold, italic, links) must still work.
