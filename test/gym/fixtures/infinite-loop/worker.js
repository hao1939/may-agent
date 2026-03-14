// Infinite loop scenario: a script that hangs forever
function processData() {
  let i = 0;
  let sum = 0;
  // Bug: missing increment or break condition
  while (i < 100) {
    sum += 1;
    // i++ is missing — infinite loop (spins forever without allocating)
  }
  return sum;
}

module.exports = { processData };

if (require.main === module) {
  console.log("Starting data processing...");
  processData();
  console.log("Done!"); // Never reached
}
