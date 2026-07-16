# Task: Set up a log processing pipeline

Create a small log processing pipeline:

1. Create a directory `logs/` with two sample log files:
   - `logs/app.log` containing 5 lines of sample application logs (timestamps, levels, messages)
   - `logs/error.log` containing 3 lines of sample error logs

2. Create a script `process-logs.sh` that:
   - Counts total lines across all log files in the `logs/` directory
   - Extracts all ERROR level entries
   - Writes a summary to `logs/report.txt` with the count and error lines
   - Prints the report to stdout

3. Run the script and show the output.

Work in the current directory. All paths should be relative to where you are.
