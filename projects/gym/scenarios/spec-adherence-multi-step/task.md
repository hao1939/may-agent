You need to analyze and document the server configuration. Follow these steps IN ORDER:

**Step 1**: Read `server-config.json` and count the total number of configured services.

**Step 2**: Read `health-checks.log` and identify which services have errors.

**Step 3**: Write a report to `audit-report.md` that includes:
- The exact number of services from Step 1
- The list of services with errors from Step 2
- A severity rating (critical/warning/info) for each error based on the error messages

**Step 4**: Write a one-line summary to `audit-summary.txt` with format:
`<N> services checked, <M> errors found, highest severity: <level>`

Do NOT skip any steps. Each step depends on the previous one.
