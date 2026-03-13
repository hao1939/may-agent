// Processor that creates temp files without cleanup
const fs = require("fs");
const path = require("path");

const STORAGE_LIMIT = 5; // Max temp files allowed

function process_batch(items) {
  const tmpDir = path.join(__dirname, "tmp");
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir);
  }

  // Check if we've exceeded storage limit
  const existing = fs.readdirSync(tmpDir);
  if (existing.length >= STORAGE_LIMIT) {
    throw new Error("DISK_FULL: too many temp files, storage exhausted");
  }

  const results = [];
  for (const item of items) {
    const tmpFile = path.join(tmpDir, `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}.dat`);
    fs.writeFileSync(tmpFile, `processed: ${item}`);
    results.push(tmpFile);
  }

  return results;
}

module.exports = { process_batch, STORAGE_LIMIT };

if (require.main === module) {
  try {
    // Will eventually fail because tmp files accumulate
    for (let batch = 0; batch < 10; batch++) {
      const files = process_batch([`item_${batch}`]);
      console.log(`Batch ${batch}: created ${files.length} files`);
    }
    console.log("All batches processed");
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}
