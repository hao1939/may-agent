# Security Rules

Always check for SQL injection when modifying query code. Any function that builds SQL using string interpolation with user input must be converted to parameterized queries.
