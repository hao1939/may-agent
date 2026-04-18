#!/bin/bash
# reproduce_phantom.sh
# Writes a file and immediately reads it to detect filesystem propagation delay.

FILE="agents/bob/workspace/phantom_test.txt"
COUNT=0
FAILURES=0

for i in {1..20}; do
  CONTENT="test_content_$i"
  echo "$CONTENT" > "$FILE"
  
  # Immediate read
  READ_BACK=$(cat "$FILE")
  
  if [ "$READ_BACK" != "$CONTENT" ]; then
    echo "FAILURE at iteration $i: Wrote '$CONTENT', read '$READ_BACK'"
    FAILURES=$((FAILURES+1))
  else
    echo "Success at iteration $i"
  fi
  
  # Cleanup
  rm "$FILE"
done

echo "Total failures: $FAILURES / 20"
