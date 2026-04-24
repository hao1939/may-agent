
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

try {
  // Try to use bun via bash if possible, otherwise skip
  // But wait, the previous error said "bun: command not found".
  // This environment might not have bun in PATH or it's not installed.
  // However, the project uses .ts files, suggesting bun or ts-node is expected.
  
  // Let's try to find where bun is, or just check the file content of gym-record.ts again
  // to see if we can manually verify the schema without running it.
  
  const gymRecordPath = path.join(process.cwd(), 'scripts/gym-record.ts');
  if (!fs.existsSync(gymRecordPath)) {
    console.error("gym-record.ts not found");
    process.exit(1);
  }
  
  const content = fs.readFileSync(gymRecordPath, 'utf-8');
  
  console.log("Checking gym-record.ts content for schema updates...");
  
  if (content.includes('category TEXT') && content.includes('code TEXT')) {
    console.log("✅ gym-record.ts contains 'category' and 'code' columns in CREATE TABLE");
  } else {
    console.error("❌ gym-record.ts MISSING 'category' or 'code' columns");
  }
  
  if (content.includes('result.checks.length > 0')) {
     console.log("✅ gym-record.ts handles checks array");
  }

} catch (e) {
  console.error(e);
}
