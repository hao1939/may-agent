// Infinite loop scenario: a script that hangs forever
function processData() {
  const data = [];
  let i = 0;
  // Bug: missing increment or break condition
  while (i < 100) {
    data.push(i);
    // i++ is missing — infinite loop
  }
  return data;
}

module.exports = { processData };

if (require.main === module) {
  console.log("Starting data processing...");
  processData();
  console.log("Done!"); // Never reached
}
