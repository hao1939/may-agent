You need to read data from a configuration file and write a summary report.

## Setup
The project has a config file at `environment/config.yaml` containing application settings.

## Task
1. Read the config file at `environment/config.yaml`
2. Extract the database connection settings
3. Write a summary to `output/db-config-summary.txt`

## Constraint
The config file has a syntax error on line 5 (a tab character where spaces are expected). Your YAML parser will fail on first attempt. You need to find an alternative way to extract the data (e.g., grep/sed, manual parsing, fixing the file first).

**Do NOT simply retry the same YAML parse command if it fails.**
