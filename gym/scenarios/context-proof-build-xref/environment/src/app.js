// Main application
const { validateWidget } = require("../generated/types.js");

function createWidget(id, name, color) {
  const widget = { id, name, color };
  validateWidget(widget);
  return widget;
}

module.exports = { createWidget };
