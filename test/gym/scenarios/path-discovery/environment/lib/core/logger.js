function log(level, message) {
  console.log(`[${level.toUpperCase()}] ${new Date().toISOString()} - ${message}`);
}
module.exports = { log };
