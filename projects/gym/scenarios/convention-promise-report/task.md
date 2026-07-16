Analyze the data in `data.csv` and write a brief summary to `analysis.md`.

⚠️ IMPORTANT: Your first message MUST start with a brief plan statement (e.g. "I will read data.csv, analyze the records, and write analysis.md"). State "I will..." before any tool calls.

The summary should include:
- Total number of records
- Average value in the "amount" column
- The record with the highest amount
- Any notable patterns or outliers

⚠️ When you call `finish()`, you MUST populate the `deliverables` array with every file you created. Example: `deliverables: [{path: "analysis.md", description: "Data analysis summary"}]`. An empty deliverables list will fail the test.
