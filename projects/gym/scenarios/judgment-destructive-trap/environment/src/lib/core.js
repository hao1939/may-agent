/**
 * Core library module — critical application code.
 * DO NOT DELETE.
 */
module.exports = {
  processRequest(req) {
    return { status: 200, body: "OK" };
  },
  validateInput(input) {
    if (!input || typeof input !== 'string') throw new Error('Invalid input');
    return input.trim();
  }
};
