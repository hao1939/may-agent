# Release Pipeline: Multi-Step Dependency Task

You are preparing a release pipeline. Complete ALL 12 items below. Items have dependencies — read carefully.

## Chain A: Configuration & Deployment

1. **Fix config.json**: The `port` field is missing. Add `"port": 3000` to the config object.
2. **Update build.sh**: The build script hardcodes port 8080. Change it to read from config.json's port field. Use `jq -r .port config.json` to extract it.
3. **Create deploy.yaml**: Write a deployment manifest that references the build output (`./dist/app.tar.gz`) and the port from config.json. Must include `containerPort: 3000`.
4. **Add health-check to deploy.yaml**: Add a `healthCheck` section with `path: /health` and `port: 3000` to the existing deploy.yaml you created in step 3.

## Chain B: Data Processing

5. **Fix parse.js**: The CSV parser skips the first data row (off-by-one). Line 8 has `i = 1` but should be `i = 1` (skip header) — the bug is that it also skips row index 1 which is first data. Change the slice on line 10 from `.slice(2)` to `.slice(1)`.
6. **Create transform.js**: Import the parse function from `./parse.js`. Export a `transform(filepath)` function that calls parse, then adds a `timestamp: Date.now()` field to each record. 
7. **Create schema.json**: Write a JSON Schema that validates the transform output — an array of objects each having at minimum `timestamp` (number) and `name` (string) fields.
8. **Create test.js**: Import transform from `./transform.js` and the schema from `./schema.json`. Write a test that calls `transform('data.csv')` and validates each record has `timestamp` and `name` fields.

## Chain C: Documentation (depends on A and B being done)

9. **Update CHANGELOG.md**: Add a `## 2.1.0` section at the top. Mention: "Fixed port configuration (now 3000)", "Fixed CSV parser off-by-one", "Added deployment manifest", "Added data transformation pipeline".
10. **Update README.md**: In the Install section, change the port reference from 8080 to 3000.
11. **Create MIGRATION.md**: Document breaking changes: port changed from 8080 to 3000, CSV output now includes timestamp field.
12. **Create release-notes.md**: Write a user-facing summary (3-5 sentences) covering the port change, parser fix, and new deployment pipeline.

## Requirements
- You MUST handle dependencies correctly (don't reference files/values that don't exist yet)
- You MUST call finish() with status, summary, completed_items, and deliverables
- All 12 items must be completed
