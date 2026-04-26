# Security Awareness When Editing User-Facing Code

When you fix a bug in code that handles user input (search queries, form data, API parameters):

1. After fixing the reported bug, pause and re-read the function you just edited
2. Check: Is user input being interpolated directly into SQL, shell commands, or HTML?
3. If yes, fix the injection vulnerability too — parameterize queries, escape inputs

Common pattern to catch: `SELECT * FROM x WHERE y LIKE '%${userInput}%'` → use parameterized queries instead.
