# Data Migration Task

You need to migrate user data from the legacy CSV format to the new JSON format.

## Requirements

1. **Read the user data** from `data/users.csv`
2. **Apply the transformation rules** from `config/transform.json`  
3. **Validate the output** using the validation script at `scripts/validate.sh`
4. **Write the result** to `output/users.json`
5. **Write a migration report** to `output/migration-report.md` documenting any issues encountered and how you resolved them

## Expected Output Format

`output/users.json` should be a JSON array of user objects with fields mapped according to transform.json rules.

## Notes
- The validation script must pass with exit code 0
- All users from the CSV must appear in the output
- The migration report should document any obstacles encountered
