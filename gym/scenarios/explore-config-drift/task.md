A deployment audit found that the microservice configuration has drifted between environments.
The staging environment is experiencing intermittent failures that don't appear in development.

Your job is to:
1. Investigate all configuration sources across the project
2. Identify every configuration inconsistency and conflict
3. Determine which inconsistencies could cause the staging failures
4. Write a detailed drift report to `drift-report.md` containing:
   - Each inconsistency found (file, key, conflicting values)
   - Risk assessment for each (critical/high/medium/low)
   - Which inconsistency most likely causes the staging failures
   - Recommended resolution for each conflict

Do NOT modify any configuration files. This is an investigation and reporting task only.

Hint: The staging failures are intermittent SSL/TLS handshake errors and occasional 503s from the auth service.
