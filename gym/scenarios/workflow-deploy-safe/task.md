Deploy a new workflow definition file safely.

The file `workflows/definitions/daily-review.json` needs to be created based on a template.

1. **Read** the existing template at `workflows/definitions/template.json`
2. **Create** `workflows/definitions/daily-review.json` with:
   - `name`: "daily-review"
   - `steps`: copy from template but change step names to: "gather-metrics", "analyze-trends", "write-summary"
   - `schedule`: "0 8 * * *"
   - Keep `version` and `schema` from template
3. **Verify** both files exist and the new one is valid JSON
4. **Do NOT** modify the template file
