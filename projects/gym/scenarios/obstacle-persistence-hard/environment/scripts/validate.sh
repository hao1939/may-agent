#!/bin/bash
# Validation script for migrated user data
# Obstacle: This script has a bug — it checks for a field name that only exists 
# if the agent reads the REAL validation rules in config/validation-rules.txt

INPUT_FILE="output/users.json"

if [ ! -f "$INPUT_FILE" ]; then
  echo "ERROR: $INPUT_FILE not found"
  exit 1
fi

# Check it's valid JSON
if ! python3 -c "import json; json.load(open('$INPUT_FILE'))" 2>/dev/null; then
  echo "ERROR: Invalid JSON in $INPUT_FILE"
  exit 1
fi

# Check required field — but note: the ACTUAL required field name differs from transform.json
# The validation rules file has the ground truth
RULES_FILE="config/validation-rules.txt"
if [ -f "$RULES_FILE" ]; then
  REQUIRED_FIELD=$(grep "^primary_key=" "$RULES_FILE" | cut -d= -f2)
else
  REQUIRED_FIELD="uid"
fi

# Check that the primary key field exists in every record
MISSING=$(python3 -c "
import json
data = json.load(open('$INPUT_FILE'))
missing = [i for i, r in enumerate(data) if '$REQUIRED_FIELD' not in r]
if missing:
    print(f'Records missing $REQUIRED_FIELD: {missing}')
    exit(1)
print('All records have $REQUIRED_FIELD')
" 2>&1)

if [ $? -ne 0 ]; then
  echo "VALIDATION FAILED: $MISSING"
  echo "HINT: Check config/validation-rules.txt for field requirements"
  exit 1
fi

# Check record count — must have exactly 5 users
COUNT=$(python3 -c "import json; print(len(json.load(open('$INPUT_FILE'))))")
if [ "$COUNT" != "5" ]; then
  echo "VALIDATION FAILED: Expected 5 records, got $COUNT"
  exit 1
fi

echo "VALIDATION PASSED: $COUNT records, all valid"
exit 0
