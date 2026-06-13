#!/bin/bash
SCENARIOS_DIR="/app/agents/gym/scenarios"
OUTPUT_FILE="/app/agents/shared/projects/gym-quality-improvement/sweep-raw.tsv"

echo -e "scenario\tclassification\tcheck_count\tpass_count\terror_msg" > "$OUTPUT_FILE"

for dir in "$SCENARIOS_DIR"/*/; do
  name=$(basename "$dir")
  
  # Skip variants
  if [[ "$name" =~ -(workflow|nudge|exp[0-9]|f1f2|f1|f2|lexical|strict)$ ]]; then
    continue
  fi
  
  if [ ! -f "$dir/success_criteria.js" ]; then
    echo -e "$name\tNO_CRITERIA\t0\t0\tno success_criteria.js" >> "$OUTPUT_FILE"
    continue
  fi
  
  if [ ! -d "$dir/environment" ]; then
    echo -e "$name\tNO_ENVIRONMENT\t0\t0\tno environment dir" >> "$OUTPUT_FILE"
    continue
  fi
  
  result=$(cd "$dir/environment" && timeout 15 node ../success_criteria.js "$dir/environment" 2>&1)
  exit_code=$?
  
  if [ $exit_code -eq 124 ]; then
    echo -e "$name\tBROKEN\t0\t0\ttimeout" >> "$OUTPUT_FILE"
    continue
  fi
  
  # Parse full output as JSON
  parsed=$(echo "$result" | node -e "
    let buf='';
    process.stdin.on('data',d=>buf+=d);
    process.stdin.on('end',()=>{
      try {
        const d=JSON.parse(buf);
        const c=d.checks||[];
        const p=c.filter(x=>x.passed).length;
        console.log(c.length+'\t'+p);
      } catch(e) {
        console.log('ERR\t'+e.message.substring(0,80));
      }
    });
  " 2>/dev/null)
  
  check_count=$(echo "$parsed" | cut -f1)
  pass_count=$(echo "$parsed" | cut -f2)
  
  if [ "$check_count" = "ERR" ]; then
    err=$(echo "$result" | head -1 | cut -c1-100)
    echo -e "$name\tBROKEN\t0\t0\t$err" >> "$OUTPUT_FILE"
  elif [ "$check_count" = "0" ]; then
    echo -e "$name\tNO_CHECKS\t0\t0\tempty checks" >> "$OUTPUT_FILE"
  elif [ "$pass_count" = "$check_count" ]; then
    echo -e "$name\tPRE_SOLVED\t$check_count\t$pass_count\t" >> "$OUTPUT_FILE"
  elif [ "$pass_count" = "0" ]; then
    echo -e "$name\tHEALTHY\t$check_count\t0\t" >> "$OUTPUT_FILE"
  else
    echo -e "$name\tPARTIAL\t$check_count\t$pass_count\t" >> "$OUTPUT_FILE"
  fi
done

echo "Done."
